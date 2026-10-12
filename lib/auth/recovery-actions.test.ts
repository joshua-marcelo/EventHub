import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ verifyOtp: vi.fn(), exchangeCodeForSession: vi.fn(), setSession: vi.fn(), getClaims: vi.fn(), updateUser: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ auth })) }));
vi.mock("@/lib/auth/dal", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/app-origin", () => ({ getAppOrigin: vi.fn(async () => "http://localhost:3000") }));
vi.mock("@/lib/auth/pending-email", () => ({ readPendingEmail: vi.fn(), rememberPendingEmail: vi.fn() }));
import { updatePassword } from "./actions";

// Deliberately fake validation inputs; live checks generate their password in memory.
const password = { password: "ExamplePass42", confirmPassword: "ExamplePass42" };
const link = { kind: "token_hash" as const, tokenHash: "fake-test-input" };

beforeEach(() => {
  vi.resetAllMocks();
  for (const method of [auth.verifyOtp, auth.exchangeCodeForSession, auth.setSession, auth.updateUser, auth.signOut]) method.mockResolvedValue({ error: null });
  auth.getClaims.mockResolvedValue({ data: { claims: { sub: "verified-user" } } });
});

describe("secure password recovery", () => {
  it("validates the password before spending a single-use link", async () => {
    expect((await updatePassword({ ...password, confirmPassword: "mismatch" }, link)).ok).toBe(false);
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
  it("verifies a recovery token before updating and revokes other devices", async () => {
    expect((await updatePassword(password, link)).ok).toBe(true);
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: link.tokenHash });
    expect(auth.verifyOtp.mock.invocationCallOrder[0]).toBeLessThan(auth.updateUser.mock.invocationCallOrder[0]);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "others" });
  });
  it("rejects expired/reused links even with an existing authenticated cookie", async () => {
    auth.verifyOtp.mockResolvedValue({ error: { code: "otp_expired" } });
    expect(await updatePassword(password, link)).toMatchObject({ ok: false, code: "link_invalid", error: expect.stringContaining("Request a new one") });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("never updates a password without a verified session", async () => {
    auth.getClaims.mockResolvedValue({ data: null });
    expect((await updatePassword(password)).ok).toBe(false);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("bridges PKCE and legacy implicit sessions securely", async () => {
    await updatePassword(password, { kind: "code", code: "test-code" });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("test-code", undefined);
    await updatePassword(password, { kind: "code", code: "test-code", flowId: "test_flow_id" });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("test-code", { flowId: "test_flow_id" });
    await updatePassword(password, { kind: "session", accessToken: "test-access", refreshToken: "test-refresh" });
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: "test-access", refresh_token: "test-refresh" });
  });
  it("explains PKCE links opened in a different browser instead of calling them expired", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: { code: "pkce_code_verifier_not_found" } });
    expect(await updatePassword(password, { kind: "code", code: "test-code" })).toMatchObject({ ok: false, code: "link_invalid", error: expect.stringContaining("same browser") });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("allows retrying a rejected password through the new cookie session", async () => {
    auth.updateUser.mockResolvedValueOnce({ error: { code: "same_password" } });
    expect(await updatePassword(password, link)).toMatchObject({ ok: false, code: "same_password", recoveryVerified: true });
    expect((await updatePassword(password)).ok).toBe(true);
    expect(auth.verifyOtp).toHaveBeenCalledTimes(1);
  });
});
