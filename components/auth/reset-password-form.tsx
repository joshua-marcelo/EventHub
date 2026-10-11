"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormAlert } from "@/components/forms/form-alert";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { updatePassword } from "@/lib/auth/actions";
import { type RecoveryCredential, readRecoveryLink, recoveryLinkPresent } from "@/lib/auth/recovery";
import { type ResetPasswordInput, resetPasswordSchema } from "@/lib/validation/auth";

export function ResetPasswordForm({ hasSession = false }: { hasSession?: boolean }) {
  const router = useRouter();
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const credential = useRef<RecoveryCredential | undefined>(undefined);
  const initialized = useRef(false);
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const readLink = () => {
      const url = new URL(window.location.href);
      const value = readRecoveryLink(url);
      credential.current = value ?? undefined;
      // Clear credentials from browser history immediately. Keep them only in component memory.
      const linkPresent = recoveryLinkPresent(url);
      if (linkPresent) window.history.replaceState(window.history.state, "", url.pathname);
      setInvalid(linkPresent ? !value : !hasSession);
      setReady(true);
    };
    if (!initialized.current) {
      initialized.current = true;
      readLink();
    }
    // An email may reuse an already-open reset tab; a fragment change does not remount it.
    window.addEventListener("hashchange", readLink);
    return () => window.removeEventListener("hashchange", readLink);
  }, [hasSession]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    void form.handleSubmit((values) => {
      setFormError(null);
      startTransition(async () => {
        const result = await updatePassword(values, credential.current);
        if (result.ok) {
          toast.success(result.message ?? "Password changed.");
          router.replace("/dashboard");
          return;
        }
        // Verification succeeded but the password was rejected (e.g. same password). Retry
        // with the newly established cookie session instead of reusing the spent email token.
        if (result.recoveryVerified) credential.current = undefined;
        if (["link_invalid", "session_not_found"].includes(result.code ?? "")) setInvalid(true);
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as keyof ResetPasswordInput, { message });
        }
        setFormError(result.error);
      });
    })(event);
  };

  const { errors } = form.formState;
  if (!ready) return <p className="text-sm text-muted-foreground" role="status">Checking reset link…</p>;
  if (invalid) {
    return (
      <div className="flex flex-col gap-4">
        <FormAlert>{formError ?? "This reset link is missing, expired, or already used. Request a new one."}</FormAlert>
        <Button render={<Link href="/forgot-password" />}>Request a new link</Button>
      </div>
    );
  }
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
