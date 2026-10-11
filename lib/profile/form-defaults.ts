import type { CurrentUser } from "@/lib/auth/dal";
import type { ProfileFormInput } from "@/lib/validation/profile";

/** Profile form values from the stored profile (selects need strings). */
export function toFormDefaults(user: CurrentUser): ProfileFormInput {
  const p = user.profile;
  return {
    firstName: p.first_name ?? "",
    middleName: p.middle_name ?? "",
    lastName: p.last_name ?? "",
    suffix: p.suffix ?? "",
    studentId: p.student_id ?? "",
    collegeId: p.college_id ? String(p.college_id) : "",
    programId: p.program_id ? String(p.program_id) : "",
    yearLevel: p.year_level ? String(p.year_level) : "",
  };
}

/** Initials for the avatar fallback. */
export function initialsOf(user: CurrentUser) {
  const first = user.profile.first_name?.[0] ?? user.email[0] ?? "?";
  const last = user.profile.last_name?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}
