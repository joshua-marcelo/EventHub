import "server-only";

import { headers } from "next/headers";

/**
 * Public origin of the app, used for links in auth emails. Prefers NEXT_PUBLIC_APP_URL (C19);
 * falls back to the request host for local development. Supabase only accepts redirect URLs on
 * its allow-list, so a spoofed Host header cannot send links to another site.
 */
export async function getAppOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
