"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { changePassword } from "@/lib/auth/actions";
import { type ChangePasswordInput, changePasswordSchema } from "@/lib/validation/auth";

import { PasswordField } from "./password-field";
import { Turnstile } from "./turnstile";
import { useCaptcha } from "./use-captcha";

/** Current password, then the new one twice. On success the server action redirects. */
export function ChangePasswordForm({ temporary }: { temporary: boolean }) {
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", password: "", confirmPassword: "" },
  });
  const captcha = useCaptcha();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await changePassword(values, captcha.token);
      captcha.reset();
      if (!result || result.ok) return;
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof ChangePasswordInput, { message });
      }
      setFormError(result.error);
    });
  });

  const { errors } = form.formState;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4" aria-busy={pending}>
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <PasswordField
        label={temporary ? "Temporary password" : "Current password"}
        autoComplete="current-password"
        description={temporary ? "The password your administrator gave you." : undefined}
        error={errors.currentPassword?.message}
        disabled={pending}
        {...form.register("currentPassword")}
      />
      <PasswordField
        label="New password"
        autoComplete="new-password"
        description="At least 8 characters with letters and numbers."
        error={errors.password?.message}
        disabled={pending}
        {...form.register("password")}
      />
      <PasswordField
        label="Confirm new password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        disabled={pending}
        {...form.register("confirmPassword")}
      />
      <Turnstile {...captcha.widgetProps} />
      <Button type="submit" disabled={pending || !captcha.ready}>
        {pending ? "Changing password…" : "Change Password"}
      </Button>
    </form>
  );
}
