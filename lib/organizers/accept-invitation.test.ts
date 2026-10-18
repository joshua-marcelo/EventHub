import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ verify: vi.fn(), getUser: vi.fn(), update: vi.fn(), rpc: vi.fn(), readProof: vi.fn(), remember: vi.fn(), clear: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { verifyOtp: m.verify, getUser: m.getUser, updateUser: m.update } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: m.rpc }) }));
vi.mock("./acceptance-proof", () => ({ readProof: m.readProof, rememberProof: m.remember, clearProof: m.clear, hashProof: () => "hashed-proof", newProof: () => "random-proof" }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
import { acceptOrganizerInvitation } from "./accept-invitation";

const password = { password: "ExamplePassword42", confirmPassword: "ExamplePassword42" };
const user = { id: "invited-user", email: "invitee@example.test", is_anonymous: false };
beforeEach(() => {
  vi.resetAllMocks();
  m.readProof.mockResolvedValue(null);
  m.verify.mockResolvedValue({ data: { user }, error: null });
  m.getUser.mockResolvedValue({ data: { user }, error: null });
  m.update.mockResolvedValue({ error: null });
  m.rpc.mockResolvedValue({ data: "ok", error: null });
});

describe("Organizer invitation acceptance", () => {
  it("validates password fields without spending the email token", async () => {
    expect(await acceptOrganizerInvitation({ ...password, confirmPassword: "mismatch" }, "fake-token")).toMatchObject({ ok: false });
    expect(m.verify).not.toHaveBeenCalled(); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("verifies an invite token, binds its identity, sets the password, then atomically activates", async () => {
    expect(await acceptOrganizerInvitation(password, "fake-token")).toMatchObject({ ok: true });
    expect(m.verify).toHaveBeenCalledWith({ type: "invite", token_hash: "fake-token" });
    expect(m.rpc).toHaveBeenCalledWith("begin_organizer_acceptance", { p_user_id: user.id, p_email: user.email, p_hash: "hashed-proof" });
    expect(m.update).toHaveBeenCalledWith({ password: password.password });
    expect(m.update.mock.invocationCallOrder[0]).toBeLessThan(m.rpc.mock.invocationCallOrder[2]);
    expect(m.rpc).toHaveBeenLastCalledWith("complete_organizer_acceptance", { p_user_id: user.id, p_hash: "hashed-proof" });
    expect(m.clear).toHaveBeenCalledOnce();
  });
  it("does not treat an ordinary authenticated session as an invitation", async () => {
    expect(await acceptOrganizerInvitation(password)).toMatchObject({ ok: false, code: "invitation_invalid" });
    expect(m.update).not.toHaveBeenCalled(); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("rejects expired or used Supabase tokens without falling back to an ambient session", async () => {
    m.readProof.mockResolvedValue("older-proof");
    m.verify.mockResolvedValue({ data: { user: null }, error: { code: "otp_expired" } });
    expect(await acceptOrganizerInvitation(password, "fake-expired-token")).toMatchObject({ ok: false, code: "invitation_invalid" });
    expect(m.update).not.toHaveBeenCalled(); expect(m.rpc).not.toHaveBeenCalled();
  });
  it.each(["identity_mismatch", "invitation_invalid"])("refuses %s before saving a password", async code => {
    m.rpc.mockResolvedValue({ data: code, error: null });
    expect(await acceptOrganizerInvitation(password, "fake-token")).toMatchObject({ ok: false, code: "invitation_invalid" });
    expect(m.update).not.toHaveBeenCalled(); expect(m.remember).not.toHaveBeenCalled();
  });
  it("keeps the protected proof for retry after rejected password setup", async () => {
    m.update.mockResolvedValue({ error: { code: "weak_password" } });
    expect(await acceptOrganizerInvitation(password, "fake-token")).toMatchObject({ ok: false, invitationVerified: true });
    expect(m.remember).toHaveBeenCalledWith("random-proof");
    expect(m.rpc).not.toHaveBeenCalledWith("complete_organizer_acceptance", expect.anything());
    expect(m.clear).not.toHaveBeenCalled();
  });
  it("retries using the HttpOnly proof and a freshly verified session, not a spent token", async () => {
    m.readProof.mockResolvedValue("protected-proof");
    expect(await acceptOrganizerInvitation(password)).toMatchObject({ ok: true });
    expect(m.verify).not.toHaveBeenCalled();
    expect(m.getUser).toHaveBeenCalledOnce();
    expect(m.rpc).toHaveBeenCalledWith("check_organizer_acceptance", { p_user_id: user.id, p_hash: "hashed-proof" });
  });
  it("refuses stale, expired, or identity-mismatched retry proofs before a password change", async () => {
    m.readProof.mockResolvedValue("protected-proof");
    m.rpc.mockResolvedValue({ data: "invitation_invalid", error: null });
    expect(await acceptOrganizerInvitation(password)).toMatchObject({ ok: false, code: "invitation_invalid" });
    expect(m.update).not.toHaveBeenCalled();
  });
  it("does not claim activation if the final transaction fails", async () => {
    m.rpc.mockImplementation(async name => ({ data: name === "complete_organizer_acceptance" ? "invitation_invalid" : "ok", error: null }));
    expect(await acceptOrganizerInvitation(password, "fake-token")).toMatchObject({ ok: false, invitationVerified: true });
    expect(m.clear).not.toHaveBeenCalled();
  });
  it("reports connection failures without logging or returning bearer credentials", async () => {
    m.verify.mockRejectedValue(new Error("sensitive-token"));
    const result = await acceptOrganizerInvitation(password, "sensitive-token");
    expect(result).toMatchObject({ ok: false }); expect(JSON.stringify(result)).not.toContain("sensitive-token");
  });
});
