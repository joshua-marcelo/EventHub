import "server-only";

import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

/**
 * Organizer Management data. Lists every account with organizer membership (active, suspended or
 * revoked), excluding administrator accounts: admins are managed as admins, and their organizer
 * access is not changeable from here anyway (the server refuses self-changes). Directory
 * classification only; no role or status is changed. Organizer accounts are created directly; retired
 * email invitations are kept in organizer_invitations for history only.
 */
export async function getOrganizerDirectory() {
  const admin = await requireAdmin();
  const client = await createClient();
  const organizers = await client.from("profiles").select("id,first_name,last_name,email,student_id,organizer_status,organizer_status_reason,organizer_since").neq("organizer_status", "none").eq("is_admin", false).order("last_name").limit(200);
  return { admin, organizers };
}
