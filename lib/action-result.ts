/** Typed result of a Server Action (PLAN ground rules: Zod → RPC → typed ActionResult). */
export type ActionResult =
  | { ok: true; message?: string }
  | {
      ok: false;
      error: string;
      code?: string;
      fieldErrors?: Record<string, string>;
    };

/** First error message per field from a Zod error. */
export function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
