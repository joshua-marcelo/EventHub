"use client";

import { type ComponentProps, type ReactNode, useId } from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type TextFieldProps = ComponentProps<typeof Input> & {
  label: ReactNode;
  error?: string;
  description?: ReactNode;
};

/** Labelled input with description and field-level error (SYSTEM_SPEC §18: field-level errors). */
export function TextField({ label, error, description, id, ...inputProps }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : description ? `${inputId}-description` : undefined;

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <Input id={inputId} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...inputProps} />
      {description && !error ? <FieldDescription id={`${inputId}-description`}>{description}</FieldDescription> : null}
      {error ? <FieldError id={`${inputId}-error`}>{error}</FieldError> : null}
    </Field>
  );
}
