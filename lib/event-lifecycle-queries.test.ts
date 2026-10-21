import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: m.rpc }) }));
import { getEventLifecycle } from "./event-lifecycle-queries";
beforeEach(() => vi.resetAllMocks());
const state = { registration_open: false, registration_enabled: false, can_open_registration: false, attendance_started: true, attendance_kind: "time_in", next_attendance_kind: "time_in", can_scan_attendance: true };
it("uses the authenticated database eligibility rather than event timestamps", async () => {
  m.rpc.mockResolvedValue({ data: state, error: null });
  expect(await getEventLifecycle("event")).toEqual(state);
  expect(m.rpc).toHaveBeenCalledExactlyOnceWith("get_event_lifecycle", { p_event_id: "event" });
});
it.each([{ data: null, error: null }, { data: {}, error: null }, { data: state, error: { code: "PGRST202" } }])("fails closed on missing, invalid or unavailable state", async response => {
  m.rpc.mockResolvedValue(response);
  expect(await getEventLifecycle("event")).toBeNull();
});
