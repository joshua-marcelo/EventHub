import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), requireAdmin: vi.fn(), requireUser: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/dal", () => ({ requireAdmin: mocks.requireAdmin, requireUser: mocks.requireUser, requireOrganizer: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { changeOrganizerStatus, reviewApplication, submitApplication, withdrawApplication } from "./actions";

// requireAdmin returns the signed-in admin; changeOrganizerStatus uses it to refuse self-changes.
beforeEach(() => { vi.resetAllMocks(); mocks.requireAdmin.mockResolvedValue({ id: "b1000000-0000-4000-8000-0000000000ad" }); });

describe("retired organizer application actions", () => {
  it.each([null, {}, { consent: true, organization_name: "Council" }])("rejects submissions regardless of payload: %o", async input => {
    expect(await submitApplication(input)).toMatchObject({ ok: false, code: "workflow_retired" });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it.each(["approved", "rejected"] as const)("rejects stale %s requests without touching history or grants", async decision => {
    expect(await reviewApplication("b1000000-0000-4000-8000-000000000001", decision, "Legacy request")).toMatchObject({ ok: false, code: "workflow_retired" });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects stale withdrawal requests without changing historical status", async () => {
    expect(await withdrawApplication("b1000000-0000-4000-8000-000000000001")).toMatchObject({ ok: false, code: "workflow_retired" });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});

describe("existing Organizer status management", () => {
  const id = "b1000000-0000-4000-8000-000000000001";

  it("does not reach the status RPC when Admin authorization fails", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("Unauthorized"));
    await expect(changeOrganizerStatus(id, "active", "Review complete")).rejects.toThrow("Unauthorized");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it.each(["active", "suspended", "revoked"] as const)("still delegates %s transitions to the existing Admin RPC", async status => {
    const rpc = vi.fn().mockResolvedValue({ data: "ok", error: null });
    mocks.createClient.mockResolvedValue({ rpc });
    expect(await changeOrganizerStatus(id, status, "Administrator review")).toMatchObject({ ok: true });
    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("set_organizer_status", { p_user_id: id, p_status: status, p_reason: "Administrator review" });
  });

  it("preserves the database rejection of an invalid promotion or reinstatement", async () => {
    mocks.createClient.mockResolvedValue({ rpc: vi.fn().mockResolvedValue({ data: "invalid_status", error: null }) });
    expect(await changeOrganizerStatus(id, "active", "Attempt promotion")).toMatchObject({ ok: false, code: "invalid_status" });
  });
});
