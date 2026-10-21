import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ requireAdmin: vi.fn(), createClient: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ requireAdmin: m.requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: m.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
import * as actions from "./actions";
import { promoteParticipant, searchParticipants } from "./actions";

const id = "e1000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.resetAllMocks();
  m.requireAdmin.mockResolvedValue({ id: "admin-id" });
  m.createClient.mockResolvedValue({ rpc: m.rpc });
  m.rpc.mockResolvedValue({ data: "ok", error: null });
});

describe("Retired Organizer invitations", () => {
  it("no longer exposes invitation or resend actions", () => {
    expect(Object.keys(actions).sort()).toEqual(["promoteParticipant", "searchParticipants"]);
  });
  it.each([() => promoteParticipant(id), () => searchParticipants("Casey")])("requires Admin authorization before privileged work", async run => {
    m.requireAdmin.mockRejectedValue(new Error("Unauthorized"));
    await expect(run()).rejects.toThrow("Unauthorized");
    expect(m.createClient).not.toHaveBeenCalled();
  });
});

describe("Participant promotion", () => {
  it("updates the existing identity through the caller-authorized RPC only", async () => {
    expect(await promoteParticipant(id)).toMatchObject({ ok: true });
    expect(m.rpc).toHaveBeenCalledWith("promote_participant_to_organizer", { p_user_id: id });
  });
  it.each(["already_active", "inactive_organizer", "not_eligible", "not_permitted"])("preserves the database's %s refusal", async code => {
    m.rpc.mockResolvedValue({ data: code, error: null });
    expect(await promoteParticipant(id)).toMatchObject({ ok: false, code });
  });
  it("explains a missing management migration instead of a generic failure", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    expect(await promoteParticipant(id)).toMatchObject({ ok: false, code: "migration_pending" });
  });
});
