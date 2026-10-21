import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isGuestOnlyPath, isPublicPath } from "@/lib/auth/redirect";
import type { Database } from "@/lib/database.types";
import { CHANGE_PASSWORD_PATH, canViewOrganizerWorkspace, homeFor } from "@/lib/navigation";

// Postgres undefined_column.
const MISSING_COLUMN = "42703";

/**
 * Refreshes the Supabase session cookie on every request and performs the optimistic
 * route checks (SYSTEM_SPEC §16.2). The real authorization is the DAL + RLS.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims(): it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  // Anonymous sign-ins are disabled (D-019); an anonymous session is treated as signed out.
  const signedIn = Boolean(claims?.sub) && claims?.is_anonymous !== true;

  const { pathname, search } = request.nextUrl;

  if (!signedIn && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const nextSearch = new URLSearchParams(search);
    if (pathname === "/scan") nextSearch.delete("t");
    url.searchParams.set("next", `${pathname}${nextSearch.size ? "?" + nextSearch.toString() : ""}`);
    return redirectWithCookies(url, response);
  }
  if (!signedIn || (isPublicPath(pathname) && !isGuestOnlyPath(pathname))) return response;

  // Signed in on a protected or guest-only path: one profile read drives every optimistic check below.
  const profile = await readAccess(supabase, claims!.sub);
  const permissions = { isAdmin: profile?.is_admin ?? false, organizerStatus: profile?.organizer_status ?? "none" } as const;

  // A temporary password unlocks only the Change Password page and logging out. Pages, route
  // handlers and actions also enforce this through the DAL; this keeps direct URLs from rendering.
  if (profile?.must_change_password && pathname !== CHANGE_PASSWORD_PATH && pathname !== "/auth/signout") {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return withCookies(NextResponse.json({ error: "Password change required" }, { status: 403 }), response);
    }
    const url = request.nextUrl.clone();
    url.pathname = CHANGE_PASSWORD_PATH;
    url.search = "";
    return redirectWithCookies(url, response);
  }

  if (isGuestOnlyPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = homeFor(permissions);
    url.search = "";
    return redirectWithCookies(url, response);
  }

  // Reject before the streamed shell starts so unauthorized admin requests have a real
  // HTTP 404. These are optimistic checks; every page/action still uses the DAL + RLS.
  const adminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const organizerPath = pathname === "/organizer" || pathname.startsWith("/organizer/");
  if (adminPath && !permissions.isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = "/_not-found";
    url.search = "";
    const denied = request.method === "GET" || request.method === "HEAD"
      ? NextResponse.rewrite(url, { status: 404 })
      : NextResponse.json({ error: "Not found" }, { status: 404 });
    return withCookies(denied, response);
  }
  if (organizerPath && !canViewOrganizerWorkspace(permissions)) {
    // Not an Organizer (Administrators included, unless granted): go to the account's own home.
    const url = request.nextUrl.clone();
    url.pathname = homeFor(permissions);
    url.search = "";
    return redirectWithCookies(url, response);
  }

  return response;
}

/** Role flags and the password-change flag. Before migration 20261021120000 the flag column does not exist yet. */
async function readAccess(supabase: ReturnType<typeof createServerClient<Database>>, id: string) {
  const current = await supabase.from("profiles").select("is_admin, organizer_status, must_change_password").eq("id", id).maybeSingle();
  if (current.error?.code !== MISSING_COLUMN) return current.data;
  const legacy = await supabase.from("profiles").select("is_admin, organizer_status").eq("id", id).maybeSingle();
  return legacy.data && { ...legacy.data, must_change_password: false };
}

// Keep any refreshed session cookies when redirecting or refusing.
function withCookies(to: NextResponse, from: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}
function redirectWithCookies(url: URL, from: NextResponse) {
  return withCookies(NextResponse.redirect(url), from);
}
