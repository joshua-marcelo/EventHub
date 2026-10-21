"use server";

import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export type InviteResult = { eventId: string } | { error: "unavailable" | "retry" };

/** Invite code → event id via get_event_by_invite_code, which decides availability; registration rules are unchanged. */
export async function resolveInviteCode(raw: string): Promise<InviteResult> {
  await requireUser({ next: "/events?join=1" });
  const code = String(raw ?? "").trim().toUpperCase();
  if (!/^[A-Z2-9]{8}$/.test(code)) return { error: "unavailable" };
  const { data, error } = await (await createClient()).rpc("get_event_by_invite_code", { p_code: code });
  if (error) return { error: "retry" };
  return data ? { eventId: data } : { error: "unavailable" };
}
