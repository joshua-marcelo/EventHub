"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { lookupSchema } from "@/lib/validation/lookup";
import { fieldErrorsFrom, type ActionResult } from "@/lib/action-result";

export async function saveLookup(input: unknown): Promise<ActionResult> {
  const parsed = lookupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  await requireAdmin();
  const { kind, id, ...values } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_lookup", { p_kind: kind, p_id: id!, p_values: values });
  if (error) return { ok: false, error: "Could not save this entry. Try again." };
  if (data !== "ok") {
    const messages: Record<string, string> = { duplicate: "An entry with this name, code or slug already exists.", not_found: "This entry no longer exists. Refresh the page.", college_locked: "A program cannot move to another college.", inactive_college: "Choose an active college for a new program.", not_permitted: "Only administrators can manage lookups." };
    return { ok: false, code: data ?? undefined, error: messages[data ?? ""] ?? "Check the entry's values and try again." };
  }
  revalidatePath("/admin/lookups");
  revalidatePath("/onboarding");
  revalidatePath("/profile");
  revalidatePath("/account/profile");
  return { ok: true, message: "Entry saved." };
}
