import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspaceSwitcher } from "./workspace-switcher";

describe("Workspace Switcher server-rendered states", () => {
  it("omits the switcher for a Participant-only account", () => {
    expect(renderToStaticMarkup(createElement(WorkspaceSwitcher, { current: "participant", permitted: ["participant"] }))).toBe("");
  });
  it("renders a closed button trigger without an immediate navigation link", () => {
    const html = renderToStaticMarkup(createElement(WorkspaceSwitcher, { current: "admin", permitted: ["participant", "admin"] }));
    expect(html).toContain('aria-label="Switch workspace, current Admin Workspace"');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Switch workspace");
    expect(html).not.toContain("href=");
  });
  it("keeps a named menu button in the collapsed rail", () => {
    const html = renderToStaticMarkup(createElement(WorkspaceSwitcher, { current: "organizer", permitted: ["participant", "organizer"], compact: true }));
    expect(html).toContain('aria-label="Switch workspace, current Organizer Workspace"');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).not.toContain("href=");
  });
});
