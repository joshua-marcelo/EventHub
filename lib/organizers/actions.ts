"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { type ActionResult, fieldErrorsFrom } from "@/lib/action-result";
import { inviteOrganizerSchema, participantSearch, type ParticipantMatch } from "./validation";

const messages: Record<string, string> = {
  existing_account: "This email already has an account. Use Promote Participant instead.",
  already_invited: "This email already has an invitation. Open Pending Invitations to retry or resend it.",
  already_active: "This account is already an active Organizer.",
  inactive_organizer: "Use the existing status controls for suspended or revoked Organizers. Promotion cannot reactivate them.",
  not_eligible: "This account is not eligible. Promotion requires a confirmed, complete Participant profile; invitations require an unaccepted identity.",
  retry_later: "An invitation is being sent or was recently attempted. Please wait before retrying.",
  not_permitted: "You do not have permission for this operation.",
  not_configured: "Organizer invitations are not configured on this server. Set SUPABASE_SECRET_KEY and a valid NEXT_PUBLIC_APP_URL. No invitation was created.",
  migration_pending: "Organizer management requires the pending database migration. No Organizer access was granted.",
  invite_email_failed: "The invitation email could not be sent. Check the Supabase Auth SMTP settings, then use Resend under Pending Invitations. No Organizer access was granted.",
};
// PostgREST/Postgres codes for an RPC that does not exist yet (migration not applied).
const MISSING_RPC = new Set(["PGRST202", "42883"]);
function failure(code?: string): ActionResult {
  return { ok: false, code, error: messages[code ?? ""] ?? "Could not complete this operation. Refresh and try again. No Organizer access was granted." };
}
const leaseSchema = z.object({ code: z.literal("ok"), id: z.uuid(), email: z.email(), first_name: z.string(), last_name: z.string(), attempt_id: z.uuid(), created_at: z.string() });
function resultCode(value: unknown, error?: { code?: string } | null) {
  if (error?.code && MISSING_RPC.has(error.code)) return "migration_pending";
  return value && typeof value === "object" && "code" in value && typeof value.code === "string" ? value.code : undefined;
}
class InvitationStageError extends Error {
  constructor(readonly stage: string, readonly code?: string) { super(stage); }
}
/** Server-side diagnostics only: invitation ID, stage and provider error metadata. Never emails, tokens or secrets. */
function logInvitationFailure(id: string, stage: string, error: unknown) {
  const e = (error && typeof error === "object" ? error : {}) as { name?: unknown; code?: unknown; status?: unknown };
  console.error("[organizer-invitation] failed", {
    invitationId: id, stage,
    errorName: typeof e.name === "string" ? e.name : undefined,
    errorCode: typeof e.code === "string" ? e.code : undefined,
    status: typeof e.status === "number" ? e.status : undefined,
  });
}
/** Server configuration required to send invitations; null when incomplete. */
function invitationConfig() {
  try { return { admin: createAdminClient(), origin: invitationOrigin() }; } catch { return null; }
}
function invitationOrigin() {
  const origin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "");
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/"
    || (origin.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname)))) {
    throw new Error("Configure the application origin before inviting organizers.");
  }
  return origin.origin;
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
    if (error || data !== "ok") return failure(error ? resultCode(null, error) : data ?? undefined);
    revalidatePath("/", "layout");
    return { ok: true, message: "Organizer access granted to the existing Participant account." };
  } catch (error) { unstable_rethrow(error); return failure(); }
}

export async function inviteOrganizer(input: unknown): Promise<ActionResult> {
  const actor = await requireAdmin();
  const parsed = inviteOrganizerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the invitation fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  // Validate configuration before reserving or creating an identity.
  const config = invitationConfig();
  if (!config) return failure("not_configured");
  try {
    const { data, error } = await (await createClient()).rpc("reserve_organizer_invitation", {
      p_email: parsed.data.email, p_first_name: parsed.data.firstName, p_last_name: parsed.data.lastName,
    });
    const reservation = z.object({ code: z.literal("ok"), id: z.uuid() }).safeParse(data);
    if (error || !reservation.success) return failure(resultCode(data, error));
    return await deliverInvitation(reservation.data.id, actor.id, config.admin, config.origin);
  } catch (error) { unstable_rethrow(error); return failure(); }
}

export async function resendOrganizerInvitation(id: string): Promise<ActionResult> {
  const actor = await requireAdmin();
  if (!z.uuid().safeParse(id).success) return failure("invalid_input");
  const config = invitationConfig();
  if (!config) return failure("not_configured");
  try { return await deliverInvitation(id, actor.id, config.admin, config.origin); }
  catch (error) { unstable_rethrow(error); return failure(); }
}

async function deliverInvitation(id: string, actorId: string, admin: ReturnType<typeof createAdminClient>, origin: string): Promise<ActionResult> {
  const { data, error } = await (await createClient()).rpc("acquire_organizer_invitation", { p_id: id });
  const lease = leaseSchema.safeParse(data);
  if (error || !lease.success) return failure(resultCode(data, error));
  const v = lease.data;
  const finish = (sent: boolean) => admin.rpc("finish_organizer_invitation", { p_id: v.id, p_attempt_id: v.attempt_id, p_actor_id: actorId, p_sent: sent });
  try {
    // The Auth ID is preallocated by the database. Creating it separately (without a
    // password or email confirmation) prevents a concurrent signup from being adopted.
    const existing = await admin.auth.admin.getUserById(v.id);
    if (existing.error && existing.error.code !== "user_not_found") { logInvitationFailure(v.id, "identity_lookup", existing.error); throw new InvitationStageError("identity_lookup"); }
    let user = existing.data.user;
    if (!user) {
      const created = await admin.auth.admin.createUser({ id: v.id, email: v.email, email_confirm: false, user_metadata: { first_name: v.first_name, last_name: v.last_name } });
      if (created.error || !created.data.user) {
        logInvitationFailure(v.id, "create_user", created.error);
        await finish(false);
        revalidatePath("/admin/organizers");
        return failure(["email_exists", "email_exists_in_auth", "user_already_exists"].includes(created.error?.code ?? "") ? "existing_account" : undefined);
      }
      user = created.data.user;
    }
    if (user.id !== v.id || user.email?.toLowerCase() !== v.email || user.email_confirmed_at
      || Date.parse(user.created_at) < Date.parse(v.created_at)) throw new InvitationStageError("identity_mismatch");
    // Recheck the actor immediately before the email-producing Admin API operation.
    const actor = await requireAdmin();
    if (actor.id !== actorId) throw new InvitationStageError("actor_changed");
    const sent = await admin.auth.admin.inviteUserByEmail(v.email, { redirectTo: `${origin}/accept-invitation` });
    // Supabase reports SMTP failures (e.g. "535 Authentication failed") as a 5xx from /invite.
    if (sent.error) { logInvitationFailure(v.id, "invite_email", sent.error); throw new InvitationStageError("invite_email", "invite_email_failed"); }
    if (sent.data.user?.id !== v.id) throw new InvitationStageError("invite_identity_mismatch");
    const final = await finish(true);
    if (final.error || final.data !== "ok") {
      logInvitationFailure(v.id, "finalize", final.error ?? { code: final.data });
      return { ok: false, error: "The email request was accepted, but the invitation could not be finalized. Contact an administrator. Organizer access remains inactive." };
    }
    revalidatePath("/admin/organizers");
    return { ok: true, message: "Invitation accepted by the email service. Organizer access activates after secure account setup." };
  } catch (error) {
    unstable_rethrow(error);
    if (!(error instanceof InvitationStageError)) logInvitationFailure(v.id, "unexpected", error);
    else if (!["identity_lookup", "invite_email"].includes(error.stage)) logInvitationFailure(v.id, error.stage, null);
    // Never report delivery on uncertainty. Do not delete identities or grant access.
    try { await finish(false); } catch { /* A stale sending lease can be retried after five minutes. */ }
    revalidatePath("/admin/organizers");
    return failure(error instanceof InvitationStageError ? error.code : undefined);
  }
}
