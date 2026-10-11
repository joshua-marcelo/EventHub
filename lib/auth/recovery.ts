import { z } from "zod";

// These credentials arrive through the email link, never through logs or local storage.
export const recoveryCredentialSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("token_hash"), tokenHash: z.string().min(1).max(512) }).strict(),
  z.object({ kind: z.literal("code"), code: z.string().min(1).max(512), flowId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional() }).strict(),
  z.object({ kind: z.literal("session"), accessToken: z.string().min(1).max(8192), refreshToken: z.string().min(1).max(512) }).strict(),
]);

export type RecoveryCredential = z.infer<typeof recoveryCredentialSchema>;

/** Supports our token-hash emails and older Supabase PKCE/implicit recovery links. */
export function readRecoveryLink(url: URL): RecoveryCredential | null {
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (fragment.has("error") || url.searchParams.has("error")) return null;
  const params = fragment.has("token_hash") ? fragment : url.searchParams;
  if (params.get("type") === "recovery" && params.get("token_hash")) {
    return { kind: "token_hash", tokenHash: params.get("token_hash")! };
  }
  if (url.searchParams.get("code")) {
    const flowId = url.searchParams.get("sb_flow_id");
    return { kind: "code", code: url.searchParams.get("code")!, ...(flowId ? { flowId } : {}) };
  }
  if (fragment.get("type") === "recovery" && fragment.get("access_token") && fragment.get("refresh_token")) {
    return { kind: "session", accessToken: fragment.get("access_token")!, refreshToken: fragment.get("refresh_token")! };
  }
  return null;
}

/**
 * Supabase's hosted /verify redirects here with `#error_code=…` when it rejects a link. It
 * reports `otp_expired` both for expired tokens and for links superseded by a newer request
 * (each request replaces the previous token) or already opened once.
 */
export function recoveryLinkError(url: URL): string | null {
  const fragment = new URLSearchParams(url.hash.slice(1));
  const code = fragment.get("error_code") ?? url.searchParams.get("error_code");
  if (!fragment.has("error") && !url.searchParams.has("error")) return null;
  return code === "otp_expired"
    ? "This reset link was already used, expired, or replaced by a newer request. Open the link in your most recent EventHub email, or request a new one."
    : "This reset link is not valid. Request a new one.";
}

export function recoveryLinkPresent(url: URL): boolean {
  const fragment = new URLSearchParams(url.hash.slice(1));
  return ["token_hash", "code", "error"].some((key) => url.searchParams.has(key)) ||
    ["token_hash", "access_token", "error"].some((key) => fragment.has(key));
}
