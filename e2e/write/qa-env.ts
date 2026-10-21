import { randomBytes } from "node:crypto";
import { deflateSync } from "node:zlib";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { expect, type BrowserContext, type Page } from "@playwright/test";

/*
 * Write scenarios only. Runs against the database in .env.local, which the owner approved for
 * clearly-labelled QA records (qa-*@example.test, "QA ..." events). Never touches other accounts.
 * Passwords live only in memory for the run; nothing secret is logged or written to disk.
 */
loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const run = Date.now().toString(36);
export const qaEmail = (role: string) => `qa-${role}-${run}@example.test`;
export const strongPassword = () => `Qa${randomBytes(9).toString("base64url")}7x`;

function service() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is required for QA setup");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** A QA-only Admin (never the real one). Demoted again by demoteQaAdmin() after the run. */
export async function createQaAdmin() {
  const admin = service();
  const email = qaEmail("admin"), password = strongPassword();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { first_name: "QA", last_name: "Admin" } });
  if (created.error || !created.data.user) throw new Error(`QA admin create failed: ${created.error?.code}`);
  const id = created.data.user.id;
  const promoted = await admin.from("profiles").update({ is_admin: true }).eq("id", id);
  if (promoted.error) throw new Error(`QA admin promote failed: ${promoted.error.code}`);
  return { id, email, password };
}
export async function demoteQaAdmin(id: string) {
  await service().from("profiles").update({ is_admin: false }).eq("id", id);
}

/** Read-only: any existing event not owned by the given account (for ownership checks). */
export async function someoneElsesEventId(ownerEmail: string) {
  const db = service();
  const { data: owner } = await db.from("profiles").select("id").eq("email", ownerEmail).single();
  const { data } = await db.from("events").select("id").neq("organizer_id", owner!.id).limit(1).maybeSingle();
  return data?.id ?? "00000000-0000-4000-8000-000000000000";
}

/** The organizer's own attendance QR token, fetched exactly as the attendance display does. */
export async function currentAttendanceToken(email: string, password: string, eventId: string) {
  const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw new Error(`organizer sign-in failed: ${signedIn.error.code}`);
  const { data, error } = await client.rpc("get_attendance_qr", { p_event_id: eventId });
  await client.auth.signOut({ scope: "local" });
  if (error) throw new Error(`get_attendance_qr failed: ${error.code}`);
  const now = Date.now();
  const tokens = (data as { tokens: { token: string; valid_from: string; valid_until: string }[] }).tokens;
  return (tokens.find(t => Date.parse(t.valid_from) <= now && now < Date.parse(t.valid_until)) ?? tokens[0]).token;
}

/** A real, valid PNG (solid colour) built in memory. */
export function png(width: number, height: number, rgb: [number, number, number] = [234, 88, 12]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf: Buffer) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3).map((_, i) => rgb[i % 3])]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/** datetime-local value in Philippine time (UTC+8, no DST), which the event form uses. */
export const manila = (ms: number) => new Date(ms + 8 * 3_600_000).toISOString().slice(0, 16);

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: /^log in$/i }).click();
}
export async function logout(page: Page) {
  await page.waitForLoadState("networkidle"); // the account menu works once hydrated
  // Next keeps previous routes hidden in the DOM, so only visible controls are used.
  // Below md the sidebar lives in the mobile menu sheet.
  if (page.viewportSize()!.width < 768) await page.getByRole("button", { name: "Open menu" }).filter({ visible: true }).click();
  await page.getByRole("button", { name: /^Account menu/ }).filter({ visible: true }).first().click();
  await page.getByRole("menuitem", { name: "Log Out" }).click();
  await expect(page).toHaveURL(/\/$/);
}
export async function changePassword(page: Page, current: string, next: string) {
  await page.getByRole("textbox", { name: /Temporary password|Current password/ }).fill(current);
  await page.getByRole("textbox", { name: "New password", exact: true }).fill(next);
  await page.getByRole("textbox", { name: "Confirm new password" }).fill(next);
  await page.getByRole("button", { name: "Change Password" }).click();
}
export async function newContext(ctx: () => Promise<BrowserContext>) {
  const c = await ctx();
  await c.grantPermissions(["clipboard-read", "clipboard-write"]);
  return c;
}
