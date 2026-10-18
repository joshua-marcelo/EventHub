import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ requireOrganizer: vi.fn(), requireUser: vi.fn(), requireAdmin: vi.fn(), createClient: vi.fn(), rpc: vi.fn(), owner: vi.fn(), revalidate: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ requireOrganizer: m.requireOrganizer, requireUser: m.requireUser, requireAdmin: m.requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: m.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
import { eventAction, saveEvent } from "./actions";

const adminId = "c1000000-0000-4000-8000-0000000000ad";
const otherOrganizer = "c1000000-0000-4000-8000-000000000002";
const ownEvent = "c1000000-0000-4000-8000-0000000000e1";
const othersEvent = "c1000000-0000-4000-8000-0000000000e2";
const draft = { title: "Admin seminar", description: "", venue: "", category_id: "", host_college_id: "", starts_at: "", ends_at: "", registration_opens_at: "", registration_closes_at: "", capacity: "", approval_mode: "automatic", visibility: "public" };
const admin = { id: adminId, isAdmin: true, organizerStatus: "none" };

beforeEach(() => {
  vi.resetAllMocks();
  m.requireOrganizer.mockResolvedValue(admin);
  m.requireUser.mockResolvedValue(admin);
  m.createClient.mockResolvedValue({ rpc: m.rpc, from: () => ({ select: () => ({ eq: (_: string, id: string) => ({ maybeSingle: () => m.owner(id) }) }) }) });
  m.owner.mockImplementation(async (id: string) => ({ data: { organizer_id: id === ownEvent ? adminId : otherOrganizer } }));
  m.rpc.mockImplementation(async (name: string) => ({ data: name === "save_event" ? { code: "ok", id: ownEvent } : "ok", error: null }));
});

describe("Admin acting in the Organizer workspace", () => {
  it("creates events through save_event without passing an owner, so the database assigns auth.uid()", async () => {
    expect(await saveEvent(null, draft)).toMatchObject({ ok: true, id: ownEvent });
    expect(m.requireOrganizer).toHaveBeenCalled();
    expect(m.rpc).toHaveBeenCalledExactlyOnceWith("save_event", { p_id: null, p_values: expect.not.objectContaining({ organizer_id: expect.anything() }) });
  });

  it("edits and publishes only events the Admin owns", async () => {
    expect(await saveEvent(ownEvent, draft)).toMatchObject({ ok: true });
    expect(await eventAction(ownEvent, "publish")).toMatchObject({ ok: true });
    expect(m.rpc).toHaveBeenCalledWith("publish_event", { p_id: ownEvent });
  });

  it.each([["save", () => saveEvent(othersEvent, draft)], ["publish", () => eventAction(othersEvent, "publish")], ["delete", () => eventAction(othersEvent, "delete")]])("refuses to %s another organizer's event", async (_, run) => {
    expect(await run()).toMatchObject({ ok: false, code: "not_permitted" });
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("keeps the existing Admin cancel power on other organizers' events, with a reason", async () => {
    expect(await eventAction(othersEvent, "cancel", "")).toMatchObject({ ok: false, code: "reason_required" });
    expect(await eventAction(othersEvent, "cancel", "Venue unavailable")).toMatchObject({ ok: true });
    expect(m.rpc).toHaveBeenCalledExactlyOnceWith("cancel_event", { p_id: othersEvent, p_reason: "Venue unavailable" });
  });

  it.each(["suspended", "revoked"])("refuses a %s organizer (not Admin) publishing their own event", async status => {
    m.requireOrganizer.mockResolvedValue({ id: adminId, isAdmin: false, organizerStatus: status });
    expect(await eventAction(ownEvent, "publish")).toMatchObject({ ok: false, code: "not_permitted" });
    expect(m.rpc).not.toHaveBeenCalled();
  });
});
