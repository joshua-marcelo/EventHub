import "server-only";

import type { MyRegistration } from "@/lib/participant/labels";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in user's own registrations (RLS limits rows to their own), newest event first, with
 * the real attendance status. Cancelled registrations are left out of the sidebar list.
 */
export async function getMyRegistrations(userId: string, limit = 8, { throwOnError = false }: { throwOnError?: boolean } = {}): Promise<MyRegistration[]> {
  const client = await createClient();
  const { data: regs, error } = await client.from("event_registrations").select("id,event_id,status,events!event_registrations_event_id_fkey(title,starts_at,status)")
    .eq("user_id", userId).neq("status", "cancelled").order("registered_at", { ascending: false }).limit(limit);
  if (error && throwOnError) throw new Error("Could not load your registered events.");
  if (error || !regs?.length) return [];
  const { data: attendance, error: attendanceError } = await client.from("attendance_records").select("registration_id,status").eq("user_id", userId).in("registration_id", regs.map(r => r.id));
  if (attendanceError && throwOnError) throw new Error("Could not load your attendance statuses.");
  return regs.flatMap(r => r.events ? [{
    id: r.id, eventId: r.event_id, title: r.events.title, startsAt: r.events.starts_at, eventStatus: r.events.status, status: r.status,
    attendance: attendance?.find(a => a.registration_id === r.id)?.status ?? null,
  }] : []);
}

