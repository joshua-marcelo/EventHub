"use client";

import { useEffect, useState, useTransition } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { requestPasswordReset, resendConfirmation } from "@/lib/auth/actions";

import { Turnstile } from "./turnstile";
import { useCaptcha } from "./use-captcha";

const COOLDOWN_SECONDS = 60;

/**
 * Resend a confirmation (or a new reset link). Without `askEmail` it uses the address
 * remembered after sign-up; with it, the user types the address (error page).
 */
export function ResendConfirmation({
  kind = "signup",
  askEmail = false,
  next,
}: {
  kind?: "signup" | "recovery";
  askEmail?: boolean;
  next?: string;
}) {
  const captcha = useCaptcha();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = () => {
    setFieldError(undefined);
    startTransition(async () => {
      const result =
        kind === "recovery"
          ? await requestPasswordReset({ email }, captcha.token)
          : await resendConfirmation(askEmail ? { email } : {}, next, captcha.token);
      captcha.reset();
      if (result.ok) {
        setNotice({ ok: true, text: result.message ?? "Sent." });
        setCooldown(COOLDOWN_SECONDS);
      } else {
        setFieldError(result.fieldErrors?.email);
        setNotice({ ok: false, text: result.error });
      }
    });
  };

  const label = kind === "recovery" ? "Send a new reset link" : "Resend confirmation email";

  return (
    <div className="flex flex-col gap-3">
      {notice ? <FormAlert tone={notice.ok ? "success" : "error"}>{notice.text}</FormAlert> : null}
      {askEmail ? (
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError}
        />
      ) : null}
      <Turnstile {...captcha.widgetProps} />
      <Button type="button" variant="outline" onClick={send} disabled={pending || cooldown > 0 || !captcha.ready}>
        {pending ? "Sending…" : cooldown > 0 ? `${label} (${cooldown}s)` : label}
      </Button>
    </div>
  );
}
