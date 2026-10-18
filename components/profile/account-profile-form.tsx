"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { TextField } from "@/components/forms/text-field";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { saveAccountProfile } from "@/lib/profile/actions";
import { accountProfileSchema, type AccountProfileInput, type AccountProfileValues } from "@/lib/validation/profile";

export function AccountProfileForm({ defaults }: { defaults: AccountProfileInput }) {
  const router = useRouter();
  const form = useForm<AccountProfileInput, unknown, AccountProfileValues>({ resolver: zodResolver(accountProfileSchema), defaultValues: defaults });
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const submit = form.handleSubmit(() => {
    setError("");
    const input = form.getValues();
    start(async () => {
      try {
        const result = await saveAccountProfile(input);
        if (!result.ok) {
          for (const [field, message] of Object.entries(result.fieldErrors ?? {})) form.setError(field as keyof AccountProfileInput, { message });
          setError(result.error); return;
        }
        toast.success(result.message); router.refresh();
      } catch { setError("Could not save your account details. Check your connection and try again."); }
    });
  });
  const { errors } = form.formState;
  return <form onSubmit={submit} noValidate className="grid gap-4" aria-busy={pending}>
    {error && <FormAlert>{error}</FormAlert>}
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField label="First name" autoComplete="given-name" disabled={pending} error={errors.firstName?.message} {...form.register("firstName")} />
      <TextField label="Middle name (optional)" autoComplete="additional-name" disabled={pending} error={errors.middleName?.message} {...form.register("middleName")} />
      <TextField label="Last name" autoComplete="family-name" disabled={pending} error={errors.lastName?.message} {...form.register("lastName")} />
      <TextField label="Suffix (optional)" autoComplete="honorific-suffix" disabled={pending} error={errors.suffix?.message} {...form.register("suffix")} />
    </div>
    <Button type="submit" disabled={pending} className="justify-self-start">{pending ? "Saving…" : "Save account details"}</Button>
  </form>;
}
