import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getMyRegistrations } from "@/lib/participant/registrations";

/** Read-only, authenticated participant queries. Counts are independent of the four-card preview. */
export async function getParticipantDashboard(userId: string) {
  const client = await createClient();
  const [registrations, registered, attended, upcoming] = await Promise.all([
    getMyRegistrations(userId, 4, { throwOnError: true }),
    client.from("event_registrations").select("id", { count: "exact", head: true }).eq("user_id", userId).neq("status", "cancelled"),
    client.from("attendance_records").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "present"),
    // An empty embedded relation provides an anti-join. Filter it to this participant's
    // non-cancelled registrations; RLS independently enforces ownership of those records.
    // Exclusion happens BEFORE limit, so four already-registered events cannot hide discoveries.
    client.from("events").select("id,title,starts_at,venue,event_registrations!event_registrations_event_id_fkey()")
      .eq("status", "published").eq("visibility", "public").gt("starts_at", new Date().toISOString())
      .eq("event_registrations.user_id", userId).neq("event_registrations.status", "cancelled")
      .is("event_registrations", null).order("starts_at").order("id").limit(4),
  ]);
  if (registered.error || attended.error || registered.count === null || attended.count === null) throw new Error("Could not load your participation totals.");
  if (upcoming.error) throw new Error("Could not load upcoming events.");
  return { registrations, registeredCount: registered.count, attendedCount: attended.count, upcoming: upcoming.data };
}

export type ParticipantDashboardData = Awaited<ReturnType<typeof getParticipantDashboard>>;
