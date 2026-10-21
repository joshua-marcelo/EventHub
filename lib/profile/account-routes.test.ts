import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ user: vi.fn(), avatar: vi.fn(), options: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ requireUser: m.user }));
vi.mock("@/lib/profile/queries", () => ({ getAvatarUrl: m.avatar, getProfileOptions: m.options }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/components/profile/account-profile-form", () => ({ AccountProfileForm: () => createElement("form", { "aria-label": "Account details" }) }));
vi.mock("@/components/profile/avatar-upload", () => ({ AvatarUpload: () => "Shared account photo" }));
vi.mock("@/components/profile/privacy-consent", () => ({ PrivacyConsent: () => "Privacy consent" }));
vi.mock("@/components/profile/student-details-form", () => ({ StudentDetailsForm: () => createElement("form", { "aria-label": "Student details" }) }));

import AccountPage from "@/app/(app)/account/profile/page";
import LegacyPage from "@/app/(app)/profile/page";

const base = { id: "actual-user", email: "account@example.test", isAdmin: false, isComplete: false, organizerStatus: "none", profile: { first_name: "Casey", last_name: "Account", middle_name: null, suffix: null, avatar_path: null, privacy_consented_at: null } };
beforeEach(() => { vi.resetAllMocks(); m.user.mockResolvedValue(base); m.avatar.mockResolvedValue(null); m.options.mockResolvedValue({ colleges: [], programs: [] }); });

async function renderAccount(query: Record<string, string | string[] | undefined>) {
  const page = AccountPage({ params: Promise.resolve({}), searchParams: Promise.resolve(query) });
  return renderToStaticMarkup(await page.props.children.type(page.props.children.props));
}
describe("one shared Account Profile route", () => {
  it("returns an Admin to Admin, with account fields and no Student Onboarding", async () => {
    m.user.mockResolvedValue({ ...base, isAdmin: true });
    const html = await renderAccount({});
    expect(html).toContain("Back to Admin"); expect(html).toContain('href="/admin"');
    expect(html).toContain("account@example.test"); expect(html).toContain('aria-label="Account details"');
    expect(html).not.toContain('href="/onboarding"');
    expect(m.user).toHaveBeenCalledWith({ allowIncomplete: true, next: "/account/profile" });
  });
  it("lets an Organizer leave student details empty (optional) without onboarding", async () => {
    m.user.mockResolvedValue({ ...base, organizerStatus: "active" });
    const html = await renderAccount({});
    expect(html).toContain("Back to Organizer"); expect(html).toContain('href="/organizer"');
    expect(html).toContain("(optional)"); expect(html).toContain('aria-label="Student details"');
    expect(html).not.toContain('href="/onboarding"');
  });
  it("keeps student details on the same page for a Participant, with the onboarding requirement", async () => {
    const html = await renderAccount({});
    expect(html).toContain("Back to Dashboard"); expect(html).toContain('id="student-details"');
    expect(html).toContain('href="/onboarding"'); expect(html).not.toContain('href="/profile/student"');
  });
  it("ignores a legacy or forged workspace parameter without granting anything", async () => {
    const html = await renderAccount({ workspace: "admin" });
    expect(html).toContain('href="/dashboard"'); expect(html).not.toContain('href="/admin"');
  });
  it("sends password help to the administrator instead of self-service controls", async () => {
    const html = await renderAccount({});
    expect(html).toContain("For account or password assistance, please contact your administrator.");
    for (const removed of ['href="/change-password"', "Sign out everywhere", 'href="/privacy"', 'href="/forgot-password"']) expect(html).not.toContain(removed);
  });
  it("keeps legacy /profile links usable", () => {
    expect(() => LegacyPage()).toThrow("redirect:/account/profile");
  });
});
