"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type ActionResult, fieldErrorsFrom } from "@/lib/action-result";
import { getAppOrigin } from "@/lib/app-origin";
import { authErrorMessage } from "@/lib/auth/messages";
import { readPendingEmail, rememberPendingEmail } from "@/lib/auth/pending-email";
import { DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/auth/redirect";
import { type RecoveryCredential, recoveryCredentialSchema } from "@/lib/auth/recovery";
import { createClient } from "@/lib/supabase/server";
import { createIsolatedAuthClient } from "@/lib/supabase/isolated";
import { getCurrentUser } from "@/lib/auth/dal";
import { ACCOUNT_PROFILE_PATH, CHANGE_PASSWORD_PATH, landingFor } from "@/lib/navigation";
import {
  type EmailOnlyInput,
  emailOnlySchema,
  type LoginInput,
  loginSchema,
  type ChangePasswordInput,
  changePasswordSchema,
  type ResetPasswordInput,
  resetPasswordSchema,
  type SignUpInput,
  signUpSchema,
} from "@/lib/validation/auth";

/** Link target inside the confirmation email: the page to land on after confirming. */
async function confirmationRedirect(next: string | undefined) {
  return `${await getAppOrigin()}${safeNextPath(next, DEFAULT_AFTER_LOGIN)}`;
}

export async function signUp(
  input: SignUpInput,
  next?: string,
  captchaToken?: string,
): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }
  const { email, password, firstName, lastName } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: await confirmationRedirect(next),
      data: { first_name: firstName, last_name: lastName },
      captchaToken,
    },
  });
  // With email confirmation on, an already-registered address returns no error and no email,
  // so the response never reveals whether an account exists (SYSTEM_SPEC §3.1).
  if (error) return { ok: false, error: authErrorMessage(error.code), code: error.code };

  // With hosted email confirmation turned off (the MVP setting), sign-up returns a session: go
  // straight to student onboarding. With it still on, keep the existing check-email step.
  const safeNext = safeNextPath(next, "");
  if (data.session) {
    redirect(safeNext ? `/onboarding?next=${encodeURIComponent(safeNext)}` : "/onboarding");
  }
  await rememberPendingEmail(email);
  redirect(safeNext ? `/signup/check-email?next=${encodeURIComponent(safeNext)}` : "/signup/check-email");
}

export async function signIn(
  input: LoginInput,
  next?: string,
  captchaToken?: string,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    ...parsed.data,
    options: { captchaToken },
  });
  if (error) return { ok: false, error: authErrorMessage(error.code), code: error.code };

  const user = await getCurrentUser();
  // A temporary password must be replaced before anything else; `next` is dropped on purpose.
  if (user?.mustChangePassword) redirect(CHANGE_PASSWORD_PATH);
  redirect(safeNextPath(next, user ? landingFor(user) : DEFAULT_AFTER_LOGIN));
}

/** Resend the confirmation email. `input.email` may be omitted on the check-email page. */
export async function resendConfirmation(
  input: Partial<EmailOnlyInput>,
  next?: string,
  captchaToken?: string,
): Promise<ActionResult> {
  const candidate = input.email ?? (await readPendingEmail()) ?? "";
  const parsed = emailOnlySchema.safeParse({ email: candidate });
  if (!parsed.success) {
    return { ok: false, error: "Enter the email address you signed up with.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: await confirmationRedirect(next), captchaToken },
  });
  if (error) return { ok: false, error: authErrorMessage(error.code), code: error.code };

  await rememberPendingEmail(parsed.data.email);
  return { ok: true, message: "If this address has an unconfirmed account, a new link is on its way." };
}

export async function requestPasswordReset(
  input: EmailOnlyInput,
  captchaToken?: string,
): Promise<ActionResult> {
  const parsed = emailOnlySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await getAppOrigin()}/reset-password`,
    captchaToken,
  });
  // Only surface errors the user can act on; everything else gets the same generic answer.
  if (error && ["over_email_send_rate_limit", "over_request_rate_limit", "captcha_failed"].includes(error.code ?? "")) {
    return { ok: false, error: authErrorMessage(error.code), code: error.code };
  }
  return { ok: true, message: "If an account exists for this address, we sent a link to reset the password." };
}

export async function updatePassword(input: ResetPasswordInput, recovery?: RecoveryCredential): Promise<ActionResult & { recoveryVerified?: boolean }> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const supabase = await createClient();
  // Consume the single-use link only on an explicit password submission, never on a GET.
  if (recovery !== undefined) {
    const credential = recoveryCredentialSchema.safeParse(recovery);
    if (!credential.success) {
      return { ok: false, error: "This reset link is not valid. Request a new one.", code: "link_invalid" };
    }
    const value = credential.data;
    const { error } = value.kind === "token_hash"
      ? await supabase.auth.verifyOtp({ type: "recovery", token_hash: value.tokenHash })
      : value.kind === "code"
        ? await supabase.auth.exchangeCodeForSession(value.code, value.flowId ? { flowId: value.flowId } : undefined)
        : await supabase.auth.setSession({ access_token: value.accessToken, refresh_token: value.refreshToken });
    // A Supabase PKCE link only works in the browser that requested it (the verifier cookie
    // lives there). The link is still valid elsewhere, so do not call it expired.
    if (error && ["pkce_code_verifier_not_found", "bad_code_verifier"].includes(error.code ?? "")) {
      return { ok: false, error: "Open this reset link in the same browser where you requested it, or request a new link here.", code: "link_invalid" };
    }
    if (error) {
      return { ok: false, error: "This reset link has expired or was already used. Request a new one.", code: "link_invalid" };
    }
  }
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return { ok: false, error: "This reset link is no longer valid. Request a new one.", code: "session_not_found" };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: authErrorMessage(error.code), code: error.code, recoveryVerified: recovery !== undefined };

  // P-05: end every other session, e.g. someone who knew the old password.
  await supabase.auth.signOut({ scope: "others" });
  return { ok: true, message: "Your password was changed. Other devices were signed out." };
}

/**
 * Change Password for a signed-in account, including the required first-login change of an
 * Admin-issued temporary password. The current password is always verified, so an unattended or
 * stale session cannot take over the account. The password-change flag is cleared by the database
 * only because the password really changed (trigger on auth.users), never by this action.
 */
export async function changePassword(input: ChangePasswordInput, captchaToken?: string): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }
  const user = await getCurrentUser();
  if (!user?.email) return { ok: false, error: authErrorMessage("session_not_found"), code: "session_not_found" };

  // Verify the current password on an isolated client so this browser's session is untouched.
  const verifier = createIsolatedAuthClient();
  const check = await verifier.auth.signInWithPassword({ email: user.email, password: parsed.data.currentPassword, options: { captchaToken } });
  if (check.error) {
    const code = check.error.code === "invalid_credentials" ? "wrong_current_password" : check.error.code;
    return code === "wrong_current_password"
      ? { ok: false, error: "Your current password is incorrect.", code, fieldErrors: { currentPassword: "Your current password is incorrect." } }
      : { ok: false, error: authErrorMessage(code), code };
  }
  await verifier.auth.signOut({ scope: "local" });

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const message = authErrorMessage(error.code);
    return { ok: false, error: message, code: error.code, ...(error.code === "same_password" || error.code === "weak_password" ? { fieldErrors: { password: message } } : {}) };
  }
  // P-05: end every other session, e.g. someone who knew the old or temporary password.
  await supabase.auth.signOut({ scope: "others" });
  revalidatePath("/", "layout");
  redirect(user.mustChangePassword ? landingFor(user) : `${ACCOUNT_PROFILE_PATH}?password=changed`);
}

/**
 * Ends this browser's session and returns to the landing page. Clearing the auth cookies in an
 * action also invalidates the client router cache, so Back cannot replay a signed-in page.
 * On failure the session is kept, and the caller says so instead of pretending it worked.
 */
export async function signOut(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) return { ok: false, error: "We couldn’t log you out. Check your connection and try again.", code: error.code };
  redirect("/");
}

/** P-29: revoke every session of this account (lost or unattended device). */
export async function signOutEverywhere(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?signed_out=all");
}
