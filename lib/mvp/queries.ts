import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireOrganizer } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/mvp";

/** Request-deduplicated: the event workspace layout and its tab page share one lookup. */
export const getOwnedEvent = cache(async (id: string) => {
  const user = await requireOrganizer({ allowInactive: true });
  if (!idSchema.safeParse(id).success) notFound();
  const { data, error } = await (await createClient()).from("events").select("*").eq("id", id).eq("organizer_id", user.id).maybeSingle();
  if (error) throw new Error("Could not load event.");
  if (!data) notFound();
  return { event: data, user };
});
export async function eventLookups() {
  const client = await createClient();
  const [categories, colleges] = await Promise.all([client.from("event_categories").select("id,name,is_active").order("sort_order"),client.from("colleges").select("id,name,is_active").order("name")]);
  if (categories.error || colleges.error) throw new Error("Could not load event choices.");
  return { categories: categories.data, colleges: colleges.data };
}
