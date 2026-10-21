import "server-only";

import { randomInt } from "node:crypto";

// No look-alike characters (0/O, 1/l/I), so a password read aloud or copied by hand survives.
const LETTERS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const ALPHABET = LETTERS + DIGITS;
export const TEMPORARY_PASSWORD_LENGTH = 16;

/**
 * A one-time temporary password from the CSPRNG (crypto.randomInt is uniform, no modulo bias).
 * 16 characters from 56 symbols ≈ 93 bits. Always contains a lowercase letter, an uppercase
 * letter and a digit, so it satisfies passwordSchema. Never logged or stored: Supabase Auth keeps only its hash.
 */
export function generateTemporaryPassword(): string {
  for (;;) {
    let value = "";
    for (let i = 0; i < TEMPORARY_PASSWORD_LENGTH; i++) value += ALPHABET[randomInt(ALPHABET.length)];
    // Lowercase, uppercase and digit, so it also passes a stricter hosted password policy.
    if (/[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value)) return value;
  }
}
