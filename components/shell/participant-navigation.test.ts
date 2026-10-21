// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";
import { EventEntryActions } from "@/components/participant/event-entry-actions";
import type { MyRegistration } from "@/lib/participant/labels";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/attendance-actions", () => ({ submitScan: vi.fn() }));
vi.mock("@/lib/participant/invite", () => ({ resolveInviteCode: vi.fn() }));
vi.mock("@/components/shell/account-menu", () => ({ AccountMenu: ({ compact }: { compact: boolean }) => createElement("button", { "data-compact": String(compact) }, "Account menu") }));
vi.mock("@/components/shared/brand-logo", () => ({ BrandLogo: () => "EventHub" }));
afterEach(cleanup);
const registration: MyRegistration = { id: "reg1", eventId: "event1", title: "Student forum", startsAt: "2099-01-01T00:00:00Z", status: "approved", attendance: null, eventStatus: "published" };
function setup() {
  const props = { user: { name: "Alex", email: "alex@test.local", isAdmin: false, isComplete: true, organizerStatus: "none" as const }, myRegistrations: [registration], children: null };
  render(createElement(AppShell, props, createElement(EventEntryActions)));
  return userEvent.setup();
}
function checkNavigation(container: HTMLElement) {
  const nav = within(container).getByRole("navigation", { name: "Participant navigation" });
  expect(within(nav).getAllByRole("link").map(a => a.getAttribute("href"))).toEqual(["/dashboard", "/events"]);
  expect(container.querySelector('a[href="/scan"]')).toBeNull();
  expect(within(container).getByRole("button", { name: "Account menu" })).toBeTruthy();
}
it("keeps expanded contextual registrations and the footer account menu without a scanner entry", async () => {
  const user = setup();
  const sidebar = screen.getByRole("complementary", { name: "Participant sidebar" });
  checkNavigation(sidebar);
  await user.click(within(sidebar).getByRole("button", { name: "Student forum" }));
  expect(within(sidebar).getByText("Approved")).toBeTruthy();
  expect(within(sidebar).getByText("Not Yet Recorded")).toBeTruthy();
  expect(within(sidebar).getByRole("link", { name: "Event details" }).getAttribute("href")).toBe("/events/event1");
  await user.click(within(sidebar).getByRole("button", { name: "My registered events" }));
  expect(within(sidebar).queryByRole("button", { name: "Student forum" })).toBeNull();
  expect(within(screen.getByRole("main")).getByRole("button", { name: "Scan QR Code" })).toBeTruthy();
});
it("keeps accessible labels, event links and the account menu in the collapsed rail", async () => {
  const user = setup();
  const sidebar = screen.getByRole("complementary", { name: "Participant sidebar" });
  await user.click(within(sidebar).getByRole("button", { name: "Collapse sidebar" }));
  checkNavigation(sidebar);
  expect(within(sidebar).getByRole("button", { name: "Expand sidebar" }).getAttribute("aria-expanded")).toBe("false");
  expect(within(sidebar).getByRole("link", { name: "Student forum" }).getAttribute("href")).toBe("/events/event1");
  expect(within(sidebar).getByRole("button", { name: "Account menu" }).getAttribute("data-compact")).toBe("true");
  await user.click(within(sidebar).getByRole("button", { name: "Expand sidebar" }));
  expect(within(sidebar).getByRole("button", { name: "My registered events" })).toBeTruthy();
});
it("uses two mobile destinations, supports the contextual drawer, and closes it on navigation", async () => {
  const user = setup();
  const quick = screen.getByRole("navigation", { name: "Participant quick navigation" });
  expect(within(quick).getAllByRole("link").map(a => a.textContent)).toEqual(["Dashboard", "Events"]);
  expect(quick.querySelector('a[href="/scan"]')).toBeNull();
  await user.click(screen.getByRole("button", { name: "Open menu" }));
  const drawer = screen.getByRole("dialog");
  checkNavigation(drawer);
  const controlled = Array.from(document.querySelectorAll('[aria-controls]')).map(el => el.getAttribute("aria-controls"));
  const listIds = Array.from(document.querySelectorAll('button[aria-controls][aria-expanded]')).filter(el => el.textContent?.includes("My registered events")).map(el => el.getAttribute("aria-controls"));
  expect(new Set(listIds).size).toBe(listIds.length);
  expect(controlled.length).toBeGreaterThan(0);
  await user.click(within(drawer).getByRole("button", { name: "Student forum" }));
  await user.click(within(drawer).getByRole("link", { name: "Event details" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
