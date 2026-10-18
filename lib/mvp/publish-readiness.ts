import type { Tables } from "@/lib/database.types";

type Lookup = { id: number; is_active: boolean };
export type ReadinessItem = { label: string; done: boolean };

/** Mirrors publish_event's requirements so Organizers see what blocks publishing. The RPC stays authoritative. */
export function publishReadiness(e: Pick<Tables<"events">, "description" | "category_id" | "venue" | "starts_at" | "registration_opens_at" | "registration_closes_at" | "host_college_id">, categories: Lookup[], colleges: Lookup[], now = Date.now()): ReadinessItem[] {
  const active = (rows: Lookup[], id: number | null) => rows.some(r => r.id === id && r.is_active);
  return [
    { label: "Description", done: Boolean(e.description?.trim()) },
    { label: "Active category", done: active(categories, e.category_id) },
    { label: "Venue", done: Boolean(e.venue?.trim()) },
    { label: "Start date in the future", done: Boolean(e.starts_at) && Date.parse(e.starts_at!) > now },
    { label: "Registration opening date", done: Boolean(e.registration_opens_at) },
    { label: "Registration deadline", done: Boolean(e.registration_closes_at) },
    ...(e.host_college_id === null ? [] : [{ label: "Active host college", done: active(colleges, e.host_college_id) }]),
  ];
}
