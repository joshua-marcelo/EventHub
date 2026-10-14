"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { FormAlert } from "@/components/forms/form-alert";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { requestPasswordReset } from "@/lib/auth/actions";
import { type EmailOnlyInput, emailOnlySchema } from "@/lib/validation/auth";

import { Turnstile } from "./turnstile";
import { useCaptcha } from "./use-captcha";

export function ForgotPasswordForm() {
  const form = useForm<EmailOnlyInput>({ resolver: zodResolver(emailOnlySchema), defaultValues: { email: "" } });
  const captcha = useCaptcha();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setNotice(null);
    startTransition(async () => {
      const result = await requestPasswordReset(values, captcha.token);
      captcha.reset();
      if (result.ok) {
        setNotice({ ok: true, text: result.message ?? "" });
        form.reset();
      } else {
        if (result.fieldErrors?.email) form.setError("email", { message: result.fieldErrors.email });
        setNotice({ ok: false, text: result.error });
      }
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle><h1>Forgot your password?</h1></CardTitle>
        <CardDescription>Enter your email address to receive password reset instructions.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {notice ? <FormAlert tone={notice.ok ? "success" : "error"}>{notice.text}</FormAlert> : null}
          <TextField label="Email address" type="email" autoComplete="email" error={form.formState.errors.email?.message} {...form.register("email")} />
          <Turnstile {...captcha.widgetProps} />
          <Button type="submit" disabled={pending || !captcha.ready}>
            {pending ? "Sending…" : "Send Reset Link"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-sm">
        <Link href="/login" className="underline-offset-4 hover:underline">
          Back to Log In
        </Link>
      </CardFooter>
    </Card>
  );
}
