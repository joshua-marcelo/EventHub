import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { generateTemporaryPassword, TEMPORARY_PASSWORD_LENGTH } from "./temporary-password";
import { passwordSchema } from "@/lib/validation/auth";

describe("temporary passwords", () => {
  it("are long, unambiguous, valid passwords and do not repeat", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const value = generateTemporaryPassword();
      expect(value).toHaveLength(TEMPORARY_PASSWORD_LENGTH);
      expect(value).not.toMatch(/[01OIl]/);
      expect(value).toMatch(/[a-z]/); expect(value).toMatch(/[A-Z]/); expect(value).toMatch(/[0-9]/);
      expect(passwordSchema.safeParse(value).success).toBe(true);
      seen.add(value);
    }
    expect(seen.size).toBe(500);
  });
});
