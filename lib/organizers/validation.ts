import { z } from "zod";
import { emailSchema } from "@/lib/validation/auth";

export const inviteOrganizerSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: emailSchema,
});

export type ParticipantMatch = {
  id: string; first_name: string | null; last_name: string | null; email: string;
  student_id: string | null; organizer_status: string; is_complete: boolean | null;
};

export function participantSearch(value: string) {
  return value.replace(/[^\p{L}\p{N}@._\- ]/gu, "").trim().slice(0, 80);
}
