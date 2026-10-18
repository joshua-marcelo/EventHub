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
import { saveStudentDetails } from "@/lib/profile/actions";
import type { CollegeOption, ProgramOption } from "@/lib/profile/queries";
import { studentDetailsSchema, type StudentDetailsInput, type StudentDetailsValues } from "@/lib/validation/profile";

export function StudentDetailsForm({ defaults, colleges, programs }: { defaults: StudentDetailsInput; colleges: CollegeOption[]; programs: ProgramOption[] }) {
  const router = useRouter();
  const form = useForm<StudentDetailsInput, unknown, StudentDetailsValues>({ resolver: zodResolver(studentDetailsSchema), defaultValues: defaults });
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const collegeId = Number(useWatch({ control: form.control, name: "collegeId" }) || 0);
  const collegeField = form.register("collegeId", { onChange: () => form.setValue("programId", "") });
  const submit = form.handleSubmit(() => {
    setError("");
    const input = form.getValues();
    start(async () => {
      try {
        const result = await saveStudentDetails(input);
        if (!result.ok) {
          for (const [field, message] of Object.entries(result.fieldErrors ?? {})) form.setError(field as keyof StudentDetailsInput, { message });
          setError(result.error); return;
        }
        toast.success(result.message); router.refresh();
      } catch { setError("Could not save your student details. Check your connection and try again."); }
    });
  });
  const { errors } = form.formState;
  return <form onSubmit={submit} noValidate className="grid gap-4" aria-busy={pending}>
    {error && <FormAlert>{error}</FormAlert>}
    <TextField label="Student ID" autoComplete="off" disabled={pending} description="As printed on your school ID. It cannot be changed while you have an upcoming approved event." error={errors.studentId?.message} {...form.register("studentId")} />
    <SelectField label="College" placeholder={colleges.length ? "Select your college" : "No colleges available yet"} disabled={pending} options={colleges.map(c => ({ value: c.id, label: c.name }))} error={errors.collegeId?.message} {...collegeField} />
    <SelectField label="Program" placeholder={collegeId ? "Select your program" : "Select a college first"} disabled={pending || !collegeId} options={programs.filter(p => p.collegeId === collegeId).map(p => ({ value: p.id, label: p.name }))} error={errors.programId?.message} {...form.register("programId")} />
    <SelectField label="Year level" placeholder="Select your year level" disabled={pending} options={[1, 2, 3, 4, 5, 6].map(y => ({ value: y, label: `Year ${y}` }))} error={errors.yearLevel?.message} {...form.register("yearLevel")} />
    <Button type="submit" disabled={pending} className="justify-self-start">{pending ? "Saving…" : "Save student details"}</Button>
  </form>;
}
