import { z } from "zod";
import { combineManilaDateTime } from "@/lib/datetime";

export const idSchema = z.uuid();
const optionalText = (min: number, max: number) => z.string().trim().max(max).refine(v => !v || v.length >= min, `Use at least ${min} characters.`).transform(v => v || null);
const optionalId = z.union([z.coerce.number().int().positive().max(32767), z.literal("")]).transform(v => v === "" ? null : v);
const dateTime = z.string().refine(v => {
  if (!v) return true;
  try { const [date,time] = v.split("T"); combineManilaDateTime(date,time); return true; } catch { return false; }
}, "Enter a valid Philippine date and time.").transform(v => v ? combineManilaDateTime(...v.split("T") as [string,string]).toISOString() : null);

export const applicationSchema = z.object({
  organization_name: z.string().trim().min(3).max(150),
  position_title: z.string().trim().min(2).max(100),
  contact_number: z.string().trim().regex(/^(\+63|0)9\d{9}$/, "Use a Philippine mobile number."),
  reason: z.string().trim().min(50).max(1000),
  proof_document_path: z.string().min(1).max(250),
  supporting_document_path: z.string().max(250).optional(),
  consent: z.literal(true),
});
export const eventSchema = z.object({
  title: z.string().trim().min(5).max(150),
  // Any non-empty description (the events table allows 1–5000 characters after migration 20261022100000).
  description: optionalText(1, 5000), venue: optionalText(3, 200),
  category_id: optionalId, host_college_id: optionalId,
  starts_at: dateTime, ends_at: dateTime,
  registration_opens_at: dateTime, registration_closes_at: dateTime,
  capacity: z.union([z.coerce.number().int().min(1).max(5000),z.literal("")]).transform(v => v === "" ? null : v),
  approval_mode: z.enum(["automatic", "manual"]), visibility: z.enum(["public", "unlisted"]),
}).superRefine((v, ctx) => {
  if (v.ends_at && (!v.starts_at || v.ends_at <= v.starts_at || Date.parse(v.ends_at) - Date.parse(v.starts_at) > 7 * 86400000)) ctx.addIssue({ code: "custom", path: ["ends_at"], message: "The end must be after the start, within 7 days." });
  if (v.registration_opens_at && v.registration_closes_at && v.registration_opens_at >= v.registration_closes_at) ctx.addIssue({ code: "custom", path: ["registration_closes_at"], message: "Deadline must follow registration opening." });
  if (v.registration_closes_at && v.starts_at && v.registration_closes_at > v.starts_at) ctx.addIssue({ code: "custom", path: ["registration_closes_at"], message: "Deadline cannot follow the event start." });
});
export const reasonSchema = z.string().trim().min(1, "Enter a reason.").max(1000);
export const documentTypes = ["application/pdf", "image/jpeg", "image/png"];
export const documentMaxBytes = 5 * 1024 * 1024;

type RegistrationWindow = { starts_at: string | null; registration_opens_at: string | null; registration_closes_at: string | null };
/**
 * The simplified form defaults the permitted window to save time through the event start.
 * Registration also requires explicit organizer permission. Explicit dates are kept. Opening is left empty when the
 * start has already passed, so the database's opens-before-closes rule is never violated.
 */
export function withRegistrationDefaults<T extends RegistrationWindow>(v: T, now = Date.now()): T {
  const closes = v.registration_closes_at ?? v.starts_at;
  const opens = v.registration_opens_at ?? (closes && Date.parse(closes) > now ? new Date(now).toISOString() : null);
  return { ...v, registration_opens_at: opens, registration_closes_at: closes };
}
