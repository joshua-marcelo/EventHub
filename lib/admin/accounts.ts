"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import type { ActionResult } from "@/lib/action-result";
import { fieldErrorsFrom } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth/dal";
import { generateTemporaryPassword } from "@/lib/auth/temporary-password";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emailSchema } from "@/lib/validation/auth";

/** One-time credentials for the Admin to hand over in person. Returned once; never stored or logged. */
export type Credentials = { email: string; password: string };
export type CredentialsResult = (ActionResult & { credentials?: undefined }) | { ok: true; message: string; credentials: Credentials };
export type AccountRole = "organizer" | "participant";

const messages: Record<string, string> = {
  existing_account: "This email already belongs to an EventHub account. No account was created.",
  pending_invitation: "This email has an outstanding Organizer invitation. No account was created.",
  retry_later: "Too many requests. Wait a minute, then try again.",
  not_permitted: "You do not have permission for this operation.",
  self_reset: "You cannot reset your own password here. Use Change Password instead.",
  not_found: "This account no longer exists.",
  not_configured: "Account administration is not configured on this server (SUPABASE_SECRET_KEY). No changes were made.",
  migration_pending: "This feature requires the pending database migration. No changes were made.",
};
const MISSING_RPC = new Set(["PGRST202", "42883"]);
const roleLabel: Record<AccountRole, string> = { organizer: "Organizer", participant: "Participant" };

function failure(code?: string, fallback = "Could not complete this operation. No changes were made. Try again."): ActionResult {
  return { ok: false, code, error: messages[code ?? ""] ?? fallback };
}
function rpcCode(data: unknown, error?: { code?: string } | null) {
  if (error?.code && MISSING_RPC.has(error.code)) return "migration_pending";
  return data && typeof data === "object" && "code" in data && typeof data.code === "string" ? data.code : undefined;
}
/** Server-side diagnostics only: ids, stage and provider error metadata. Never emails or passwords. */
function logFailure(stage: string, id: string | null, error: unknown) {
  const e = (error && typeof error === "object" ? error : {}) as { name?: unknown; code?: unknown; status?: unknown };
  console.error("[admin-accounts] failed", { stage, id, errorName: typeof e.name === "string" ? e.name : undefined, errorCode: typeof e.code === "string" ? e.code : undefined, status: typeof e.status === "number" ? e.status : undefined });
}
function adminClient() {
  try { return createAdminClient(); } catch { return null; }
}
function refresh() {
  revalidatePath("/admin/organizers");
  revalidatePath("/admin/users");
}

export async function createOrganizerAccount(input: unknown): Promise<CredentialsResult> { return createAccount("organizer", input); }
export async function createParticipantAccount(input: unknown): Promise<CredentialsResult> { return createAccount("participant", input); }

/**
 * Admin-created account: reserve → Admin API create (confirmed email, generated password) → verify.
 * The database trigger provisions the profile, role and password-change flag in the same transaction
 * as the Auth insert, so success is reported only after reading those back.
 */
async function createAccount(role: AccountRole, input: unknown): Promise<CredentialsResult> {
  await requireAdmin();
  const parsed = z.object({ email: emailSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  const admin = adminClient();
  if (!admin) return failure("not_configured");
  const email = parsed.data.email;
  let id: string | null = null;
  try {
    const reserved = await (await createClient()).rpc("reserve_account", { p_email: email, p_role: role });
    const reservation = z.object({ code: z.literal("ok"), id: z.uuid() }).safeParse(reserved.data);
    if (reserved.error || !reservation.success) return failure(rpcCode(reserved.data, reserved.error));
    id = reservation.data.id;

    // Recheck the actor immediately before the privileged operation.
    await requireAdmin();
    const password = generateTemporaryPassword();
    const created = await admin.auth.admin.createUser({ id, email, password, email_confirm: true });
    if (created.error || !created.data.user) {
      logFailure("create_user", id, created.error);
      return failure(["email_exists", "user_already_exists"].includes(created.error?.code ?? "") ? "existing_account" : undefined, "The account could not be created. No account was created; you can try again.");
    }
    if (created.data.user.id !== id) {
      logFailure("identity_mismatch", id, null);
      return failure(undefined, "The account could not be verified. Contact the system maintainer before retrying.");
    }

    const { data: profile, error } = await admin.from("profiles").select("organizer_status,is_admin,must_change_password").eq("id", id).maybeSingle();
    const provisioned = !error && profile && profile.must_change_password && !profile.is_admin
      && (role === "organizer" ? profile.organizer_status === "active" : profile.organizer_status === "none");
    if (!provisioned) {
      // Nobody has seen this password and the account holds no data: remove it so the reservation can be retried.
      logFailure("provision_check", id, error);
      const removed = await admin.auth.admin.deleteUser(id);
      if (removed.error) logFailure("cleanup", id, removed.error);
      return failure(undefined, removed.error ? "The account was created but could not be fully set up. Contact the system maintainer before retrying." : "The account could not be fully set up, so it was not created. Try again.");
    }
    refresh();
    return { ok: true, message: `${roleLabel[role]} account created.`, credentials: { email, password } };
  } catch (error) {
    unstable_rethrow(error);
    logFailure("unexpected", id, error);
    return failure(undefined, "Could not reach the account service. Refresh to check whether the account exists before retrying.");
  }
}

/**
 * Admin-controlled recovery (no email in the MVP): issues a new one-time temporary password and
 * requires another change at next login. Never for the Admin's own account or another Admin.
 */
export async function resetAccountPassword(userId: string): Promise<CredentialsResult> {
  const actor = await requireAdmin();
  if (!z.uuid().safeParse(userId).success) return failure("not_found");
  if (actor.id === userId) return failure("self_reset");
  const admin = adminClient();
  if (!admin) return failure("not_configured");
  const client = await createClient();
  try {
    // One reset per account per minute. The database limit only sees a reset still in flight (the
    // password-change trigger consumes it), so completed resets are checked in the audit log too.
    const recent = await client.from("audit_logs").select("id", { count: "exact", head: true })
      .eq("action", "account.password_reset_requested").eq("entity_id", userId)
      .gte("created_at", new Date(Date.now() - 60_000).toISOString());
    if (recent.error) return failure(undefined, "Could not check recent resets. Try again.");
    if ((recent.count ?? 0) > 0) return failure("retry_later");
    const requested = await client.rpc("request_password_reset", { p_user_id: userId });
    const request = z.object({ code: z.literal("ok"), email: z.string() }).safeParse(requested.data);
    if (requested.error || !request.success) return failure(rpcCode(requested.data, requested.error));

    const password = generateTemporaryPassword();
    const updated = await admin.auth.admin.updateUserById(userId, { password });
    if (updated.error) {
      logFailure("update_password", userId, updated.error);
      await client.rpc("cancel_password_reset", { p_user_id: userId });
      return failure(undefined, "The password could not be reset. The current password still works.");
    }
    const { data: profile } = await admin.from("profiles").select("must_change_password").eq("id", userId).maybeSingle();
    if (!profile?.must_change_password) {
      logFailure("reset_flag_check", userId, null);
      return failure(undefined, "The password was changed but the change requirement could not be confirmed. Reset it again.");
    }
    refresh();
    return { ok: true, message: "Temporary password issued.", credentials: { email: request.data.email, password } };
  } catch (error) {
    unstable_rethrow(error);
    logFailure("unexpected", userId, error);
    return failure(undefined, "Could not reach the account service. Try the reset again.");
  }
}
