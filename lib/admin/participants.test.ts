import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ requireAdmin: vi.fn(), createClient: vi.fn(), createAdminClient: vi.fn(), failProfiles: false, failInvitations: null as null | { code: string } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/dal", () => ({ requireAdmin: m.requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: m.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: m.createAdminClient }));
import { MAX_EXCLUDED_INVITATIONS, PAGE_SIZE, isReservedTestEmail, directoryHref, getParticipantDirectory, pageWindow, parseDirectoryParams, profileStatus } from "./participants";
import { getOrganizerDirectory } from "./organizers";

type Row = Record<string, unknown>;
type Call = [string, ...unknown[]];

/** Minimal in-memory PostgREST: evaluates the filters the directory uses, then orders, counts and ranges. */
function table(rows: () => Row[], calls: Call[][], fail: () => unknown) {
  const own: Call[] = [];
  calls.push(own);
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "not", "or", "order", "range", "limit", "in"]) chain[method] = (...args: unknown[]) => { own.push([method, ...args]); return chain; };
  chain.then = (ok: (v: unknown) => unknown) => {
    const error = fail();
    if (error) return Promise.resolve({ data: null, count: null, error }).then(ok);
    let data = rows().filter(r => own.every(([method, col, op, value]) => {
      if (method === "eq") return r[col as string] === op;
      if (method === "neq") return r[col as string] !== op;
      if (method === "not" && op === "in") return !String(value).slice(1, -1).split(",").includes(String(r[col as string]));
      if (method === "or") return String(col).split(",").some(clause => { const [c, , pattern] = clause.split("."); return String(r[c] ?? "").toLowerCase().includes(pattern.replaceAll("%", "").toLowerCase()); });
      return true;
    }));
    const count = data.length;
    if (own.some(c => c[0] === "order" && c[1] === "created_at")) data = [...data].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const range = own.find(c => c[0] === "range") as [string, number, number] | undefined;
    if (range) data = data.slice(range[1], range[2] + 1);
    return Promise.resolve({ data, count, error: null }).then(ok);
  };
  return chain;
}

const person = (id: string, i: number, extra: Row = {}): Row => ({ id, first_name: `Person${i}`, last_name: "Test", email: `${id}@example.test`, student_id: `S-${i}`, is_admin: false, is_complete: i % 2 === 0, organizer_status: "none", identity_flagged_at: null, college_id: i % 3 === 0 ? 4 : 7, created_at: `2026-10-${String(i + 1).padStart(2, "0")}T00:00:00Z`, colleges: null, ...extra });
const regulars = Array.from({ length: 23 }, (_, i) => person(`p${i}`, i));
const others = [
  person("admin", 30, { is_admin: true }),
  person("active-org", 31, { organizer_status: "active" }),
  person("suspended-org", 32, { organizer_status: "suspended" }),
  person("revoked-org", 33, { organizer_status: "revoked" }),
  person("admin-org", 34, { is_admin: true, organizer_status: "active" }),
  person("invitee", 35), // pre-created account of a pending invitation: still organizer_status 'none'
];
let invitations: Row[] = [];
let profileCalls: Call[][] = [];

beforeEach(() => {
  vi.resetAllMocks();
  m.failProfiles = false; m.failInvitations = null;
  invitations = [{ id: "invitee", state: "pending" }];
  profileCalls = [];
  const inviteCalls: Call[][] = [];
  m.requireAdmin.mockResolvedValue({ id: "admin" });
  m.createAdminClient.mockImplementation(() => { throw new Error("Account administration is not configured."); });
  m.createClient.mockResolvedValue({
    from: (name: string) => name === "profiles"
      ? table(() => [...regulars, ...others], profileCalls, () => m.failProfiles && { code: "42501" })
      : table(() => invitations, inviteCalls, () => m.failInvitations),
  });
});

const run = (sp: Record<string, string> = {}) => getParticipantDirectory(parseDirectoryParams(sp));
const ids = (rows: { id: string }[]) => rows.map(r => r.id);

describe("Participants directory classification", () => {
  it("lists only regular participants: no admins, no organizers of any status, no pending invitees", async () => {
    const all = [];
    for (let page = 1; page <= 3; page++) all.push(...ids((await run({ page: String(page) })).rows));
    expect(all).toHaveLength(23);
    expect(all).toEqual(expect.arrayContaining(ids(regulars as { id: string }[])));
    for (const excluded of ["admin", "active-org", "suspended-org", "revoked-org", "admin-org", "invitee"]) expect(all).not.toContain(excluded);
  });

  it("classifies before counting and paging: 10 per page, newest first, total of participants only", async () => {
    const r = await run();
    expect(r.total).toBe(23);
    expect(ids(r.rows)).toEqual(["p22", "p21", "p20", "p19", "p18", "p17", "p16", "p15", "p14", "p13"]);
    expect(r.window).toMatchObject({ current: 1, from: 1, to: 10, totalPages: 3, hasPrevious: false, hasNext: true });
    expect(profileCalls[0]).toEqual(expect.arrayContaining([["eq", "is_admin", false], ["eq", "organizer_status", "none"], ["not", "id", "in", "(invitee)"], ["range", 0, 9]]));
  });

  it("serves the last page and clamps pages past the end", async () => {
    expect((await run({ page: "3" })).window).toMatchObject({ current: 3, from: 21, to: 23, hasNext: false });
    const clamped = await run({ page: "9" });
    expect(clamped.window.current).toBe(3);
    expect(ids(clamped.rows)).toEqual(["p2", "p1", "p0"]);
  });

  it("searches name, email or student ID only among eligible accounts, combined with college and paging", async () => {
    expect(ids((await run({ q: "Person3" })).rows)).toEqual(["p3"]); // Person30–35 are excluded accounts
    expect((await run({ q: "admin" })).total).toBe(0);
    expect(ids((await run({ q: "S-1" })).rows)).toEqual(["p19", "p18", "p17", "p16", "p15", "p14", "p13", "p12", "p11", "p10"]);
    const filtered = await run({ q: "Test", college: "4", page: "1" });
    expect(filtered.total).toBe(8); // p0, p3, …, p21
    expect(filtered.rows.every(r => (r as unknown as Row).college_id === 4)).toBe(true);
  });

  it("works before the invitation migration exists", async () => {
    m.failInvitations = { code: "PGRST205" };
    const r = await run();
    expect(r.total).toBe(24); // the pre-created invitee cannot exist yet in this case; only role filters apply
    expect(profileCalls[0].some(c => c[0] === "not")).toBe(false);
  });

  it("fails closed when invitations cannot be read or are too many to exclude", async () => {
    m.failInvitations = { code: "42501" };
    await expect(run()).rejects.toThrow("Could not load participants.");
    m.failInvitations = null;
    invitations = Array.from({ length: MAX_EXCLUDED_INVITATIONS + 1 }, (_, i) => ({ id: `i${i}`, state: "pending" }));
    await expect(run()).rejects.toThrow("Too many outstanding organizer invitations");
  });

  it("requires Admin authorization before any query", async () => {
    m.requireAdmin.mockRejectedValue(new Error("notFound"));
    await expect(run()).rejects.toThrow("notFound");
    expect(m.createClient).not.toHaveBeenCalled();
  });

  it("surfaces query errors instead of showing an empty directory", async () => {
    m.failProfiles = true;
    await expect(run()).rejects.toThrow("Could not load participants.");
  });
});

describe("Retired QA accounts", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const authUsers = (users: { id: string; email: string; banned_until?: string }[]) => m.createAdminClient.mockReturnValue({ auth: { admin: { listUsers: vi.fn().mockResolvedValue({ data: { users }, error: null }) } } });

  it("hides only accounts that are both banned in Auth and on a reserved .test domain, before counting", async () => {
    regulars.push(person("qa-real-domain", 40, { email: "qa-participant@gmail.com" }));
    try {
      authUsers([
        { id: "p22", email: "p22@example.test", banned_until: future }, // retired QA account
        { id: "p21", email: "p21@example.test" }, // .test but not banned: still listed
        { id: "qa-real-domain", email: "qa-participant@gmail.com", banned_until: future }, // banned, real domain: still listed
        { id: "p20", email: "p20@example.test", banned_until: "2000-01-01T00:00:00Z" }, // ban expired: still listed
      ]);
      const r = await run();
      expect(r.total).toBe(23);
      expect(ids(r.rows)).not.toContain("p22");
      expect(ids(r.rows)).toEqual(expect.arrayContaining(["qa-real-domain", "p21", "p20"]));
      expect(profileCalls[0]).toEqual(expect.arrayContaining([["not", "id", "in", "(p22)"]]));
    } finally { regulars.pop(); }
  });

  it("hides nothing when the Admin API is unavailable or fails", async () => {
    expect((await run()).total).toBe(23);
    m.createAdminClient.mockReturnValue({ auth: { admin: { listUsers: vi.fn().mockResolvedValue({ data: null, error: { message: "x" } }) } } });
    expect((await run()).total).toBe(23);
  });

  it("recognizes only the reserved .test TLD", () => {
    expect(isReservedTestEmail("qa@example.test")).toBe(true);
    expect(isReservedTestEmail("qa@mail.example.test")).toBe(true);
    for (const e of ["qa-test@gmail.com", "x@test.com", "x@example.testing", undefined]) expect(isReservedTestEmail(e)).toBe(false);
  });
});

describe("Organizer Management classification", () => {
  it("keeps active, suspended and revoked organizers and excludes admin accounts", async () => {
    const { organizers } = await getOrganizerDirectory();
    expect(ids(organizers.data as { id: string }[]).sort()).toEqual(["active-org", "revoked-org", "suspended-org"]);
  });
  it("requires Admin authorization", async () => {
    m.requireAdmin.mockRejectedValue(new Error("notFound"));
    await expect(getOrganizerDirectory()).rejects.toThrow("notFound");
    expect(m.createClient).not.toHaveBeenCalled();
  });
});

describe("directory parameters and labels", () => {
  it("ignores invalid, unsafe and retired URL values", () => {
    expect(parseDirectoryParams({ q: "a", college: "x", profile: "complete", page: "-2" })).toEqual({ q: "", college: null, page: 1 });
    expect(parseDirectoryParams({ q: "jo%,()", college: "0", page: "abc" })).toEqual({ q: "jo", college: null, page: 1 });
  });

  it("keeps search and college in pagination links and omits page 1", () => {
    const p = parseDirectoryParams({ q: "Casey", college: "4", page: "2" });
    expect(directoryHref(p, { page: 3 })).toBe("/admin/users?q=Casey&college=4&page=3");
    expect(directoryHref(p, { page: 1 })).toBe("/admin/users?q=Casey&college=4");
    expect(directoryHref(parseDirectoryParams({}))).toBe("/admin/users");
  });

  it("computes empty and boundary windows", () => {
    expect(PAGE_SIZE).toBe(10);
    expect(pageWindow(1, 0)).toMatchObject({ current: 1, from: 0, to: 0, totalPages: 1, hasNext: false });
    expect(pageWindow(2, 10)).toMatchObject({ current: 1, hasNext: false });
    expect(pageWindow(2, 11)).toMatchObject({ current: 2, from: 11, to: 11 });
  });

  it("labels missing student profiles, keeping invited organizers as not required on the details page", () => {
    expect(profileStatus({ isComplete: null, isOrganizer: false }).label).toBe("Incomplete");
    expect(profileStatus({ isComplete: false, isOrganizer: true })).toEqual({ label: "Not required", optional: true });
    expect(profileStatus({ isComplete: true, isOrganizer: true }).label).toBe("Complete");
  });
});
