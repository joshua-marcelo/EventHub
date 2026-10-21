import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ requireOrganizer: vi.fn(), createClient: vi.fn(), lookups: vi.fn(), resolve: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/dal", () => ({ requireOrganizer: m.requireOrganizer, requireAdmin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: m.createClient }));
vi.mock("@/lib/mvp/queries", () => ({ eventLookups: m.lookups }));
import { getOrganizerOverview, getSidebarEvents } from "./hub";

type Call = [string, ...unknown[]];
type Query = { table: string; calls: Call[] };
let queries: Query[] = [];
/** Records each PostgREST chain; m.resolve(query) decides the response. */
function client() {
  return { from: (table: string) => {
    const q: Query = { table, calls: [] };
    queries.push(q);
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "neq", "in", "or", "order", "range", "limit"]) chain[method] = (...args: unknown[]) => { q.calls.push([method, ...args]); return chain; };
    chain.then = (ok: (v: unknown) => unknown) => Promise.resolve(m.resolve(q)).then(ok);
    return chain;
  } };
}
const has = (q: Query, ...call: unknown[]) => q.calls.some(c => JSON.stringify(c) === JSON.stringify(call));
const head = (q: Query) => q.calls.some(c => c[0] === "select" && (c[2] as { head?: boolean } | undefined)?.head);

const me = "a1000000-0000-4000-8000-000000000001";
const NOW = Date.parse("2026-10-18T00:00:00Z");
const ev = (id: string, status: string, starts_at: string | null, extra = {}) => ({ id, title: `Event ${id}`, status, starts_at, venue: "Hall", capacity: 100, approval_mode: "manual", description: "A description long enough.", category_id: 1, host_college_id: 1, registration_opens_at: "2026-10-01T00:00:00Z", registration_closes_at: "2026-10-30T00:00:00Z", ...extra });
const E = { pub: "e1000000-0000-4000-8000-000000000001", past: "e1000000-0000-4000-8000-000000000002", draft: "e1000000-0000-4000-8000-000000000003", ready: "e1000000-0000-4000-8000-000000000004" };
const events = [
  ev(E.pub, "published", "2026-11-01T00:00:00Z"),
  ev(E.past, "completed", "2026-09-01T00:00:00Z"),
  ev(E.draft, "draft", null, { description: null, venue: null }),
  ev(E.ready, "draft", "2026-12-01T00:00:00Z", { registration_closes_at: "2026-11-30T00:00:00Z" }),
];

beforeEach(() => {
  vi.resetAllMocks();
  queries = [];
  m.requireOrganizer.mockResolvedValue({ id: me, isAdmin: false, organizerStatus: "active" });
  m.createClient.mockImplementation(async () => client());
  m.lookups.mockResolvedValue({ categories: [{ id: 1, name: "Talk", is_active: true }], colleges: [{ id: 1, name: "CICT", is_active: true }] });
  m.resolve.mockImplementation((q: Query) => {
    if (q.table === "events") return { data: events, count: events.length, error: null };
    if (q.table === "event_registrations" && head(q)) return { count: has(q, "eq", "status", "approved") ? 7 : 12, error: null };
    if (q.table === "event_registrations") return { data: [{ event_id: E.pub }, { event_id: E.pub }], error: null };
    if (q.table === "attendance_records") return { count: 5, error: null };
    return { data: [], error: null };
  });
});

describe("Organizer overview", () => {
  it("scopes every query to the signed-in organizer's own events", async () => {
    await getOrganizerOverview(NOW);
    const eventsQuery = queries.find(q => q.table === "events")!;
    expect(has(eventsQuery, "eq", "organizer_id", me)).toBe(true);
    for (const q of queries.filter(q => q.table !== "events")) expect(q.calls.some(c => (c[0] === "in" || c[0] === "eq") && c[1] === "event_id")).toBe(true);
    expect(queries.find(q => q.table === "event_registrations" && has(q, "in", "event_id", Object.values(E)))).toBeTruthy();
  });

  it("reports real totals using the report rules", async () => {
    const o = await getOrganizerOverview(NOW);
    expect(o.totals).toEqual({ events: 4, published: 1, registrations: 12, attended: 5 });
    expect(queries.some(q => q.table === "event_registrations" && has(q, "in", "status", ["approved", "pending"]))).toBe(true);
    expect(queries.some(q => q.table === "attendance_records" && has(q, "eq", "status", "present"))).toBe(true);
  });

  it("lists upcoming published events and drafts with their missing publishing details", async () => {
    const o = await getOrganizerOverview(NOW);
    expect(o.upcoming.map(e => e.id)).toEqual([E.pub]);
    expect(o.upcoming[0]).toMatchObject({ approved: 7, pending: 2 });
    expect(o.drafts.find(d => d.id === E.draft)!.missing.length).toBeGreaterThan(0);
    expect(o.drafts.find(d => d.id === E.ready)!.missing).toEqual([]);
  });

  it("shows only actionable attention items", async () => {
    const o = await getOrganizerOverview(NOW);
    expect(o.attention).toEqual([
      { kind: "pending", id: E.pub, title: `Event ${E.pub}`, count: 2 },
      expect.objectContaining({ kind: "incomplete", id: E.draft }),
    ]);
    m.requireOrganizer.mockResolvedValue({ id: me, isAdmin: false, organizerStatus: "suspended" });
    const readOnly = await getOrganizerOverview(NOW);
    expect(readOnly.canAct).toBe(false);
    expect(readOnly.attention.some(a => a.kind === "incomplete")).toBe(false);
  });

  it("skips activity queries when the organizer has no events", async () => {
    m.resolve.mockImplementation((q: Query) => q.table === "events" ? { data: [], error: null } : { data: [], error: null });
    const o = await getOrganizerOverview(NOW);
    expect(o.totals.events).toBe(0);
    expect(queries.map(q => q.table)).toEqual(["events"]);
  });

  it("is read-only for a suspended organizer and still scoped to their own events", async () => {
    m.requireOrganizer.mockResolvedValue({ id: me, isAdmin: false, organizerStatus: "suspended" });
    const o = await getOrganizerOverview(NOW);
    expect(o.canAct).toBe(false);
    expect(o.attention.every(a => a.kind === "pending")).toBe(true);
    expect(has(queries[0], "eq", "organizer_id", me)).toBe(true);
  });

  it("requires organizer access before any query", async () => {
    m.requireOrganizer.mockRejectedValue(new Error("redirect:/become-organizer"));
    await expect(getOrganizerOverview(NOW)).rejects.toThrow("redirect");
    expect(m.createClient).not.toHaveBeenCalled();
  });
});

describe("Sidebar My Events", () => {
  it("lists at most five of the user's own non-cancelled events, live and upcoming first", async () => {
    const many = [
      ev("past", "published", "2026-09-01T00:00:00Z", { ends_at: "2026-09-01T05:00:00Z" }),
      ev("live", "published", "2026-10-17T20:00:00Z", { ends_at: "2026-10-18T05:00:00Z" }),
      ev("soon", "published", "2026-11-01T00:00:00Z", { ends_at: null }),
      ev("d1", "draft", null), ev("d2", "draft", null), ev("d3", "draft", null),
    ];
    m.resolve.mockImplementation(() => ({ data: many, count: many.length, error: null }));
    const r = await getSidebarEvents(me, NOW);
    expect(r.events.map(e => e.id)).toEqual(["live", "soon", "d1", "d2", "d3"]);
    expect(r.more).toBe(true);
    expect(has(queries[0], "eq", "organizer_id", me)).toBe(true);
    expect(has(queries[0], "neq", "status", "cancelled")).toBe(true);
    expect(queries[0].calls.some(c => c[0] === "limit")).toBe(true);
  });
  it("hides the section rather than failing the page when the query fails", async () => {
    m.resolve.mockImplementation(() => ({ data: null, count: null, error: { code: "x" } }));
    expect(await getSidebarEvents(me, NOW)).toEqual({ events: [], more: false });
  });
});
