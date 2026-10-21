/** Where a signed-in user goes when no valid `next` is given. */
export const DEFAULT_AFTER_LOGIN = "/dashboard";

// Paths that must never be a post-login destination (they would loop or re-run a token link).
function isNeverNext(path: string): boolean {
  const p = path.split(/[?#]/)[0];
  return (
    p === "/login" ||
    p === "/signup" ||
    p.startsWith("/signup/") ||
    p === "/forgot-password" ||
    p === "/accept-invitation" ||
    p === "/change-password" ||
    p.startsWith("/auth/")
  );
}

/**
 * Returns a safe, same-origin relative path for redirects, or `fallback`.
 *
 * Accepts a relative path ("/events/abc?x=1") or, when `origin` is given, an absolute URL on
 * that same origin (Supabase email links pass the full redirect URL). Rejects other origins,
 * protocol-relative and backslash tricks ("//evil.com", "/\\evil.com"), control characters and
 * auth pages (SYSTEM_SPEC §3.3, A1 return path).
 */
export function safeNextPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_AFTER_LOGIN,
  origin?: string,
): string {
  if (!value) return fallback;
  let candidate = value.trim();
  if (candidate.length === 0 || candidate.length > 512) return fallback;

  if (/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    if (!origin) return fallback;
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      return fallback;
    }
    if (url.origin !== new URL(origin).origin) return fallback;
    candidate = url.pathname + url.search + url.hash;
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  // Backslashes are treated as slashes by browsers; control characters can split headers.
  if (/[\\\u0000-\u001f\u007f]/.test(candidate)) return fallback;

  let normalized: string;
  try {
    const url = new URL(candidate, "http://n.invalid");
    if (url.origin !== "http://n.invalid") return fallback;
    normalized = url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }

  return isNeverNext(normalized) ? fallback : normalized;
}

const PUBLIC_EXACT = new Set([
  "/",
  "/demo",
  "/login",
  "/signup",
  "/signup/check-email",
  "/forgot-password",
  "/reset-password",
  "/accept-invitation",
  "/privacy",
  "/verify",
]);
const PUBLIC_PREFIXES = ["/auth/", "/verify/"];
// Canonical registration URL with the limited public preview (SYSTEM_SPEC §7.5, P-26).
// Malformed IDs also reach the neutral preview; UUID validation stays in the page.
// The invite-entry form remains authenticated.
const EVENT_PREVIEW = /^\/events\/(?!join$)[^/]+$/i;

/** Paths reachable without a session. Everything else requires a signed-in permanent user. */
export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_EXACT.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    EVENT_PREVIEW.test(pathname)
  );
}

/** Pages a signed-in user has no reason to see; they are sent to the dashboard instead. */
export function isGuestOnlyPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/signup";
}
