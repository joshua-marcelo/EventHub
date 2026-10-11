import { z } from "zod";

// Shared by the auth forms and the Server Actions (SYSTEM_SPEC §3).

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email is too long.")
  .pipe(z.email("Enter a valid email address."));

// P-02: at least 8 characters with letters and digits. 72 is bcrypt's input limit.
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

const personNameSchema = z
  .string()
  .trim()
  .min(1, "Required.")
  .max(80, "Use at most 80 characters.");

export const signUpSchema = z
  .object({
    firstName: personNameSchema,
    lastName: personNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const emailOnlySchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export type SignUpInput = z.input<typeof signUpSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type EmailOnlyInput = z.input<typeof emailOnlySchema>;
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
