import "server-only";

import { requireAdmin } from "@/lib/auth/dal";
import type { Database } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const PAGE_SIZE = 10;
/** Outstanding invitations are excluded by id; past this the URL filter gets too long (see getParticipantDirectory). */
export const MAX_EXCLUDED_INVITATIONS = 300;
export type DirectoryParams = { q: string; college: number | null; page: number };
type OrganizerStatus = Database["public"]["Enums"]["organizer_status"];
export type DirectoryRow = {
  id: string; first_name: string | null; last_name: string | null; email: string; student_id: string | null;
  is_admin: boolean; is_complete: boolean | null; organizer_status: OrganizerStatus; identity_flagged_at: string | null;
  created_at: string; colleges: { name: string } | null;
};

const one = (value: string | string[] | undefined) => typeof value === "string" ? value : "";

// Keep only characters that appear in names, emails and student IDs; this also keeps
// PostgREST filter syntax (commas, parentheses, wildcards) out of the query.
export function searchTerm(value: string | string[] | undefined) { return one(value).replace(/[^\p{L}\p{N}@._\- ]/gu, "").trim().slice(0, 80); }

/** Untrusted URL parameters → a bounded, typed directory query. Unknown values (including the retired `profile`) are ignored. */
export function parseDirectoryParams(sp: Record<string, string | string[] | undefined>): DirectoryParams {
  const q = searchTerm(sp.q);
  const college = /^\d{1,5}$/.test(one(sp.college)) ? Number(one(sp.college)) : null;
  const page = /^\d{1,6}$/.test(one(sp.page)) ? Math.max(1, Number(one(sp.page))) : 1;
  // Searches shorter than 2 characters are ignored rather than running a near-unfiltered ilike.
  return { q: q.length >= 2 ? q : "", college: college && college > 0 ? college : null, page };
}

export function hasFilters(p: DirectoryParams) { return Boolean(p.q || p.college); }

/** URL for the directory with the given state; page 1 and defaults are omitted to keep URLs short. */
export function directoryHref(p: DirectoryParams, overrides: Partial<DirectoryParams> = {}) {
  const next = { ...p, ...overrides };
  const sp = new URLSearchParams();
  if (next.q) sp.set("q", next.q);
  if (next.college) sp.set("college", String(next.college));
  if (next.page > 1) sp.set("page", String(next.page));
  const s = sp.toString();
  return s ? `/admin/users?${s}` : "/admin/users";
}

export function pageWindow(page: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (current - 1) * PAGE_SIZE + 1;
  return { current, totalPages, from, to: Math.min(total, current * PAGE_SIZE), hasPrevious: current > 1, hasNext: current < totalPages };
}

/** Student-profile wording shared by the directory and the user details page. */
export function profileStatus({ isComplete, isOrganizer }: { isComplete: boolean | null; isOrganizer: boolean }) {
  if (isComplete) return { label: "Complete", optional: false };
  // Organizer access never depends on student onboarding; it is needed only to join events as a Participant.
  if (isOrganizer) return { label: "Not required", optional: true };
  return { label: "Incomplete", optional: false };
}

const COLUMNS = "id,first_name,last_name,email,student_id,is_admin,is_complete,organizer_status,identity_flagged_at,created_at,colleges(name)";
const MISSING_TABLE = ["PGRST205", "42P01"];

/**
 * One page of regular Participant accounts for the Admin directory. Admin-only (requireAdmin, then the
 * profiles RLS admin policy); classification, search, counting and paging all run in Postgres via
 * PostgREST, so only PAGE_SIZE rows ever leave the database.
 *
 * Regular Participant = not an admin, never an organizer (organizer_status stays 'none' only if access
 * was never granted: no transition returns to 'none'), and not an outstanding organizer invitee
 * (invitees' accounts were pre-created with id = invitation id by the retired email-invitation workflow).
 * Retired QA accounts are also left out (see retiredQaAccountIds).
 * This is directory classification only; roles and permissions are unchanged.
 */
export async function getParticipantDirectory(params: DirectoryParams) {
  const admin = await requireAdmin();
  const client = await createClient();

  const invitations = await client.from("organizer_invitations").select("id").neq("state", "accepted").limit(MAX_EXCLUDED_INVITATIONS + 1);
  // Before the invitation migration nobody can have been invited.
  if (invitations.error && !MISSING_TABLE.includes(invitations.error.code)) throw new Error("Could not load participants.");
  const inviteeIds = (invitations.data ?? []).map(i => i.id);
  // Fail closed rather than listing invitees as Participants once the id list is too long for one request.
  if (inviteeIds.length > MAX_EXCLUDED_INVITATIONS) throw new Error("Too many outstanding organizer invitations to classify participants.");

  const retiredQaIds = await retiredQaAccountIds();

  const page = async (n: number) => {
    let query = client.from("profiles").select(COLUMNS, { count: "exact" }).eq("is_admin", false).eq("organizer_status", "none");
    if (inviteeIds.length) query = query.not("id", "in", `(${inviteeIds.join(",")})`);
    if (retiredQaIds.length) query = query.not("id", "in", `(${retiredQaIds.join(",")})`);
    if (params.q) query = query.or(["first_name", "last_name", "email", "student_id"].map(c => `${c}.ilike.%${params.q}%`).join(","));
    if (params.college) query = query.eq("college_id", params.college);
    const from = (n - 1) * PAGE_SIZE;
    return query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  };

  let result = await page(params.page);
  // A page past the end (stale link, records removed) comes back empty with the real count; show the last page instead.
  if (!result.error && result.count && params.page > 1 && (params.page - 1) * PAGE_SIZE >= result.count) result = await page(pageWindow(params.page, result.count).current);
  if (result.error) throw new Error("Could not load participants.");
  const rows = (result.data ?? []) as DirectoryRow[];
  const total = result.count ?? rows.length;

  return { adminId: admin.id, rows, total, window: pageWindow(params.page, total) };
}

/** A domain under the reserved `.test` TLD (RFC 2606): no real mailbox can exist there. */
export function isReservedTestEmail(email: string | undefined) { return /@([a-z0-9-]+\.)*test$/i.test(email ?? ""); }

/**
 * Retired QA accounts = banned in Supabase Auth AND on a reserved `.test` domain. Both must hold: a ban
 * alone could be a real participant, and a `.test` address alone is never hidden while it can sign in.
 * Records are only hidden from this directory; profiles, Auth users and audit logs are untouched.
 * Without the Admin API key nothing is hidden (fail open toward showing accounts, never hiding real ones).
 */
export async function retiredQaAccountIds(now = Date.now()) {
  let admin;
  try { admin = createAdminClient(); } catch { return []; }
  const ids: string[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return [];
    for (const u of data.users) if (u.banned_until && Date.parse(u.banned_until) > now && isReservedTestEmail(u.email)) ids.push(u.id);
    if (data.users.length < 1000) break;
  }
  return ids.slice(0, MAX_EXCLUDED_INVITATIONS);
}

export async function getCollegeOptions() {
  await requireAdmin();
  const { data, error } = await (await createClient()).from("colleges").select("id,name").order("name");
  if (error) throw new Error("Could not load colleges.");
  return data;
}
