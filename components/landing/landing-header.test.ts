import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { homeFor } from "@/lib/navigation";
import { LandingHeader } from "./landing-header";

// Keep server auth actions out of the component rendering test.
vi.mock("@/components/auth/sign-out-buttons", () => ({ useSignOut: () => [false, vi.fn()] }));
// Next's static image imports need its bundler; the logo is unchanged by this work.
vi.mock("@/components/shared/brand-logo", () => ({ BrandLogo: () => "EventHub" }));

describe("landing navigation", () => {
  it("keeps guest auth links and public section navigation", () => {
    const html = renderToStaticMarkup(createElement(LandingHeader, { account: null }));
    for (const href of ["/login", "/signup", "#features", "#how-it-works", "#about"]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).not.toContain("Account menu");
    expect(html).not.toContain("Go to Dashboard");
    expect(html).not.toContain("Log Out");
  });

  it("does not show guest actions before the server session resolves", () => {
    const html = renderToStaticMarkup(createElement(LandingHeader));
    expect(html).toContain("Loading account");
    expect(html).not.toContain('href="/login"');
    expect(html).not.toContain('href="/signup"');
    expect(html).not.toContain("Account menu");
  });

  it.each([
    { isAdmin: false, isComplete: true, organizerStatus: "none" as const },
    { isAdmin: false, isComplete: true, organizerStatus: "active" as const },
    { isAdmin: true, isComplete: true, organizerStatus: "none" as const },
    { isAdmin: true, isComplete: false, organizerStatus: "none" as const },
  ])("renders one closed account control without redundant actions for %o", permissions => {
    const html = renderToStaticMarkup(createElement(LandingHeader, {
      account: { dashboardHref: homeFor(permissions), firstName: "Alex", initial: "A" },
    }));
    expect(html.match(/aria-label="Account menu, Alex"/g)).toHaveLength(1);
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('href="/login"');
    expect(html).not.toContain('href="/signup"');
    expect(html).not.toContain("Go to Dashboard");
    expect(html).not.toContain("Log Out");
  });

  it("supports an account without a first name", () => {
    const html = renderToStaticMarkup(createElement(LandingHeader, {
      account: { dashboardHref: "/dashboard", firstName: "", initial: "E" },
    }));
    expect(html).toContain('aria-label="Account menu"');
    expect(html).toContain('aria-hidden="true">E</span>');
  });
});
