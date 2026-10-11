import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { readRecoveryLink, recoveryCredentialSchema, recoveryLinkPresent } from "./recovery";

describe("recovery link compatibility", () => {
  it("reads EventHub fragment links without putting credentials in the request URL", () => {
    const url = new URL("http://localhost:3000/reset-password#token_hash=test-only&type=recovery");
    expect(readRecoveryLink(url)).toEqual({ kind: "token_hash", tokenHash: "test-only" });
    expect(url.search).toBe("");
  });
  it("accepts older token-hash and PKCE links", () => {
    expect(readRecoveryLink(new URL("http://localhost:3000/reset-password?token_hash=test-only&type=recovery"))?.kind).toBe("token_hash");
    expect(readRecoveryLink(new URL("http://localhost:3000/reset-password?code=test-only"))?.kind).toBe("code");
  });
  it("recognizes legacy implicit sessions only for recovery", () => {
    expect(readRecoveryLink(new URL("http://localhost:3000/reset-password#access_token=test&refresh_token=test&type=recovery"))?.kind).toBe("session");
    expect(readRecoveryLink(new URL("http://localhost:3000/reset-password#access_token=test&refresh_token=test&type=signup"))).toBeNull();
  });
  it("selects the correct PKCE verifier when multiple email requests are pending", () => {
    expect(readRecoveryLink(new URL("http://localhost:3000/reset-password?code=test-only&sb_flow_id=email_flow_1"))).toEqual({ kind: "code", code: "test-only", flowId: "email_flow_1" });
    expect(recoveryCredentialSchema.safeParse({ kind: "code", code: "test", flowId: "../other" }).success).toBe(false);
  });
  it("never accepts errored or incomplete links", () => {
    for (const suffix of ["", "#token_hash=test&type=signup", "#access_token=test&type=recovery", "#error=access_denied&token_hash=test&type=recovery", "?error=access_denied&code=test"]) {
      expect(readRecoveryLink(new URL(`http://localhost:3000/reset-password${suffix}`))).toBeNull();
    }
  });
  it("recognizes invalid link data even when an existing session is present", () => {
    expect(recoveryLinkPresent(new URL("http://localhost:3000/reset-password#error=access_denied"))).toBe(true);
    expect(recoveryLinkPresent(new URL("http://localhost:3000/reset-password"))).toBe(false);
  });
  it("rejects malformed and excessive server action credentials", () => {
    for (const value of [null, {}, { kind: "token_hash", tokenHash: "" }, { kind: "session", accessToken: "a" }, { kind: "code", code: "x".repeat(513) }, { kind: "token_hash", tokenHash: "test", type: "signup" }]) {
      expect(recoveryCredentialSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe("branded auth emails", () => {
  for (const kind of ["confirmation", "recovery"]) {
    it(`${kind} uses email-compatible branding, correct variables and matching expiry`, () => {
      const html = readFileSync(`supabase/templates/${kind}.html`, "utf8");
      expect(html).toContain('role="presentation"');
      expect(html).toContain("{{ .TokenHash }}");
      expect(html).toContain("{{ .SiteURL }}");
      expect(html).toContain("expires in 1 hour");
      expect(html).not.toMatch(/<script|<img|<link|class=|localhost|ConfirmationURL/);
      expect(html.match(/href=/g)).toHaveLength(2);
      if (kind === "recovery") expect(html).toContain("/reset-password#token_hash=");
    });
  }
});
