"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { FormAlert } from "@/components/forms/form-alert";
import { SelectField } from "@/components/forms/select-field";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { saveProfile } from "@/lib/profile/actions";
import type { CollegeOption, ProgramOption } from "@/lib/profile/queries";
import { type ProfileFormInput, type ProfileFormValues, profileSchema } from "@/lib/validation/profile";

const YEAR_OPTIONS = [1, 2, 3, 4, 5, 6].map((y) => ({ value: y, label: `Year ${y}` }));

export function ProfileForm({
  defaults,
  colleges,
  programs,
  submitLabel = "Save details",
  onSaved,
  compact = false,
}: {
  defaults: ProfileFormInput;
  colleges: CollegeOption[];
  programs: ProgramOption[];
  submitLabel?: string;
  onSaved?: () => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const form = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
  });
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const collegeId = Number(useWatch({ control: form.control, name: "collegeId" }) || 0);
  const programOptions = programs
    .filter((p) => p.collegeId === collegeId)
    .map((p) => ({ value: p.id, label: p.name }));

  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    // Send the raw input; the Server Action validates it again with the same schema.
    const input = form.getValues();
    startTransition(async () => {
      const result = await saveProfile(input);
      if (result.ok) {
        toast.success(result.message ?? "Saved.");
        onSaved?.();
        router.refresh();
        return;
      }
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof ProfileFormInput, { message });
      }
      setFormError(result.error);
    });
  });

  const { errors } = form.formState;
  const collegeField = form.register("collegeId", {
    // A program belongs to one college; clear it when the college changes.
    onChange: () => form.setValue("programId", ""),
  });

  return (
    <form onSubmit={onSubmit} noValidate className={`flex flex-col gap-4 ${compact ? "[&_input]:h-10 [&_select]:h-10" : ""}`}>
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="First name" autoComplete="given-name" error={errors.firstName?.message} {...form.register("firstName")} />
        <TextField label="Middle name (optional)" autoComplete="additional-name" error={errors.middleName?.message} {...form.register("middleName")} />
        <TextField label="Last name" autoComplete="family-name" error={errors.lastName?.message} {...form.register("lastName")} />
        <TextField label="Suffix (optional)" placeholder="Jr., III" autoComplete="honorific-suffix" error={errors.suffix?.message} {...form.register("suffix")} />
      </div>
      <TextField
        label="Student ID"
        autoComplete="off"
        description="As printed on your school ID. It cannot be changed while you have an upcoming approved event."
        error={errors.studentId?.message}
        {...form.register("studentId")}
      />
      <SelectField
        label="College"
        placeholder={colleges.length ? "Select your college" : "No colleges available yet"}
        options={colleges.map((c) => ({ value: c.id, label: c.name }))}
        error={errors.collegeId?.message}
        {...collegeField}
      />
      <SelectField
        label="Program"
        placeholder={collegeId ? (programOptions.length ? "Select your program" : "No programs listed for this college") : "Select a college first"}
        options={programOptions}
        disabled={!collegeId}
        error={errors.programId?.message}
        {...form.register("programId")}
      />
      <SelectField
        label="Year level"
        placeholder="Select your year level"
        options={YEAR_OPTIONS}
        error={errors.yearLevel?.message}
        {...form.register("yearLevel")}
      />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
