"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { FormAlert } from "@/components/forms/form-alert";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { resendConfirmation, signIn } from "@/lib/auth/actions";
import { type LoginInput, loginSchema } from "@/lib/validation/auth";

import { Turnstile } from "./turnstile";
import { useCaptcha } from "./use-captcha";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? undefined;
  const forEvent = next?.startsWith("/events/") ?? false;
  const signedOutEverywhere = searchParams.get("signed_out") === "all";

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const captcha = useCaptcha();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    setResendNotice(null);
    startTransition(async () => {
      const result = await signIn(values, next, captcha.token);
      captcha.reset();
      if (!result || result.ok) return;
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof LoginInput, { message });
      }
      setUnconfirmedEmail(result.code === "email_not_confirmed" ? values.email : null);
      setFormError(result.error);
    });
  });

  const resend = () => {
    if (!unconfirmedEmail) return;
    startTransition(async () => {
      const result = await resendConfirmation({ email: unconfirmedEmail }, next, captcha.token);
      captcha.reset();
      setResendNotice({ ok: result.ok, text: result.ok ? (result.message ?? "") : result.error });
    });
  };

  const signUpHref = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup";
  const { errors } = form.formState;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <CardDescription>
          {forEvent ? "Log in or create an account to view this event." : "Use the email and password you signed up with."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {signedOutEverywhere ? (
            <FormAlert tone="success">You were signed out on all devices.</FormAlert>
          ) : null}
          {formError ? (
            <FormAlert>
              {formError}
              {unconfirmedEmail ? (
                <div className="mt-2">
                  <Button type="button" variant="outline" size="sm" onClick={resend} disabled={pending || !captcha.ready}>
                    Resend confirmation email
                  </Button>
                </div>
              ) : null}
            </FormAlert>
          ) : null}
          {resendNotice ? <FormAlert tone={resendNotice.ok ? "success" : "error"}>{resendNotice.text}</FormAlert> : null}
          <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...form.register("email")} />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...form.register("password")}
          />
          <Turnstile {...captcha.widgetProps} />
          <Button type="submit" disabled={pending || !captcha.ready}>
            {pending ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 text-sm">
        <Link href="/forgot-password" className="underline-offset-4 hover:underline">
          Forgot your password?
        </Link>
        <p className="text-muted-foreground">
          New to EventHub?{" "}
          <Link href={signUpHref} className="text-foreground underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
