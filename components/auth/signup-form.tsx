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
import { signUp } from "@/lib/auth/actions";
import { type SignUpInput, signUpSchema } from "@/lib/validation/auth";

import { Turnstile } from "./turnstile";
import { useCaptcha } from "./use-captcha";

export function SignUpForm() {
  const next = useSearchParams().get("next") ?? undefined;
  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "", confirmPassword: "" },
  });
  const captcha = useCaptcha();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await signUp(values, next, captcha.token);
      captcha.reset();
      if (!result || result.ok) return;
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof SignUpInput, { message });
      }
      setFormError(result.error);
    });
  });

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  const { errors } = form.formState;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          We will email you a link to confirm your address. After that you complete your student profile.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {formError ? <FormAlert>{formError}</FormAlert> : null}
          <div className="grid grid-cols-2 gap-3">
            <TextField label="First name" autoComplete="given-name" error={errors.firstName?.message} {...form.register("firstName")} />
            <TextField label="Last name" autoComplete="family-name" error={errors.lastName?.message} {...form.register("lastName")} />
          </div>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            description="Your personal email. You will use it to log in and to reset your password."
            error={errors.email?.message}
            {...form.register("email")}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            description="At least 8 characters with letters and numbers."
            error={errors.password?.message}
            {...form.register("password")}
          />
          <TextField
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...form.register("confirmPassword")}
          />
          <p className="text-xs text-muted-foreground">
            By creating an account you acknowledge the{" "}
            <Link href="/privacy" className="underline underline-offset-4">
              privacy notice
            </Link>
            . You will be asked for your consent during profile setup.
          </p>
          <Turnstile {...captcha.widgetProps} />
          <Button type="submit" disabled={pending || !captcha.ready}>
            {pending ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        Already have an account?&nbsp;
        <Link href={loginHref} className="text-foreground underline-offset-4 hover:underline">
          Log in
        </Link>
      </CardFooter>
    </Card>
  );
}
