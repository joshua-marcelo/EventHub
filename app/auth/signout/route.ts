import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** POST only, so a link or image cannot sign the user out. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin), { status: 303 });
}
