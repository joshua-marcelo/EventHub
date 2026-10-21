import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { CHANGE_PASSWORD_PATH, canUseOrganizerTools, canViewOrganizerWorkspace, homeFor } from "@/lib/navigation";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type CurrentProfile = Pick<
  ProfileRow,
  | "first_name"
  | "middle_name"
  | "last_name"
  | "suffix"
  | "student_id"
  | "college_id"
  | "program_id"
  | "year_level"
  | "avatar_path"
  | "privacy_consented_at"
  | "is_complete"
  | "identity_flagged_at"
>;

export type CurrentUser = {
  id: string;
  email: string;
  profile: CurrentProfile;
  isComplete: boolean;
  isAdmin: boolean;
  organizerStatus: ProfileRow["organizer_status"];
  /** Admin-created or Admin-reset account still on its temporary password. Server-controlled. */
  mustChangePassword: boolean;
};

const PROFILE_COLUMNS =
  "first_name, middle_name, last_name, suffix, student_id, college_id, program_id, year_level, avatar_path, privacy_consented_at, is_complete, identity_flagged_at, is_admin, organizer_status, must_change_password";
const LEGACY_PROFILE_COLUMNS =
  "first_name, middle_name, last_name, suffix, student_id, college_id, program_id, year_level, avatar_path, privacy_consented_at, is_complete, identity_flagged_at, is_admin, organizer_status";

/**
 * The signed-in permanent user with their profile, or null. Verifies the JWT with getClaims()
 * (never trusts getSession()), then reads the profile through RLS. Cached per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub || claims.is_anonymous === true) return null;

  const current = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", claims.sub).maybeSingle();
  // Before migration 20261021120000 the password-change flag does not exist: read without it.
  const row = current.error?.code === "42703"
    ? await supabase.from("profiles").select(LEGACY_PROFILE_COLUMNS).eq("id", claims.sub).maybeSingle().then(r => r.data && { ...r.data, must_change_password: false })
    : current.data;
  if (!row) return null;

  const { is_admin, organizer_status, must_change_password, ...profile } = row;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    profile,
    isComplete: profile.is_complete === true,
    isAdmin: is_admin,
    organizerStatus: organizer_status,
    mustChangePassword: must_change_password === true,
  };
});

type RequireUserOptions = {
  /** Allow users whose profile is not complete yet (onboarding, profile, privacy). */
  allowIncomplete?: boolean;
  /** Path to return to after login or onboarding. */
  next?: string;
  /** Only the Change Password page may be used while a temporary password is still active. */
  allowTemporaryPassword?: boolean;
};

/** Signed-in user or redirect to login; incomplete profiles go to onboarding first. */
export async function requireUser({ allowIncomplete = false, next, allowTemporaryPassword = false }: RequireUserOptions = {}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  if (!allowTemporaryPassword && user.mustChangePassword) redirect(CHANGE_PASSWORD_PATH);
  if (!allowIncomplete && !user.isComplete) {
    redirect(next ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding");
  }
  return user;
}

/** Admin pages: anyone else gets a 404 so admin routes are not revealed (PLAN Phase 3). */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) notFound();
  if (user.mustChangePassword) redirect(CHANGE_PASSWORD_PATH);
  return user;
}

/** Organizer pages: active organizers. Suspended/revoked organizers may read their own events when allowed. Admins are not Organizers unless granted. */
export async function requireOrganizer({ allowInactive = false }: { allowInactive?: boolean } = {}) {
  // Organizer authorization is independent of student-profile completion.
  const user = await requireUser({ allowIncomplete: true });
  const ok = canUseOrganizerTools(user) || (allowInactive && canViewOrganizerWorkspace(user));
  if (!ok) redirect(homeFor(user));
  return user;
}
