"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireOrganizer, requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fieldErrorsFrom } from "@/lib/action-result";
import { applicationSchema, eventSchema, idSchema, reasonSchema } from "@/lib/validation/mvp";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";

const messages: Record<string, string> = {
  not_permitted: "You do not have permission for this action.", not_eligible: "A complete profile and eligible organizer status are required.",
  already_pending: "You already have a pending application.", invalid_document: "Upload your proof document again.",
  consent_required: "Accept the privacy notice.", invalid_input: "Check the form values.", self_review: "Another administrator must review your application.",
  already_reviewed: "This application has already been reviewed.", not_pending: "This request is no longer pending.",
  not_found: "This item is unavailable.", incomplete_event: "Complete the description, category, venue, future start, and registration dates before publishing.",
  inactive_lookup: "Choose active category and college entries.", event_full: "This event has reached capacity.",
  registration_closed: "Registration is closed.", profile_incomplete: "Complete your profile first.", own_event: "You cannot register for your own event.",
  capacity_too_small: "Capacity cannot be lower than approved registrations.", terminal_event: "Cancelled and completed events cannot be edited.",
  invalid_status: "This action is unavailable for the current status.", reason_required: "Enter a reason.", rejected: "Your registration was rejected. Contact the organizer.",
};
function result(code: string | null, error: unknown): ActionResult {
  if (error) return { ok: false, error: "Could not save changes. Try again." };
  if (code === "ok" || code === "approved" || code === "pending") return { ok: true, message: code === "pending" ? "Registration submitted for approval." : code === "approved" ? "Registration approved." : "Saved." };
  return { ok: false, code: code ?? undefined, error: messages[code ?? ""] ?? "Could not save changes. Refresh and try again." };
}
function refresh() {
  revalidatePath("/", "layout");
}

export async function submitApplication(input: unknown): Promise<ActionResult> {
  const v = applicationSchema.safeParse(input);
  if (!v.success) return { ok: false, error: "Check application fields and privacy consent.", fieldErrors: fieldErrorsFrom(v.error.issues) };
  const user = await requireUser({ next: "/become-organizer" });
  if (!["none", "revoked"].includes(user.organizerStatus)) return result("not_eligible", null);
  const { data, error } = await (await createClient()).rpc("submit_organizer_application", { p_values: { ...v.data, privacy_notice_version: PRIVACY_NOTICE_VERSION } });
  const code = data && typeof data === "object" && !Array.isArray(data) ? String(data.code) : null;
  const r = result(code, error); if (r.ok) refresh(); return r;
}
export async function withdrawApplication(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return result("invalid_input", null);
  await requireUser();
  const { data, error } = await (await createClient()).rpc("withdraw_organizer_application", { p_id: id });
  const r = result(data, error); if (r.ok) refresh(); return r;
}
export async function reviewApplication(id: string, decision: "approved" | "rejected", reason: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success || !["approved", "rejected"].includes(decision) || reason.length > 1000 || (decision === "rejected" && !reasonSchema.safeParse(reason).success)) return result("reason_required", null);
  await requireAdmin();
  const { data, error } = await (await createClient()).rpc("review_organizer_application", { p_id: id, p_decision: decision, p_reason: reason });
  const r = result(data, error); if (r.ok) refresh(); return r;
}
export async function changeOrganizerStatus(id: string, status: "active" | "suspended" | "revoked", reason: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success || !["active", "suspended", "revoked"].includes(status) || !reasonSchema.safeParse(reason).success) return result("reason_required", null);
  await requireAdmin();
  const { data, error } = await (await createClient()).rpc("set_organizer_status", { p_user_id: id, p_status: status, p_reason: reason });
  const r = result(data, error); if (r.ok) refresh(); return r;
}
export async function saveEvent(id: string | null, input: unknown): Promise<ActionResult> {
  const v = eventSchema.safeParse(input);
  if (!v.success) return { ok: false, error: "Check the event fields.", fieldErrors: fieldErrorsFrom(v.error.issues) };
  if (id !== null && !idSchema.safeParse(id).success) return result("invalid_input", null);
  const user = await requireOrganizer();
  const client = await createClient();
  if (id) {
    const { data } = await client.from("events").select("organizer_id").eq("id", id).maybeSingle();
    if (data?.organizer_id !== user.id) return result("not_permitted", null);
  }
  const { data, error } = await client.rpc("save_event", { p_id: id!, p_values: v.data });
  const payload = data && typeof data === "object" && !Array.isArray(data) ? data : null;
  const r = result(payload ? String(payload.code) : null, error);
  if (!r.ok) return r;
  refresh(); redirect(`/organizer/events/${payload!.id}`);
}
export async function eventAction(id: string, action: "publish" | "delete" | "cancel", reason = ""): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success || !["publish", "delete", "cancel"].includes(action)) return result("invalid_input", null);
  const user = await requireUser({ allowIncomplete: action === "cancel" });
  const client = await createClient();
  const { data: event } = await client.from("events").select("organizer_id").eq("id", id).maybeSingle();
  if (!event || !(event.organizer_id === user.id && user.organizerStatus === "active" || action === "cancel" && user.isAdmin)) return result("not_permitted", null);
  if (action === "cancel" && !reasonSchema.safeParse(reason).success) return result("reason_required", null);
  const response = action === "publish" ? await client.rpc("publish_event", { p_id: id }) : action === "delete" ? await client.rpc("delete_event_draft", { p_id: id }) : await client.rpc("cancel_event", { p_id: id, p_reason: reason });
  const r = result(response.data, response.error);
  if (r.ok) { refresh(); if (action === "delete") redirect("/organizer/events"); } return r;
}
export async function registrationAction(eventId: string, action: "register" | "cancel"): Promise<ActionResult> {
  if (!idSchema.safeParse(eventId).success || !["register", "cancel"].includes(action)) return result("invalid_input", null);
  await requireUser({ next: `/events/${eventId}` });
  const client = await createClient();
  const { data, error } = action === "register" ? await client.rpc("register_for_event", { p_event_id: eventId }) : await client.rpc("cancel_registration", { p_event_id: eventId });
  const r = result(data, error); if (r.ok) refresh(); return r;
}
export async function decideRegistration(id: string, decision: "approved" | "rejected", reason: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success || !["approved", "rejected"].includes(decision) || reason.length > 1000) return result("invalid_input", null);
  const user = await requireOrganizer();
  const client = await createClient();
  const { data: registration } = await client.from("event_registrations").select("event_id").eq("id", id).maybeSingle();
  const { data: event } = registration ? await client.from("events").select("organizer_id").eq("id", registration.event_id).maybeSingle() : { data: null };
  if (event?.organizer_id !== user.id) return result("not_permitted", null);
  const { data, error } = await client.rpc("decide_registration", { p_id: id, p_decision: decision, p_reason: reason });
  const r = result(data, error); if (r.ok) refresh(); return r;
}
