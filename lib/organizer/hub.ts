import "server-only";

import { requireOrganizer } from "@/lib/auth/dal";
import { publishReadiness } from "@/lib/mvp/publish-readiness";
import { eventLookups } from "@/lib/mvp/queries";
import { canUseOrganizerTools } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";

/*
 * Cross-event Organizer data. Every query is scoped to events where organizer_id = the signed-in
 * user, checked here on the server (not just by RLS): admins can read all events through RLS, but
 * the Organizer workspace only ever shows the user's own. Counts use the same rules as event reports:
 * registrations = approved + pending, attended = attendance records with status 'present'.
 */

const MAX_EVENTS = 500;
type Client = Awaited<ReturnType<typeof createClient>>;
const EVENT_COLUMNS = "id,title,status,starts_at,venue,capacity,approval_mode,description,category_id,host_college_id,registration_opens_at,registration_closes_at";

async function ownedEvents(client: Client, userId: string) {
  const { data, error } = await client.from("events").select(EVENT_COLUMNS).eq("organizer_id", userId).order("starts_at", { ascending: true, nullsFirst: false }).limit(MAX_EVENTS);
  if (error) throw new Error("Could not load your events.");
  return data;
}

async function count(query: PromiseLike<{ count: number | null; error: unknown }>) {
  const { count: n, error } = await query;
  if (error) throw new Error("Could not load event activity.");
  return n ?? 0;
}

export async function getOrganizerOverview(clock?: number) {
  const user = await requireOrganizer({ allowInactive: true });
  const client = await createClient();
  // Read the clock only after request data (cookies) so prerendering treats this as dynamic.
  const now = clock ?? Date.now();
  const events = await ownedEvents(client, user.id);
  const ids = events.map(e => e.id);
  const canAct = canUseOrganizerTools(user);
  if (!ids.length) return { canAct, totals: { events: 0, published: 0, registrations: 0, attended: 0 }, upcoming: [], drafts: [], attention: [] };

  const [registrations, attended, pending] = await Promise.all([
    count(client.from("event_registrations").select("id", { count: "exact", head: true }).in("event_id", ids).in("status", ["approved", "pending"])),
    count(client.from("attendance_records").select("id", { count: "exact", head: true }).in("event_id", ids).eq("status", "present")),
    client.from("event_registrations").select("event_id").in("event_id", ids).eq("status", "pending").limit(5000),
  ]);
  if (pending.error) throw new Error("Could not load event activity.");
  const pendingByEvent = new Map<string, number>();
  for (const r of pending.data) pendingByEvent.set(r.event_id, (pendingByEvent.get(r.event_id) ?? 0) + 1);

  const upcomingEvents = events.filter(e => e.status === "published" && e.starts_at && Date.parse(e.starts_at) >= now).slice(0, 5);
  const upcoming = await Promise.all(upcomingEvents.map(async e => ({
    ...e,
    approved: await count(client.from("event_registrations").select("id", { count: "exact", head: true }).eq("event_id", e.id).eq("status", "approved")),
    pending: pendingByEvent.get(e.id) ?? 0,
  })));

  const draftEvents = events.filter(e => e.status === "draft");
  const lookups = draftEvents.length ? await eventLookups() : null;
  const drafts = draftEvents.map(e => {
    const missing = publishReadiness(e, lookups!.categories, lookups!.colleges, now).filter(i => !i.done).map(i => i.label);
    return { id: e.id, title: e.title, starts_at: e.starts_at, missing };
  });

  // Only real, actionable items: pending approvals on published events, and drafts that cannot be published yet.
  const attention = [
    ...events.filter(e => e.status === "published" && pendingByEvent.get(e.id)).map(e => ({ kind: "pending" as const, id: e.id, title: e.title, count: pendingByEvent.get(e.id)! })),
    ...(canAct ? drafts.filter(d => d.missing.length).map(d => ({ kind: "incomplete" as const, id: d.id, title: d.title, count: d.missing.length })) : []),
  ];

  return {
    canAct,
    totals: { events: events.length, published: events.filter(e => e.status === "published").length, registrations, attended },
    upcoming, drafts, attention,
  };
}

export const SIDEBAR_EVENT_LIMIT = 5;
export type SidebarEvent = { id: string; title: string; status: string; starts_at: string | null };

/**
 * A few of the signed-in Organizer's own events for the sidebar's My Events: live and upcoming
 * published events first (soonest first), then drafts, then recently finished ones. Never another
 * organizer's events, and never the whole history.
 */
export async function getSidebarEvents(userId: string, clock?: number): Promise<{ events: SidebarEvent[]; more: boolean }> {
  const client = await createClient();
  const { data, error, count } = await client.from("events").select("id,title,status,starts_at,ends_at", { count: "exact" })
    .eq("organizer_id", userId).neq("status", "cancelled").order("starts_at", { ascending: true, nullsFirst: false }).limit(40);
  if (error) return { events: [], more: false };
  const now = clock ?? Date.now();
  const ended = (e: (typeof data)[number]) => Date.parse(e.ends_at ?? e.starts_at ?? "") < now;
  const rank = (e: (typeof data)[number]) => e.status === "published" && !ended(e) ? 0 : e.status === "draft" ? 1 : 2;
  const ordered = data.map((e, i) => ({ e, i })).sort((a, b) => rank(a.e) - rank(b.e) || (rank(a.e) === 2 ? b.i - a.i : a.i - b.i)).map(({ e }) => e);
  return {
    events: ordered.slice(0, SIDEBAR_EVENT_LIMIT).map(({ id, title, status, starts_at }) => ({ id, title, status, starts_at })),
    more: (count ?? data.length) > SIDEBAR_EVENT_LIMIT,
  };
}
