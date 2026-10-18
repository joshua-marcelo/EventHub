import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ requireAdmin: vi.fn(), createClient: vi.fn(), createAdmin: vi.fn(), rpc: vi.fn(), adminRpc: vi.fn(), getUser: vi.fn(), createUser: vi.fn(), send: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ requireAdmin: m.requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: m.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: m.createAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
import { inviteOrganizer, promoteParticipant, resendOrganizerInvitation, searchParticipants } from "./actions";

const id = "e1000000-0000-4000-8000-000000000001";
const attempt = "e1000000-0000-4000-8000-000000000002";
const input = { firstName: "Casey", lastName: "Organizer", email: "casey@example.test" };
const lease = { code: "ok", id, attempt_id: attempt, email: input.email, first_name: input.firstName, last_name: input.lastName, created_at: "2026-10-16T00:00:00Z" };
const user = { id, email: input.email, created_at: "2026-10-16T00:01:00Z", email_confirmed_at: undefined };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  m.requireAdmin.mockResolvedValue({ id: "admin-id" });
  m.createClient.mockResolvedValue({ rpc: m.rpc });
  m.createAdmin.mockReturnValue({ rpc: m.adminRpc, auth: { admin: { getUserById: m.getUser, createUser: m.createUser, inviteUserByEmail: m.send } } });
  m.rpc.mockImplementation(async name => ({ data: name === "reserve_organizer_invitation" ? { code: "ok", id } : name === "acquire_organizer_invitation" ? lease : "ok", error: null }));
  m.adminRpc.mockResolvedValue({ data: "ok", error: null });
  m.getUser.mockResolvedValue({ data: { user: null }, error: { code: "user_not_found" } });
  m.createUser.mockResolvedValue({ data: { user }, error: null });
  m.send.mockResolvedValue({ data: { user }, error: null });
});

describe("Admin Organizer invitations", () => {
  it.each([() => inviteOrganizer(input), () => resendOrganizerInvitation(id), () => promoteParticipant(id), () => searchParticipants("Casey")])("requires Admin authorization before privileged work", async run => {
    m.requireAdmin.mockRejectedValue(new Error("Unauthorized"));
    await expect(run()).rejects.toThrow("Unauthorized");
    expect(m.createAdmin).not.toHaveBeenCalled(); expect(m.createClient).not.toHaveBeenCalled();
  });
  it("creates one preallocated, unconfirmed identity without a password and sends via Supabase", async () => {
    expect(await inviteOrganizer(input)).toMatchObject({ ok: true });
    expect(m.createUser).toHaveBeenCalledWith({ id, email: input.email, email_confirm: false, user_metadata: { first_name: "Casey", last_name: "Organizer" } });
    expect(m.send).toHaveBeenCalledWith(input.email, { redirectTo: "http://localhost:3000/accept-invitation" });
    expect(m.adminRpc).toHaveBeenCalledWith("finish_organizer_invitation", { p_id: id, p_attempt_id: attempt, p_actor_id: "admin-id", p_sent: true });
    expect(m.requireAdmin).toHaveBeenCalledTimes(2);
  });
  it.each(["existing_account", "already_invited"])("rejects %s before creating or emailing an identity", async code => {
    m.rpc.mockResolvedValue({ data: { code }, error: null });
    expect(await inviteOrganizer(input)).toMatchObject({ ok: false, code });
    expect(m.createUser).not.toHaveBeenCalled(); expect(m.send).not.toHaveBeenCalled();
  });
  it("fails closed when a concurrent signup wins email uniqueness", async () => {
    m.createUser.mockResolvedValue({ data: { user: null }, error: { code: "email_exists" } });
    expect(await inviteOrganizer(input)).toMatchObject({ ok: false, code: "existing_account" });
    expect(m.send).not.toHaveBeenCalled();
    expect(m.adminRpc).toHaveBeenCalledWith("finish_organizer_invitation", expect.objectContaining({ p_sent: false }));
  });
  it("reports an SMTP send failure as invite_email_failed, logs safely and never activates", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    m.send.mockResolvedValue({ data: { user: null }, error: { name: "AuthApiError", status: 500, code: "unexpected_failure", message: "535 5.7.8 Authentication failed" } });
    expect(await inviteOrganizer(input)).toMatchObject({ ok: false, code: "invite_email_failed" });
    expect(m.adminRpc).toHaveBeenCalledWith("finish_organizer_invitation", expect.objectContaining({ p_sent: false }));
    expect(m.adminRpc).not.toHaveBeenCalledWith("finish_organizer_invitation", expect.objectContaining({ p_sent: true }));
    expect(log).toHaveBeenCalledWith("[organizer-invitation] failed", { invitationId: id, stage: "invite_email", errorName: "AuthApiError", errorCode: "unexpected_failure", status: 500 });
    expect(JSON.stringify(log.mock.calls)).not.toContain(input.email);
    log.mockRestore();
  });
  it("retries the reserved identity rather than creating a duplicate", async () => {
    m.getUser.mockResolvedValue({ data: { user }, error: null });
    expect(await resendOrganizerInvitation(id)).toMatchObject({ ok: true });
    expect(m.createUser).not.toHaveBeenCalled(); expect(m.send).toHaveBeenCalledOnce();
  });
  it.each([{ ...user, email: "other@example.test" }, { ...user, id: attempt }, { ...user, email_confirmed_at: "2026-10-16T00:02:00Z" }])("will not invite a mismatched or confirmed identity", async found => {
    m.getUser.mockResolvedValue({ data: { user: found }, error: null });
    expect(await resendOrganizerInvitation(id)).toMatchObject({ ok: false });
    expect(m.send).not.toHaveBeenCalled();
  });
  it("does not claim delivery or grant access when the email request fails", async () => {
    m.send.mockResolvedValue({ data: { user: null }, error: { code: "unexpected_failure" } });
    expect(await inviteOrganizer(input)).toMatchObject({ ok: false });
    expect(m.adminRpc).toHaveBeenCalledWith("finish_organizer_invitation", expect.objectContaining({ p_sent: false }));
    expect(m.adminRpc).not.toHaveBeenCalledWith("complete_organizer_acceptance", expect.anything());
  });
  it("refuses concurrent sends without contacting the email provider", async () => {
    m.rpc.mockResolvedValue({ data: { code: "retry_later" }, error: null });
    expect(await resendOrganizerInvitation(id)).toMatchObject({ ok: false, code: "retry_later" });
    expect(m.send).not.toHaveBeenCalled();
  });
  it("does not report success if persistence fails after provider acceptance", async () => {
    m.adminRpc.mockResolvedValue({ data: null, error: {} });
    expect(await inviteOrganizer(input)).toMatchObject({ ok: false, error: expect.stringContaining("could not be finalized") });
  });
  it("requires a configured trustworthy app origin before reserving an invitation", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "javascript:alert(1)");
    expect(await inviteOrganizer(input)).toMatchObject({ ok: false, code: "not_configured" });
    expect(m.rpc).not.toHaveBeenCalled(); expect(m.send).not.toHaveBeenCalled();
  });
  it("reports a missing server secret before reserving or resending", async () => {
    m.createAdmin.mockImplementation(() => { throw new Error("Organizer invitations are not configured."); });
    expect(await inviteOrganizer(input)).toMatchObject({ ok: false, code: "not_configured" });
    expect(await resendOrganizerInvitation(id)).toMatchObject({ ok: false, code: "not_configured" });
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("explains a missing management migration instead of a generic failure", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    expect(await inviteOrganizer(input)).toMatchObject({ ok: false, code: "migration_pending" });
    expect(await promoteParticipant(id)).toMatchObject({ ok: false, code: "migration_pending" });
    expect(m.createUser).not.toHaveBeenCalled(); expect(m.send).not.toHaveBeenCalled();
  });
});

describe("Participant promotion", () => {
  it("updates the existing identity through the caller-authorized RPC only", async () => {
    expect(await promoteParticipant(id)).toMatchObject({ ok: true });
    expect(m.rpc).toHaveBeenCalledWith("promote_participant_to_organizer", { p_user_id: id });
    expect(m.createAdmin).not.toHaveBeenCalled(); expect(m.createUser).not.toHaveBeenCalled(); expect(m.send).not.toHaveBeenCalled();
  });
  it.each(["already_active", "inactive_organizer", "not_eligible", "not_permitted"])("preserves the database's %s refusal", async code => {
    m.rpc.mockResolvedValue({ data: code, error: null });
    expect(await promoteParticipant(id)).toMatchObject({ ok: false, code });
  });
});
