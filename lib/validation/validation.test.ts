import { describe, expect, it } from "vitest";

import { authErrorMessage, GENERIC_AUTH_ERROR } from "@/lib/auth/messages";

import { emailOnlySchema, loginSchema, resetPasswordSchema, signUpSchema } from "./auth";
import { isOwnAvatarPath, profileSchema } from "./profile";

const validSignUp = {
  firstName: " Juan ",
  lastName: "Dela Cruz",
  email: " Juan.DelaCruz@Example.COM ",
  password: "secret123",
  confirmPassword: "secret123",
};

describe("signUpSchema", () => {
  it("trims names and normalizes the email", () => {
    const r = signUpSchema.parse(validSignUp);
    expect(r.firstName).toBe("Juan");
    expect(r.email).toBe("juan.delacruz@example.com");
  });

  it.each([
    ["short password", { password: "abc1", confirmPassword: "abc1" }, "password"],
    ["password without digits", { password: "abcdefgh", confirmPassword: "abcdefgh" }, "password"],
    ["password without letters", { password: "12345678", confirmPassword: "12345678" }, "password"],
    ["mismatched confirmation", { confirmPassword: "secret124" }, "confirmPassword"],
    ["invalid email", { email: "not-an-email" }, "email"],
    ["missing first name", { firstName: "  " }, "firstName"],
    ["first name too long", { firstName: "x".repeat(81) }, "firstName"],
  ])("rejects %s", (_label, patch, field) => {
    const r = signUpSchema.safeParse({ ...validSignUp, ...patch });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === field)).toBe(true);
  });
});

describe("other auth schemas", () => {
  it("login requires an email and a password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });

  it("email-only form validates the email", () => {
    expect(emailOnlySchema.safeParse({ email: "nope" }).success).toBe(false);
  });

  it("reset password applies the password policy and confirmation", () => {
    expect(resetPasswordSchema.safeParse({ password: "newpass12", confirmPassword: "newpass12" }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ password: "newpass12", confirmPassword: "x" }).success).toBe(false);
  });
});

describe("profileSchema", () => {
  const valid = {
    firstName: "Maria",
    middleName: "",
    lastName: "Santos",
    suffix: "",
    studentId: "2021-00123",
    collegeId: "3",
    programId: "7",
    yearLevel: "2",
  };

  it("coerces ids and turns empty optional fields into null", () => {
    const r = profileSchema.parse(valid);
    expect(r).toMatchObject({ collegeId: 3, programId: 7, yearLevel: 2, middleName: null, suffix: null });
  });

  it.each([
    ["bad student ID", { studentId: "bad id!" }, "studentId"],
    ["short student ID", { studentId: "abc" }, "studentId"],
    ["no college", { collegeId: "" }, "collegeId"],
    ["no program", { programId: "0" }, "programId"],
    ["year 7", { yearLevel: "7" }, "yearLevel"],
    ["long suffix", { suffix: "x".repeat(11) }, "suffix"],
  ])("rejects %s", (_label, patch, field) => {
    const r = profileSchema.safeParse({ ...valid, ...patch });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === field)).toBe(true);
  });
});

describe("isOwnAvatarPath", () => {
  const uid = "123e4567-e89b-42d3-a456-426614174000";
  it("accepts a uuid file in the owner's folder", () => {
    expect(isOwnAvatarPath(`${uid}/0f8fad5b-d9cb-469f-a165-70867728950e.webp`, uid)).toBe(true);
  });
  it("rejects other folders, nesting and other extensions", () => {
    expect(isOwnAvatarPath(`other/0f8fad5b-d9cb-469f-a165-70867728950e.webp`, uid)).toBe(false);
    expect(isOwnAvatarPath(`${uid}/x/0f8fad5b-d9cb-469f-a165-70867728950e.webp`, uid)).toBe(false);
    expect(isOwnAvatarPath(`${uid}/0f8fad5b-d9cb-469f-a165-70867728950e.svg`, uid)).toBe(false);
  });
});

describe("authErrorMessage", () => {
  it("maps known codes and hides unknown ones", () => {
    expect(authErrorMessage("invalid_credentials")).toBe("Incorrect email or password.");
    expect(authErrorMessage("some_internal_code")).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage(undefined)).toBe(GENERIC_AUTH_ERROR);
  });
});
