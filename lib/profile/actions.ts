"use server";

import { type ActionResult, fieldErrorsFrom } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/dal";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isOwnAvatarPath, type ProfileFormInput, profileSchema, accountProfileSchema, studentDetailsSchema } from "@/lib/validation/profile";

const NOT_SIGNED_IN: ActionResult = { ok: false, error: "Your session has ended. Log in again.", code: "not_signed_in" };

/** Account-level names only; the actor ID and allowed columns are selected on the server. */
export async function saveAccountProfile(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const parsed = accountProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  const v = parsed.data;
  const { data, error } = await (await createClient()).from("profiles").update({
    first_name: v.firstName, middle_name: v.middleName, last_name: v.lastName, suffix: v.suffix,
  }).eq("id", user.id).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: "Your account details could not be saved. Try again." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Account details saved." };
}

/** Student edits are separate from general account edits, using the same RLS/constraints. */
export async function saveStudentDetails(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const parsed = studentDetailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  const v = parsed.data;
  const { data, error } = await (await createClient()).from("profiles").update({
    student_id: v.studentId, college_id: v.collegeId, program_id: v.programId, year_level: v.yearLevel,
  }).eq("id", user.id).select("id").maybeSingle();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "This student ID is already registered.", fieldErrors: { studentId: "This student ID is already registered. If it is yours, contact an admin." } };
    if (error.code === "23503") return { ok: false, error: "Select a program from your college.", fieldErrors: { programId: "Select a program from your college." } };
    if (error.code === "23514") return { ok: false, error: error.message.includes("locked by an approved event registration") ? "Your student ID and photo are locked while an approved event registration is active." : "Check the student details and try again." };
    return { ok: false, error: "Your student details could not be saved. Try again." };
  }
  if (!data) return { ok: false, error: "Your student details could not be saved. Refresh and try again." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Student details saved." };
}

/** P-06: record consent to the current privacy notice through the database RPC. */
export async function acceptPrivacyNotice(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_privacy_notice", { p_version: PRIVACY_NOTICE_VERSION });
  if (error || data !== "ok") {
    return { ok: false, error: "Your consent could not be saved. Try again.", code: data ?? error?.code };
  }
  return { ok: true };
}

/** Saves the student profile fields. RLS and column grants restrict this to the user's own row. */
export async function saveProfile(input: ProfileFormInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: v.firstName,
      middle_name: v.middleName,
      last_name: v.lastName,
      suffix: v.suffix,
      student_id: v.studentId,
      college_id: v.collegeId,
      program_id: v.programId,
      year_level: v.yearLevel,
    })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "This student ID is already registered.",
        fieldErrors: { studentId: "This student ID is already registered. If it is yours, contact an admin." },
      };
    }
    if (error.code === "23503") {
      return { ok: false, error: "Check the highlighted fields.", fieldErrors: { programId: "Select a program from your college." } };
    }
    if (error.code === "23514") {
      return { ok: false, error: error.message.includes("locked by an approved event registration") ? "Your student ID and photo are locked while an approved event registration is active. Other profile details remain editable." : "Some details are not in the expected format. Check the fields and try again." };
    }
    return { ok: false, error: "Your profile could not be saved. Try again.", code: error.code };
  }
  return { ok: true, message: "Profile saved." };
}

/**
 * Points the profile at a photo the browser just uploaded to the user's own folder, then deletes
 * the previous photo. The upload itself is limited by the Storage policies (own folder only).
 */
export async function setAvatar(path: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  if (!isOwnAvatarPath(path, user.id)) return { ok: false, error: "Upload the photo again.", code: "invalid_path" };

  const supabase = await createClient();
  const previous = user.profile.avatar_path;
  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
  if (error) {
    await supabase.storage.from("avatars").remove([path]);
    return { ok: false, error: error.message.includes("locked by an approved event registration") ? "Your photo is locked while an approved event registration is active." : "Your photo could not be saved. Try again.", code: error.code };
  }
  if (previous && previous !== path) {
    await supabase.storage.from("avatars").remove([previous]);
  }
  return { ok: true, message: "Photo saved." };
}
