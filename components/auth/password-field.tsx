"use client";

import { type ComponentProps, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordFieldProps = Omit<ComponentProps<typeof Input>, "type"> & {
  label: string;
  error?: string;
  description?: string;
};

export function PasswordField({ label, error, description, id, className, ...inputProps }: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  const describedBy = error ? `${inputId}-error` : description ? `${inputId}-description` : undefined;

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <div className="relative">
        <Input {...inputProps} id={inputId} type={visible ? "text" : "password"} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={cn("auth-password-input", className)} />
        <button type="button" aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-pressed={visible} aria-controls={inputId} disabled={inputProps.disabled} onClick={() => setVisible(value => !value)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 hover:text-orange-800 disabled:opacity-50">
          {visible ? <EyeOff className="size-[18px]" aria-hidden="true" /> : <Eye className="size-[18px]" aria-hidden="true" />}
        </button>
      </div>
      {description && !error ? <FieldDescription id={`${inputId}-description`}>{description}</FieldDescription> : null}
      {error ? <FieldError id={`${inputId}-error`}>{error}</FieldError> : null}
    </Field>
  );
}
