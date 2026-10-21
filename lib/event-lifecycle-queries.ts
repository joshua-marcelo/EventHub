import "server-only";
import { createClient } from "@/lib/supabase/server";
import { lifecycleSchema } from "@/lib/event-lifecycle";

export async function getEventLifecycle(eventId: string) {
  const { data, error } = await (await createClient()).rpc("get_event_lifecycle", { p_event_id: eventId });
  const parsed = lifecycleSchema.safeParse(data);
  // Missing migration or failed reads must never advertise an action as available.
  return error || !parsed.success ? null : parsed.data;
}
