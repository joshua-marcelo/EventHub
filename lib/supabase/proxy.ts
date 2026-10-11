import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isGuestOnlyPath, isPublicPath } from "@/lib/auth/redirect";
import type { Database } from "@/lib/database.types";

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
    url.searchParams.set("next", `${pathname}${search}`);
    return redirectWithCookies(url, response);
  }

  if (signedIn && isGuestOnlyPath(pathname)) {
    const { data: profile } = await supabase.from("profiles").select("is_admin, is_complete").eq("id", claims!.sub).maybeSingle();
    const url = request.nextUrl.clone();
    url.pathname = profile?.is_admin && !profile.is_complete ? "/admin" : "/dashboard";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  // Reject before the streamed shell starts so unauthorized admin requests have a real
  // HTTP 404. These are optimistic checks; every page/action still uses the DAL + RLS.
  const adminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const organizerPath = pathname === "/organizer" || pathname.startsWith("/organizer/");
  if (signedIn && (adminPath || organizerPath)) {
    const { data: profile } = await supabase.from("profiles").select("is_admin, is_complete, organizer_status").eq("id", claims!.sub).maybeSingle();
    if (adminPath && !profile?.is_admin) {
      const url = request.nextUrl.clone();
      url.pathname = "/_not-found";
      url.search = "";
      const denied = request.method === "GET" || request.method === "HEAD"
        ? NextResponse.rewrite(url, { status: 404 })
        : NextResponse.json({ error: "Not found" }, { status: 404 });
      response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie));
      return denied;
    }
    if (organizerPath && (!profile?.is_complete || profile.organizer_status === "none")) {
      const url = request.nextUrl.clone();
      url.pathname = profile?.is_complete ? "/become-organizer" : "/onboarding";
      url.search = "";
      if (!profile?.is_complete) url.searchParams.set("next", `${pathname}${search}`);
      return redirectWithCookies(url, response);
    }
  }

  return response;
}

// Keep any refreshed session cookies when redirecting.
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
