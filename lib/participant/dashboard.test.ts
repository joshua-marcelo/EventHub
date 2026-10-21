import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createClient("https://eventhub.test", "test-key", { global: { fetch: m.fetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }) }));
import { getParticipantDashboard } from "./dashboard";
import { getMyRegistrations } from "./registrations";

const me = "a1000000-0000-4000-8000-000000000001";
const registration = { id: "reg-1", event_id: "event-1", status: "approved", events: { title: "Campus forum", starts_at: "2099-01-01T00:00:00Z", status: "published" } };
type Read = { url: URL; method: string };
let reads: Read[];
function response(data: unknown, count?: number) {
  return new Response(data === null ? null : JSON.stringify(data), { status: 200, headers: { "content-type": "application/json", ...(count !== undefined ? { "content-range": `0-0/${count}` } : {}) } });
}
beforeEach(() => {
  vi.resetAllMocks(); reads = [];
  m.fetch.mockImplementation(async (input: string, init: RequestInit) => {
    const url = new URL(input), method = init.method ?? "GET";
    reads.push({ url, method });
    if (method === "HEAD") return response(null, url.pathname.endsWith("event_registrations") ? 12 : 3);
    if (url.pathname.endsWith("event_registrations")) return response([registration]);
    if (url.pathname.endsWith("attendance_records")) return response([{ registration_id: "reg-1", status: "present" }]);
    return response([{ id: "new-event", title: "Another event", starts_at: "2099-02-01T00:00:00Z", venue: "Campus Hall" }]);
  });
});

describe("participant dashboard read queries", () => {
  it("returns exact participant totals independent of the limited registration preview", async () => {
    const data = await getParticipantDashboard(me);
    expect(data.registeredCount).toBe(12);
    expect(data.attendedCount).toBe(3);
    expect(data.registrations).toEqual([expect.objectContaining({ eventId: "event-1", attendance: "present" })]);
    const counts = reads.filter(r => r.method === "HEAD");
    expect(counts).toHaveLength(2);
    for (const { url } of counts) expect(url.searchParams.get("user_id")).toBe(`eq.${me}`);
    expect(counts.find(r => r.url.pathname.endsWith("event_registrations"))?.url.searchParams.get("status")).toBe("neq.cancelled");
    expect(counts.find(r => r.url.pathname.endsWith("attendance_records"))?.url.searchParams.get("status")).toBe("eq.present");
    expect(reads.every(r => ["HEAD", "GET"].includes(r.method))).toBe(true);
  });
  it("filters discoveries to future public published events and excludes all own active registrations before limiting", async () => {
    await getParticipantDashboard(me);
    const query = reads.find(r => r.url.pathname.endsWith("/events"))!.url.searchParams;
    expect(query.get("status")).toBe("eq.published");
    expect(query.get("visibility")).toBe("eq.public");
    expect(query.get("starts_at")).toMatch(/^gt\./);
    expect(query.get("event_registrations.user_id")).toBe(`eq.${me}`);
    expect(query.get("event_registrations.status")).toBe("neq.cancelled");
    expect(query.get("event_registrations")).toBe("is.null");
    expect(query.get("limit")).toBe("4");
    expect(query.get("order")).toBe("starts_at.asc,id.asc");
  });
  it("reports actual zero counts and empty lists without generating sample activity", async () => {
    m.fetch.mockImplementation(async (_: string, init: RequestInit) => response(init.method === "HEAD" ? null : [], init.method === "HEAD" ? 0 : undefined));
    expect(await getParticipantDashboard(me)).toEqual({ registeredCount: 0, attendedCount: 0, registrations: [], upcoming: [] });
  });
  it.each(["event_registrations", "attendance_records", "events"])("surfaces %s read failures instead of showing fake zero/empty state", async table => {
    const normal = m.fetch.getMockImplementation()!;
    m.fetch.mockImplementation(async (input: string, init: RequestInit) => new URL(input).pathname.endsWith(`/${table}`) ? new Response(JSON.stringify({ message: "Read unavailable" }), { status: 400 }) : normal(input, init));
    await expect(getParticipantDashboard(me)).rejects.toThrow(/Could not load/);
  });
  it("preserves the sidebar's non-throwing behavior while the dashboard opts into visible errors", async () => {
    m.fetch.mockImplementation(async () => new Response(JSON.stringify({ message: "Unavailable" }), { status: 400 }));
    expect(await getMyRegistrations(me)).toEqual([]);
    await expect(getMyRegistrations(me, 4, { throwOnError: true })).rejects.toThrow("Could not load your registered events.");
  });
});
