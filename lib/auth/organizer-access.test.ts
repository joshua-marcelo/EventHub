import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ profile: vi.fn(), claims: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("react", async importOriginal => ({ ...await importOriginal<typeof import("react")>(), cache: (fn: unknown) => fn }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); }, notFound: () => { throw new Error("notFound"); } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: m.claims }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: m.profile }) }) }) }) }));
import { requireOrganizer, requireUser } from "./dal";

beforeEach(() => {
  vi.resetAllMocks();
  m.claims.mockResolvedValue({ data: { claims: { sub: "invited-user", email: "invitee@example.test", is_anonymous: false } }, error: null });
  m.profile.mockResolvedValue({ data: { first_name: "Casey", is_complete: false, is_admin: false, organizer_status: "active" } });
});
describe("Organizer access independent of student onboarding", () => {
  it("allows an active invited Organizer with an incomplete student profile", async () => {
    expect(await requireOrganizer()).toMatchObject({ organizerStatus: "active", isComplete: false });
  });
  it("continues to require student onboarding for Participant operations", async () => {
    await expect(requireUser()).rejects.toThrow("redirect:/onboarding");
  });
  it.each(["suspended", "revoked"])("keeps %s Organizers read-only", async status => {
    m.profile.mockResolvedValue({ data: { is_complete: false, organizer_status: status } });
    await expect(requireOrganizer()).rejects.toThrow("redirect:/become-organizer");
    expect(await requireOrganizer({ allowInactive: true })).toMatchObject({ organizerStatus: status });
  });
  it("does not grant Organizer access to ordinary Participants", async () => {
    m.profile.mockResolvedValue({ data: { is_complete: true, organizer_status: "none" } });
    await expect(requireOrganizer({ allowInactive: true })).rejects.toThrow("redirect:/become-organizer");
  });
  it("lets an Admin use the Organizer workspace without organizer status or an invitation", async () => {
    m.profile.mockResolvedValue({ data: { is_complete: true, is_admin: true, organizer_status: "none" } });
    expect(await requireOrganizer()).toMatchObject({ isAdmin: true, organizerStatus: "none" });
  });
  it("lets a suspended organizer who is independently an Admin keep organizer tools", async () => {
    m.profile.mockResolvedValue({ data: { is_complete: true, is_admin: true, organizer_status: "suspended" } });
    expect(await requireOrganizer()).toMatchObject({ isAdmin: true, organizerStatus: "suspended" });
  });
});
