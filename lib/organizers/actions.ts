"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";
import { participantSearch, type ParticipantMatch } from "./validation";

// New Organizer accounts are created directly (lib/admin/accounts.ts). Email invitations are retired.
const messages: Record<string, string> = {
  already_active: "This account is already an active Organizer.",
  inactive_organizer: "Use the existing status controls for suspended or revoked Organizers. Promotion cannot reactivate them.",
  not_eligible: "This account is not eligible. Promotion requires a confirmed, complete Participant profile.",
  not_permitted: "You do not have permission for this operation.",
  migration_pending: "Organizer management requires the pending database migration. No Organizer access was granted.",
};
// PostgREST/Postgres codes for an RPC that does not exist yet (migration not applied).
const MISSING_RPC = new Set(["PGRST202", "42883"]);
function failure(code?: string): ActionResult {
  return { ok: false, code, error: messages[code ?? ""] ?? "Could not complete this operation. Refresh and try again. No Organizer access was granted." };
}

export async function searchParticipants(query: string): Promise<{ ok: true; rows: ParticipantMatch[] } | { ok: false; error: string }> {
  await requireAdmin();
  const q = participantSearch(typeof query === "string" ? query : "");
  if (q.length < 2) return { ok: true, rows: [] };
  try {
    const { data, error } = await (await createClient()).from("profiles")
      .select("id,first_name,last_name,email,student_id,organizer_status,is_complete")
      .or(["first_name", "last_name", "email", "student_id"].map(c => `${c}.ilike.%${q}%`).join(","))
      .order("last_name").limit(20);
    return error ? { ok: false, error: "Could not search participants. Try again." } : { ok: true, rows: data };
  } catch (error) { unstable_rethrow(error); return { ok: false, error: "Could not search participants. Check your connection." }; }
}

export async function promoteParticipant(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return failure("invalid_input");
  try {
    const { data, error } = await (await createClient()).rpc("promote_participant_to_organizer", { p_user_id: id });
    if (error || data !== "ok") return failure(error ? (MISSING_RPC.has(error.code) ? "migration_pending" : undefined) : data ?? undefined);
    revalidatePath("/", "layout");
    return { ok: true, message: "Organizer access granted to the existing Participant account." };
  } catch (error) { unstable_rethrow(error); return failure(); }
}
