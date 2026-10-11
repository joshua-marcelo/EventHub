import "server-only";
import type { Tables } from "@/lib/database.types";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
export type LookupData = { colleges: Tables<"colleges">[]; programs: Tables<"programs">[]; event_categories: Tables<"event_categories">[] };
export async function getLookups(): Promise<LookupData> {
  await requireAdmin();
  const supabase = await createClient();
  const [colleges, programs, categories] = await Promise.all([
    supabase.from("colleges").select("*").order("name"),
    supabase.from("programs").select("*").order("name"),
    supabase.from("event_categories").select("*").order("sort_order").order("name"),
  ]);
  if (colleges.error || programs.error || categories.error) throw new Error("Could not load lookups.");
  return { colleges: colleges.data, programs: programs.data, event_categories: categories.data };
}
