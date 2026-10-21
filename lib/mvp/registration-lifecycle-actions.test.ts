import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ organizer: vi.fn(), user: vi.fn(), rpc: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ requireOrganizer: m.organizer, requireUser: m.user, requireAdmin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: m.rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath: m.refresh }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { setEventRegistration, registrationAction } from "./actions";
const id = "d5e00000-0000-4000-8000-000000000001";
beforeEach(() => { vi.resetAllMocks(); m.rpc.mockResolvedValue({ data: "ok", error: null }); });
it.each([true, false])("authenticates and delegates registration state %s to the atomic RPC", async open => {
  expect(await setEventRegistration(id, open)).toMatchObject({ ok: true });
  expect(m.organizer).toHaveBeenCalledOnce();
  expect(m.rpc).toHaveBeenCalledExactlyOnceWith("set_event_registration", { p_event_id: id, p_open: open });
  expect(m.refresh).toHaveBeenCalled();
});
it("rejects invalid IDs before accessing the database", async () => {
  expect(await setEventRegistration("invalid", true)).toMatchObject({ ok: false });
  expect(m.rpc).not.toHaveBeenCalled();
});
it("shows the server refusal to reopen after attendance and does not refresh", async () => {
  m.rpc.mockResolvedValue({ data: "attendance_started", error: null });
  expect(await setEventRegistration(id, true)).toMatchObject({ ok: false, code: "attendance_started" });
  expect(m.refresh).not.toHaveBeenCalled();
});
it("keeps the existing registration RPC authoritative for direct action calls", async () => {
  m.rpc.mockResolvedValue({ data: "registration_closed", error: null });
  expect(await registrationAction(id, "register")).toMatchObject({ ok: false, code: "registration_closed" });
  expect(m.user).toHaveBeenCalledOnce();
  expect(m.rpc).toHaveBeenCalledExactlyOnceWith("register_for_event", { p_event_id: id });
});
