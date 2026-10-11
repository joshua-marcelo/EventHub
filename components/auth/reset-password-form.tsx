"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormAlert } from "@/components/forms/form-alert";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { updatePassword } from "@/lib/auth/actions";
import { type ResetPasswordInput, resetPasswordSchema } from "@/lib/validation/auth";

export function ResetPasswordForm() {
  const router = useRouter();
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await updatePassword(values);
      if (result.ok) {
        toast.success(result.message ?? "Password changed.");
        router.replace("/dashboard");
        return;
      }
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof ResetPasswordInput, { message });
      }
      setFormError(result.error);
    });
  });

  const { errors } = form.formState;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        description="At least 8 characters with letters and numbers."
        error={errors.password?.message}
        {...form.register("password")}
      />
      <TextField
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...form.register("confirmPassword")}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
