import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

// Only the link types EventHub sends (sign-up confirmation and password recovery).
const ALLOWED_TYPES = new Set<EmailOtpType>(["email", "signup", "recovery"]);

/**
 * Target of the confirmation and recovery emails:
 * `{SiteURL}/auth/confirm?token_hash=…&type=email|recovery&next={RedirectTo}`.
 * Verifies the token server-side, which creates the session on this device, then redirects
 * without the token in the URL (SYSTEM_SPEC §3.1, §3.3).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type") as EmailOtpType | null;
  const type = rawType && ALLOWED_TYPES.has(rawType) ? rawType : null;
  const isRecovery = type === "recovery";

  let reason = "link_invalid";

  // Older EventHub recovery emails still reach this route. Do not spend their token on
  // a scanner/prefetch GET: the reset form verifies it on password submission instead.
  if (tokenHash && isRecovery) {
    const destination = new URL("/reset-password", origin);
    destination.hash = new URLSearchParams({ token_hash: tokenHash, type: "recovery" }).toString();
    const response = NextResponse.redirect(destination);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      // Recovery always continues to the reset form; confirmation honours the A1 return path.
      const destination = isRecovery
        ? "/reset-password"
        : safeNextPath(searchParams.get("next"), DEFAULT_AFTER_LOGIN, process.env.NEXT_PUBLIC_APP_URL || origin);
      return NextResponse.redirect(new URL(destination, origin));
    }
    if (error.code === "otp_expired") reason = "link_expired";
  }

  const errorUrl = new URL("/auth/error", origin);
  errorUrl.searchParams.set("reason", reason);
  errorUrl.searchParams.set("type", isRecovery ? "recovery" : "signup");
  return NextResponse.redirect(errorUrl);
}
