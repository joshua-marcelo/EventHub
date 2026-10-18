import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ requireAdmin: vi.fn(), createClient: vi.fn(), rpc: vi.fn(), from: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ requireAdmin: m.requireAdmin, requireOrganizer: vi.fn(), requireUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: m.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { changeOrganizerStatus } from "./actions";

const id = "e1000000-0000-4000-8000-000000000001";
const adminId = "e1000000-0000-4000-8000-0000000000ad";

beforeEach(() => {
  vi.resetAllMocks();
  m.requireAdmin.mockResolvedValue({ id: adminId });
  m.createClient.mockResolvedValue({ rpc: m.rpc, from: m.from });
  m.rpc.mockResolvedValue({ data: "ok", error: null });
});

describe("changeOrganizerStatus", () => {
  it("requires Admin authorization before touching the database", async () => {
    m.requireAdmin.mockRejectedValue(new Error("Unauthorized"));
    await expect(changeOrganizerStatus(id, "suspended", "Reason")).rejects.toThrow("Unauthorized");
    expect(m.createClient).not.toHaveBeenCalled();
  });

  it("changes status only through the audited set_organizer_status RPC", async () => {
    expect(await changeOrganizerStatus(id, "suspended", "Policy breach")).toMatchObject({ ok: true });
    expect(m.rpc).toHaveBeenCalledExactlyOnceWith("set_organizer_status", { p_user_id: id, p_status: "suspended", p_reason: "Policy breach" });
    expect(m.from).not.toHaveBeenCalled();
    expect(m.revalidate).toHaveBeenCalled();
  });

  it("refuses an admin changing their own organizer access", async () => {
    expect(await changeOrganizerStatus(adminId, "revoked", "Reason")).toMatchObject({ ok: false, code: "not_permitted" });
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("rejects a missing reason or unknown status without calling the RPC", async () => {
    expect(await changeOrganizerStatus(id, "suspended", "")).toMatchObject({ ok: false });
    expect(await changeOrganizerStatus(id, "deleted" as "revoked", "Reason")).toMatchObject({ ok: false });
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("passes server refusals through without refreshing", async () => {
    m.rpc.mockResolvedValue({ data: "invalid_status", error: null });
    expect(await changeOrganizerStatus(id, "active", "Reason")).toMatchObject({ ok: false, code: "invalid_status" });
    expect(m.revalidate).not.toHaveBeenCalled();
  });
});
