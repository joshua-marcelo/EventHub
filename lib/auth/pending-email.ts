import "server-only";

import { cookies } from "next/headers";

// Remembers which address the "check your email" page is about, without putting it in the URL.
const PENDING_EMAIL_COOKIE = "eh_pending_email";

export async function rememberPendingEmail(email: string) {
  (await cookies()).set(PENDING_EMAIL_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });
}

export async function readPendingEmail(): Promise<string | null> {
  return (await cookies()).get(PENDING_EMAIL_COOKIE)?.value ?? null;
}

/** "juan.delacruz@gmail.com" → "ju•••@gmail.com" for display. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "your email address";
  return `${local.slice(0, 2)}•••@${domain}`;
}
