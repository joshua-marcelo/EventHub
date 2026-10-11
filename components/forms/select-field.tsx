"use client";

import { type ComponentProps, type ReactNode, useId } from "react";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type SelectFieldProps = ComponentProps<"select"> & {
  label: ReactNode;
  error?: string;
  placeholder?: string;
  options: { value: string | number; label: string }[];
};

/** Native select styled like the Input component (reliable with forms and mobile keyboards). */
export function SelectField({ label, error, placeholder, options, id, className, ...props }: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={selectId}>{label}</FieldLabel>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${selectId}-error` : undefined}
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30",
          className,
        )}
        {...props}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <FieldError id={`${selectId}-error`}>{error}</FieldError> : null}
    </Field>
  );
}
