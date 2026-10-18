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
vi.mock("@/components/auth/sign-out-buttons", () => ({ SignOutEverywhereButton: () => "Sign out everywhere" }));

import AccountPage from "@/app/(app)/account/profile/page";
import LegacyPage from "@/app/(app)/profile/page";

const base = { id: "actual-user", email: "account@example.test", isAdmin: false, isComplete: false, organizerStatus: "none", profile: { first_name: "Casey", last_name: "Account", middle_name: null, suffix: null, avatar_path: null, privacy_consented_at: null } };
beforeEach(() => { vi.resetAllMocks(); m.user.mockResolvedValue(base); m.avatar.mockResolvedValue(null); });

async function renderAccount(query: Record<string, string | string[] | undefined>) {
  const page = AccountPage({ params: Promise.resolve({}), searchParams: Promise.resolve(query) });
  return renderToStaticMarkup(await page.props.children.type(page.props.children.props));
}
async function legacyProfile(query: Record<string, string | string[] | undefined>) {
  const page = LegacyPage({ params: Promise.resolve({}), searchParams: Promise.resolve(query) });
  return page.props.children.type(page.props.children.props);
}
describe("one shared Account Profile route", () => {
  it("keeps an Admin in Admin context, with account fields and no Student Onboarding", async () => {
    m.user.mockResolvedValue({ ...base, isAdmin: true });
    const html = await renderAccount({ workspace: "admin" });
    expect(html).toContain("Back to Admin"); expect(html).toContain('href="/admin"');
    expect(html).toContain("account@example.test"); expect(html).toContain('aria-label="Account details"');
    expect(html).not.toContain('href="/onboarding"'); expect(m.options).not.toHaveBeenCalled();
    expect(m.user).toHaveBeenCalledWith({ allowIncomplete: true, next: "/account/profile" });
  });
  it("allows an invited Organizer without student data to edit the same account", async () => {
    m.user.mockResolvedValue({ ...base, organizerStatus: "active" });
    const html = await renderAccount({ workspace: "organizer" });
    expect(html).toContain("Back to Organizer"); expect(html).toContain('href="/organizer"');
    expect(html).not.toContain('href="/onboarding"'); expect(m.options).not.toHaveBeenCalled();
  });
  it("preserves a Participant's context and links student editing separately", async () => {
    const html = await renderAccount({ workspace: "participant" });
    expect(html).toContain("Back to Participant"); expect(html).toContain('href="/profile/student"');
  });
  it("canonicalizes a forged Admin context without granting it", async () => {
    await expect(renderAccount({ workspace: "admin" })).rejects.toThrow("redirect:/account/profile?workspace=participant");
  });
  it("resolves direct and repeated query parameters from actual roles", async () => {
    m.user.mockResolvedValue({ ...base, isAdmin: true });
    await expect(renderAccount({})).rejects.toThrow("redirect:/account/profile?workspace=admin");
    await expect(renderAccount({ workspace: ["organizer", "participant"] })).rejects.toThrow("redirect:/account/profile?workspace=admin");
  });
  it("keeps legacy /profile links usable without defaulting Admins to Participant", async () => {
    m.user.mockResolvedValue({ ...base, isAdmin: true });
    await expect(legacyProfile({})).rejects.toThrow("redirect:/account/profile?workspace=admin");
  });
});
