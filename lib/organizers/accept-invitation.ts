"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { type ActionResult, fieldErrorsFrom } from "@/lib/action-result";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { authErrorMessage } from "@/lib/auth/messages";
import { clearProof, hashProof, newProof, readProof, rememberProof } from "./acceptance-proof";

const invalid = (): ActionResult => ({ ok: false, code: "invitation_invalid", error: "This invitation is invalid, expired, already accepted, or no longer eligible. Ask an administrator for help." });

export async function acceptOrganizerInvitation(input: unknown, tokenHash?: string): Promise<ActionResult & { invitationVerified?: boolean }> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the password fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  let invitationVerified = false;
  try {
    const client = await createClient();
    const admin = createAdminClient();
    let proof = await readProof();
    if (tokenHash !== undefined) {
      if (!z.string().min(1).max(512).safeParse(tokenHash).success) return invalid();
      const verified = await client.auth.verifyOtp({ type: "invite", token_hash: tokenHash });
      const user = verified.data.user;
      if (verified.error || !user?.email || user.is_anonymous) return invalid();
      proof = newProof();
      const begun = await admin.rpc("begin_organizer_acceptance", { p_user_id: user.id, p_email: user.email, p_hash: hashProof(proof) });
      if (begun.error || begun.data !== "ok") return invalid();
      await rememberProof(proof);
      invitationVerified = true;
    }
    if (!proof) return invalid();
    // A normal session or user-controlled metadata alone never authorizes activation.
    const { data, error } = await client.auth.getUser();
    if (error || !data.user || data.user.is_anonymous) return invalid();
    const args = { p_user_id: data.user.id, p_hash: hashProof(proof) };
    const checked = await admin.rpc("check_organizer_acceptance", args);
    if (checked.error || checked.data !== "ok") return invalid();
    const updated = await client.auth.updateUser({ password: parsed.data.password });
    if (updated.error) return { ok: false, code: updated.error.code, error: authErrorMessage(updated.error.code), invitationVerified };
    const activated = await admin.rpc("complete_organizer_acceptance", args);
    if (activated.error || activated.data !== "ok") return { ok: false, error: "Your password was saved, but Organizer access could not be activated. Retry or contact an administrator.", invitationVerified };
    await clearProof();
    revalidatePath("/", "layout");
    return { ok: true, message: "Your Organizer account is ready." };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: "Could not complete account setup. Check your connection and try again.", invitationVerified };
  }
}
