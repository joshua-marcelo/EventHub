import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ requireAdmin: vi.fn(), createClient: vi.fn(), createAdmin: vi.fn(), rpc: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(), deleteUser: vi.fn(), profile: vi.fn(), recentResets: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/dal", () => ({ requireAdmin: m.requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: m.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: m.createAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
import { createOrganizerAccount, createParticipantAccount, resetAccountPassword } from "./accounts";
import { passwordSchema } from "@/lib/validation/auth";

const adminId = "a1000000-0000-4000-8000-0000000000ad";
const id = "a1000000-0000-4000-8000-000000000001";
const email = "new.organizer@example.test";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.requireAdmin.mockResolvedValue({ id: adminId, isAdmin: true });
  // audit_logs: select → eq → eq → gte resolves to the recent-reset count.
  const chain = { select: () => chain, eq: () => chain, gte: () => m.recentResets() };
  m.createClient.mockResolvedValue({ rpc: m.rpc, from: () => chain });
  m.recentResets.mockResolvedValue({ count: 0, error: null });
  m.createAdmin.mockReturnValue({
    auth: { admin: { createUser: m.createUser, updateUserById: m.updateUser, deleteUser: m.deleteUser } },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: m.profile }) }) }),
  });
  m.rpc.mockImplementation(async (name: string) => ({ data: name === "reserve_account" ? { code: "ok", id } : name === "request_password_reset" ? { code: "ok", email } : "ok", error: null }));
  m.createUser.mockImplementation(async ({ id: uid }: { id: string }) => ({ data: { user: { id: uid } }, error: null }));
  m.updateUser.mockResolvedValue({ data: { user: { id } }, error: null });
  m.deleteUser.mockResolvedValue({ data: {}, error: null });
  m.profile.mockResolvedValue({ data: { organizer_status: "active", is_admin: false, must_change_password: true }, error: null });
});

describe("Admin creates accounts with a temporary password", () => {
  it.each([() => createOrganizerAccount({ email }), () => createParticipantAccount({ email }), () => resetAccountPassword(id)])("requires Admin authorization before any work", async run => {
    m.requireAdmin.mockRejectedValue(new Error("notFound"));
    await expect(run()).rejects.toThrow("notFound");
    expect(m.createClient).not.toHaveBeenCalled(); expect(m.createUser).not.toHaveBeenCalled(); expect(m.updateUser).not.toHaveBeenCalled();
  });

  it("reserves, creates one confirmed Auth user with the reserved id, verifies provisioning and returns the credentials once", async () => {
    const result = await createOrganizerAccount({ email: " New.Organizer@Example.test " });
    expect(m.rpc).toHaveBeenCalledWith("reserve_account", { p_email: email, p_role: "organizer" });
    const args = m.createUser.mock.calls[0][0];
    expect(args).toEqual({ id, email, password: expect.any(String), email_confirm: true });
    expect(passwordSchema.safeParse(args.password).success).toBe(true);
    expect(result).toEqual({ ok: true, message: "Organizer account created.", credentials: { email, password: args.password } });
    // No role or flag is sent as metadata: the database trigger provisions them.
    expect(args).not.toHaveProperty("user_metadata"); expect(args).not.toHaveProperty("app_metadata");
  });

  it("never logs or returns the password on failure", async () => {
    m.createUser.mockResolvedValue({ data: { user: null }, error: { code: "unexpected_failure", status: 500 } });
    const result = await createParticipantAccount({ email });
    expect(result).toMatchObject({ ok: false });
    expect(result).not.toHaveProperty("credentials");
    const logged = JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls);
    expect(logged).not.toContain(email);
  });

  it("creates Participants without Organizer access", async () => {
    m.profile.mockResolvedValue({ data: { organizer_status: "none", is_admin: false, must_change_password: true }, error: null });
    expect(await createParticipantAccount({ email })).toMatchObject({ ok: true, message: "Participant account created." });
    expect(m.rpc).toHaveBeenCalledWith("reserve_account", { p_email: email, p_role: "participant" });
  });

  it("refuses an existing email before contacting Auth", async () => {
    m.rpc.mockResolvedValue({ data: { code: "existing_account" }, error: null });
    expect(await createOrganizerAccount({ email })).toMatchObject({ ok: false, code: "existing_account" });
    expect(m.createUser).not.toHaveBeenCalled();
  });

  it("maps an Auth duplicate (concurrent sign-up) to existing_account", async () => {
    m.createUser.mockResolvedValue({ data: { user: null }, error: { code: "email_exists" } });
    expect(await createOrganizerAccount({ email })).toMatchObject({ ok: false, code: "existing_account" });
  });

  it("does not report success, and removes the unused account, when provisioning is incomplete", async () => {
    m.profile.mockResolvedValue({ data: { organizer_status: "none", is_admin: false, must_change_password: false }, error: null });
    const result = await createOrganizerAccount({ email });
    expect(result).toMatchObject({ ok: false });
    expect(result).not.toHaveProperty("credentials");
    expect(m.deleteUser).toHaveBeenCalledWith(id);
  });

  it("validates the email and reports missing configuration or migration without creating anything", async () => {
    expect(await createOrganizerAccount({ email: "not-an-email" })).toMatchObject({ ok: false, fieldErrors: { email: expect.any(String) } });
    m.createAdmin.mockImplementation(() => { throw new Error("Account administration is not configured."); });
    expect(await createOrganizerAccount({ email })).toMatchObject({ ok: false, code: "not_configured" });
    m.createAdmin.mockReturnValue({ auth: { admin: { createUser: m.createUser } } });
    m.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    expect(await createOrganizerAccount({ email })).toMatchObject({ ok: false, code: "migration_pending" });
    expect(m.createUser).not.toHaveBeenCalled();
  });
});

describe("Admin-controlled password reset", () => {
  it("issues a new temporary password and confirms the change requirement", async () => {
    const result = await resetAccountPassword(id);
    expect(m.rpc).toHaveBeenCalledWith("request_password_reset", { p_user_id: id });
    const password = m.updateUser.mock.calls[0][1].password;
    expect(passwordSchema.safeParse(password).success).toBe(true);
    expect(result).toEqual({ ok: true, message: "Temporary password issued.", credentials: { email, password } });
  });
  it("refuses a second reset within a minute even after the first one completed (regression)", async () => {
    m.recentResets.mockResolvedValue({ count: 1, error: null });
    expect(await resetAccountPassword(id)).toMatchObject({ ok: false, code: "retry_later" });
    expect(m.rpc).not.toHaveBeenCalled(); expect(m.updateUser).not.toHaveBeenCalled();
  });
  it("fails closed when recent resets cannot be checked", async () => {
    m.recentResets.mockResolvedValue({ count: null, error: { code: "x" } });
    expect(await resetAccountPassword(id)).toMatchObject({ ok: false });
    expect(m.updateUser).not.toHaveBeenCalled();
  });
  it("refuses the Admin's own account without contacting the database", async () => {
    expect(await resetAccountPassword(adminId)).toMatchObject({ ok: false, code: "self_reset" });
    expect(m.rpc).not.toHaveBeenCalled(); expect(m.updateUser).not.toHaveBeenCalled();
  });
  it("preserves database refusals such as resetting another Admin", async () => {
    m.rpc.mockResolvedValue({ data: { code: "not_permitted" }, error: null });
    expect(await resetAccountPassword(id)).toMatchObject({ ok: false, code: "not_permitted" });
    expect(m.updateUser).not.toHaveBeenCalled();
  });
  it("withdraws the reset request when the Auth update fails", async () => {
    m.updateUser.mockResolvedValue({ data: null, error: { code: "unexpected_failure" } });
    expect(await resetAccountPassword(id)).toMatchObject({ ok: false });
    expect(m.rpc).toHaveBeenCalledWith("cancel_password_reset", { p_user_id: id });
  });
  it("rejects malformed ids", async () => {
    expect(await resetAccountPassword("../x")).toMatchObject({ ok: false });
    expect(m.rpc).not.toHaveBeenCalled();
  });
});
