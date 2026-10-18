import { z } from "zod";

// Mirrors the CHECK constraints on public.profiles (Phase 1 / 1b migrations).
// Provisional student ID format until the client provides the official one (C2, K-05).
export const STUDENT_ID_PATTERN = /^[A-Za-z0-9-]{4,20}$/;

const requiredName = z.string().trim().min(1, "Required.").max(80, "Use at most 80 characters.");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .transform((v) => (v === "" ? null : v));
const positiveId = (message: string) =>
  z.coerce.number({ error: message }).int(message).positive(message);

export const profileSchema = z.object({
  firstName: requiredName,
  middleName: optionalText(80),
  lastName: requiredName,
  suffix: optionalText(10),
  studentId: z
    .string()
    .trim()
    .regex(STUDENT_ID_PATTERN, "Use 4–20 letters, numbers or hyphens."),
  collegeId: positiveId("Select your college."),
  programId: positiveId("Select your program."),
  yearLevel: z.coerce
    .number({ error: "Select your year level." })
    .int("Select your year level.")
    .min(1, "Select your year level.")
    .max(6, "Select your year level."),
});

// Reuse the existing field rules without requiring student data for account edits.
export const accountProfileSchema = profileSchema.pick({ firstName: true, middleName: true, lastName: true, suffix: true });
export const studentDetailsSchema = profileSchema.pick({ studentId: true, collegeId: true, programId: true, yearLevel: true });
export type AccountProfileInput = z.input<typeof accountProfileSchema>;
export type AccountProfileValues = z.output<typeof accountProfileSchema>;
export type StudentDetailsInput = z.input<typeof studentDetailsSchema>;
export type StudentDetailsValues = z.output<typeof studentDetailsSchema>;

export type ProfileFormInput = z.input<typeof profileSchema>;
export type ProfileFormValues = z.output<typeof profileSchema>;

/** Avatar object path inside the `avatars` bucket: `{userId}/{uuid}.{ext}`. */
export function isOwnAvatarPath(path: string, userId: string): boolean {
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  return new RegExp(`^${userId}/${uuid}\\.(webp|jpg|png)$`, "i").test(path);
}
