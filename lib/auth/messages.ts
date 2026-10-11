/**
 * User-facing messages for Supabase Auth error codes. Unknown codes get a generic message so
 * internal details never reach the page. Codes: https://supabase.com/docs/guides/auth/debugging/error-codes
 */
const MESSAGES: Record<string, string> = {
  invalid_credentials: "Incorrect email or password.",
  email_not_confirmed: "Confirm your email address first. Check your inbox or send a new link.",
  user_already_exists: "An account with this email already exists. Log in or reset your password.",
  email_exists: "An account with this email already exists. Log in or reset your password.",
  weak_password: "Choose a stronger password: at least 8 characters with letters and numbers.",
  same_password: "Choose a password you have not used for this account.",
  over_email_send_rate_limit: "Too many emails were requested. Wait a minute, then try again.",
  over_request_rate_limit: "Too many attempts. Wait a minute, then try again.",
  captcha_failed: "The security check failed. Try again.",
  signup_disabled: "Sign-up is currently closed.",
  email_address_invalid: "This email address cannot be used. Check it and try again.",
  email_address_not_authorized:
    "Emails cannot be sent to this address yet (the email service is not configured for it). Contact the organizers.",
  otp_expired: "This link has expired or was already used.",
  session_not_found: "Your session has ended. Log in again.",
  reauthentication_needed: "Log in again to continue.",
};

export const GENERIC_AUTH_ERROR = "Something went wrong. Try again in a moment.";

export function authErrorMessage(code: string | undefined | null): string {
  return (code && MESSAGES[code]) || GENERIC_AUTH_ERROR;
}
