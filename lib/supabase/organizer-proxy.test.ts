import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ claims: vi.fn(), profile: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims: m.claims }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: m.profile }) }) }) }) }));
import { updateSession } from "./proxy";
beforeEach(() => {
  vi.resetAllMocks();
  m.claims.mockResolvedValue({ data: { claims: { sub: "organizer-id", is_anonymous: false } } });
  m.profile.mockResolvedValue({ data: { is_admin: false, is_complete: false, organizer_status: "active" } });
});
describe("Organizer proxy routing", () => {
  it("does not send an authorized invited Organizer to Student Onboarding", async () => {
    const result = await updateSession(new NextRequest("https://eventhub.test/organizer/events"));
    expect(result.headers.get("location")).toBeNull();
  });
  it("routes an already signed-in invited Organizer away from login to their workspace", async () => {
    const result = await updateSession(new NextRequest("https://eventhub.test/login"));
    expect(result.headers.get("location")).toBe("https://eventhub.test/organizer");
  });
  it("continues to block ordinary Participants from Organizer routes", async () => {
    m.profile.mockResolvedValue({ data: { is_admin: false, is_complete: true, organizer_status: "none" } });
    const result = await updateSession(new NextRequest("https://eventhub.test/organizer"));
    expect(result.headers.get("location")).toBe("https://eventhub.test/become-organizer");
  });
  it("keeps the invitation route accessible without a session", async () => {
    m.claims.mockResolvedValue({ data: null });
    const result = await updateSession(new NextRequest("https://eventhub.test/accept-invitation"));
    expect(result.headers.get("location")).toBeNull();
  });
  it("lets an Admin open Organizer routes directly", async () => {
    m.profile.mockResolvedValue({ data: { is_admin: true, is_complete: true, organizer_status: "none" } });
    const result = await updateSession(new NextRequest("https://eventhub.test/organizer/events/new"));
    expect(result.headers.get("location")).toBeNull();
    expect(result.status).not.toBe(404);
  });
  it("still returns 404 for non-admins on Admin routes, including active organizers", async () => {
    const result = await updateSession(new NextRequest("https://eventhub.test/admin/organizers"));
    expect(result.status).toBe(404);
  });
  it.each(["suspended", "revoked"])("keeps %s organizers in the read-only Organizer workspace", async status => {
    m.profile.mockResolvedValue({ data: { is_admin: false, is_complete: true, organizer_status: status } });
    const result = await updateSession(new NextRequest("https://eventhub.test/organizer/events"));
    expect(result.headers.get("location")).toBeNull();
  });
});
