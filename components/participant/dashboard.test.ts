// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/attendance-actions", () => ({ submitScan: vi.fn() }));
vi.mock("@/lib/participant/invite", () => ({ resolveInviteCode: vi.fn() }));
import { ParticipantDashboard } from "./dashboard";
import type { ParticipantDashboardData } from "@/lib/participant/dashboard";
afterEach(cleanup);
const data: ParticipantDashboardData = {
  registeredCount: 15, attendedCount: 8,
  registrations: [
    { id: "r1", eventId: "event1", title: "Student leadership forum", startsAt: "2099-01-01T01:00:00Z", eventStatus: "published", status: "approved", attendance: "present" },
    { id: "r2", eventId: "event2", title: "Research fair", startsAt: "2099-01-02T01:00:00Z", eventStatus: "published", status: "pending", attendance: null },
    { id: "r3", eventId: "event3", title: "Sports festival", startsAt: null, eventStatus: "published", status: "rejected", attendance: null },
  ],
  upcoming: [{ id: "event4", title: "Campus concert", starts_at: "2099-02-01T01:00:00Z", venue: "University Hall" }],
};
it("welcomes the participant and displays the supplied real totals, not preview lengths", () => {
  render(createElement(ParticipantDashboard, { firstName: "Alex", data }));
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Welcome back, Alex!");
  expect(screen.getByText("Discover events and keep track of your participation.")).toBeTruthy();
  expect(screen.getByText("Registered Events").nextElementSibling?.textContent).toBe("15");
  expect(screen.getByText("Events Attended").nextElementSibling?.textContent).toBe("8");
});
it("keeps equally styled invite and in-place scanner actions", () => {
  render(createElement(ParticipantDashboard, { firstName: "Alex", data }));
  const invite = screen.getByRole("button", { name: "Join by Invite Code" }), scan = screen.getByRole("button", { name: "Scan QR Code" });
  expect(invite.className).toBe(scan.className);
  expect(invite.parentElement?.className).toContain("flex-col");
  // Compact actions sit in the page header, beside the welcome heading.
  expect(invite.closest("div")?.parentElement?.querySelector("h1")).toBeTruthy();
});
it("renders linked registered cards with separate, readable registration and attendance badges", () => {
  render(createElement(ParticipantDashboard, { firstName: "Alex", data }));
  const section = screen.getByRole("region", { name: "My Registered Events" });
  for (const registration of data.registrations) {
    const card = within(section).getByRole("link", { name: new RegExp(registration.title) });
    expect(card.getAttribute("href")).toBe(`/events/${registration.eventId}`);
    expect(within(card).getByText("Registration")).toBeTruthy();
    expect(within(card).getByText("Attendance")).toBeTruthy();
  }
  for (const label of ["Pending Approval", "Approved", "Rejected", "Present"]) expect(within(section).getByText(label).getAttribute("data-slot")).toBe("badge");
  expect(within(section).getAllByText("Not Yet Recorded")).toHaveLength(2);
  expect(within(section).getByText("Date to be announced")).toBeTruthy();
});
it("does not show an Upcoming Events section", () => {
  render(createElement(ParticipantDashboard, { firstName: "Alex", data }));
  expect(screen.queryByRole("region", { name: "Upcoming Events" })).toBeNull();
  expect(screen.queryByText("Campus concert")).toBeNull();
});
it("uses compact honest empty states while preserving both primary actions", () => {
  render(createElement(ParticipantDashboard, { firstName: "Alex", data: { registeredCount: 0, attendedCount: 0, registrations: [], upcoming: [] } }));
  expect(screen.getByText("No registered events yet.")).toBeTruthy();
  expect(screen.getAllByText("0")).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Join by Invite Code" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Scan QR Code" })).toBeTruthy();
  expect(screen.queryByRole("list")).toBeNull();
});
