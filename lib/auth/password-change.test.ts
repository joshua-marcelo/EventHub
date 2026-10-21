import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ user: vi.fn(), auth: { signUp: vi.fn(), signInWithPassword: vi.fn(), updateUser: vi.fn(), signOut: vi.fn() }, verifier: { signInWithPassword: vi.fn(), signOut: vi.fn() }, remember: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ auth: m.auth })) }));
vi.mock("@/lib/supabase/isolated", () => ({ createIsolatedAuthClient: () => ({ auth: m.verifier }) }));
vi.mock("@/lib/auth/dal", () => ({ getCurrentUser: m.user }));
vi.mock("@/lib/app-origin", () => ({ getAppOrigin: vi.fn(async () => "http://localhost:3000") }));
vi.mock("@/lib/auth/pending-email", () => ({ readPendingEmail: vi.fn(), rememberPendingEmail: m.remember }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { changePassword, signIn, signUp } from "./actions";

// Deliberately fake inputs.
const input = { currentPassword: "Temporary42x", password: "MyOwnPass42", confirmPassword: "MyOwnPass42" };
const organizer = { id: "u1", email: "org@example.test", isAdmin: false, organizerStatus: "active", isComplete: false, mustChangePassword: true };

beforeEach(() => {
  vi.resetAllMocks();
  m.user.mockResolvedValue(organizer);
  m.verifier.signInWithPassword.mockResolvedValue({ data: {}, error: null });
  m.verifier.signOut.mockResolvedValue({ error: null });
  m.auth.updateUser.mockResolvedValue({ data: {}, error: null });
  m.auth.signOut.mockResolvedValue({ error: null });
  m.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
});

describe("Change Password", () => {
  it("verifies the current password on an isolated client, updates, ends other sessions and continues home", async () => {
    await expect(changePassword(input)).rejects.toThrow("redirect:/organizer");
    expect(m.verifier.signInWithPassword).toHaveBeenCalledWith({ email: organizer.email, password: input.currentPassword, options: { captchaToken: undefined } });
    expect(m.verifier.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(m.auth.updateUser).toHaveBeenCalledWith({ password: input.password });
    expect(m.auth.signOut).toHaveBeenCalledWith({ scope: "others" });
  });
  it("sends an Admin-created Participant straight to Student Onboarding after the change", async () => {
    m.user.mockResolvedValue({ ...organizer, organizerStatus: "none" });
    await expect(changePassword(input)).rejects.toThrow("redirect:/onboarding");
  });
  it("returns a voluntary change to the profile with a confirmation", async () => {
    m.user.mockResolvedValue({ ...organizer, mustChangePassword: false });
    await expect(changePassword(input)).rejects.toThrow("redirect:/account/profile?password=changed");
  });
  it("refuses a wrong current password without changing anything", async () => {
    m.verifier.signInWithPassword.mockResolvedValue({ data: {}, error: { code: "invalid_credentials" } });
    expect(await changePassword(input)).toMatchObject({ ok: false, fieldErrors: { currentPassword: expect.any(String) } });
    expect(m.auth.updateUser).not.toHaveBeenCalled();
  });
  it("requires a new, valid, matching password different from the current one", async () => {
    expect(await changePassword({ ...input, password: input.currentPassword, confirmPassword: input.currentPassword })).toMatchObject({ ok: false, fieldErrors: { password: expect.any(String) } });
    expect(await changePassword({ ...input, confirmPassword: "Other42xx" })).toMatchObject({ ok: false, fieldErrors: { confirmPassword: expect.any(String) } });
    expect(await changePassword({ ...input, password: "short", confirmPassword: "short" })).toMatchObject({ ok: false });
    expect(m.verifier.signInWithPassword).not.toHaveBeenCalled();
  });
  it("requires a session", async () => {
    m.user.mockResolvedValue(null);
    expect(await changePassword(input)).toMatchObject({ ok: false, code: "session_not_found" });
  });
});

describe("login and sign-up destinations", () => {
  it("sends an account on a temporary password to Change Password, ignoring next", async () => {
    await expect(signIn({ email: organizer.email, password: "x" }, "/admin")).rejects.toThrow("redirect:/change-password");
  });
  it.each([[{ isAdmin: true, organizerStatus: "none" }, "/admin"], [{ isAdmin: false, organizerStatus: "active" }, "/organizer"], [{ isAdmin: false, organizerStatus: "none", isComplete: true }, "/dashboard"], [{ isAdmin: false, organizerStatus: "none", isComplete: false }, "/onboarding"]])("lands %o at %s", async (roles, home) => {
    m.user.mockResolvedValue({ ...organizer, ...roles, mustChangePassword: false });
    await expect(signIn({ email: organizer.email, password: "x" })).rejects.toThrow(`redirect:${home}`);
  });
  const signup = { firstName: "Ana", lastName: "Reyes", email: "ana@example.test", password: "StudentPass42", confirmPassword: "StudentPass42" };
  it("goes straight to Student Onboarding when sign-up returns a session (no email confirmation)", async () => {
    m.auth.signUp.mockResolvedValue({ data: { session: { access_token: "x" }, user: {} }, error: null });
    await expect(signUp(signup, "/events/abc")).rejects.toThrow("redirect:/onboarding?next=%2Fevents%2Fabc");
    expect(m.remember).not.toHaveBeenCalled();
  });
  it("keeps the check-email step while hosted email confirmation is still on", async () => {
    m.auth.signUp.mockResolvedValue({ data: { session: null, user: {} }, error: null });
    await expect(signUp(signup)).rejects.toThrow("redirect:/signup/check-email");
  });
  it("reports a duplicate email", async () => {
    m.auth.signUp.mockResolvedValue({ data: { session: null, user: null }, error: { code: "user_already_exists" } });
    expect(await signUp(signup)).toMatchObject({ ok: false, code: "user_already_exists" });
  });
});
