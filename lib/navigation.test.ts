import { describe, expect, it } from "vitest";
import { navigation, navigationFor, eventIdFromPath, eventSectionHref, eventSections, isActiveEventSection, canUseOrganizerTools, canViewOrganizerWorkspace, homeFor, landingFor, roleDashboard, shellDashboard, isActiveLink, isAttendanceDisplay } from "@/lib/navigation";
const participant = { isAdmin: false, isComplete: true, organizerStatus: "none" as const };
const admin = { ...participant, isAdmin: true };
const organizer = { ...participant, isComplete: false, organizerStatus: "active" as const };

describe("navigation per account", () => {
  it("keeps the four admin modules without the retired Applications workflow", () => {
    expect(navigation.admin.map(({ label, href }) => ({ label, href }))).toEqual([
      { label: "Overview", href: "/admin" },
      { label: "Organizers", href: "/admin/organizers" },
      { label: "Participants", href: "/admin/users" },
      { label: "Reference Data", href: "/admin/lookups" },
    ]);
  });
  it("gives Participants Dashboard and Events only (no Certificates or My Events pages)", () => {
    expect(navigation.participant.map(({ label, href }) => ({ label, href }))).toEqual([
      { label: "Dashboard", href: "/dashboard" }, { label: "Events", href: "/events" },
    ]);
    expect(isActiveLink("/events/event-id", "/events")).toBe(true);
    expect(isActiveLink("/events", "/dashboard")).toBe(false);
    expect(isActiveLink("/scan", "/dashboard")).toBe(false);
  });
  it("gives Organizers Overview and Create Event; events live under MY EVENTS", () => {
    expect(navigation.organizer.map(i => [i.label, i.href])).toEqual([["Overview", "/organizer"], ["Create Event", "/organizer/events/new"]]);
    expect(isActiveLink("/organizer/events/new", "/organizer/events/new")).toBe(true);
    expect(isActiveLink("/organizer/events/abc", "/organizer")).toBe(false);
  });
  it("matches route segments instead of prefix collisions", () => {
    expect(isActiveLink("/organizer/events", "/organizer")).toBe(false);
    expect(isActiveLink("/events-other", "/events")).toBe(false);
  });
  it("limits fullscreen to attendance display", () => {
    expect(isAttendanceDisplay("/organizer/events/abc/attendance/display")).toBe(true);
    expect(isAttendanceDisplay("/organizer/events/abc/attendance")).toBe(false);
    expect(isAttendanceDisplay("/organizer/events/abc/attendance/display/settings")).toBe(false);
  });
});

describe("role destinations without workspace switching", () => {
  it("lands each account in its own home, by priority Admin, Organizer, Participant", () => {
    expect(homeFor(admin)).toBe("/admin");
    expect(homeFor({ ...admin, organizerStatus: "active" })).toBe("/admin");
    expect(homeFor(organizer)).toBe("/organizer");
    expect(homeFor(participant)).toBe("/dashboard");
  });
  it("sends an incomplete Participant straight to Student Onboarding, never other roles", () => {
    expect(landingFor({ ...participant, isComplete: false })).toBe("/onboarding");
    expect(landingFor(participant)).toBe("/dashboard");
    expect(landingFor({ ...admin, isComplete: false })).toBe("/admin");
    expect(landingFor(organizer)).toBe("/organizer");
  });
  it.each(["suspended", "revoked"] as const)("keeps a %s Organizer in the (read-only) Organizer experience", organizerStatus => {
    expect(roleDashboard({ ...participant, organizerStatus })).toBe("organizer");
  });
  it("shows the account's own sidebar on shared pages", () => {
    expect(shellDashboard(admin, "/account/profile")).toBe("admin");
    expect(shellDashboard(organizer, "/events/abc")).toBe("organizer");
    expect(shellDashboard(organizer, "/my-events")).toBe("organizer");
    expect(shellDashboard(participant, "/account/profile")).toBe("participant");
  });
  it("never shows an area the account does not hold, whatever the URL", () => {
    expect(shellDashboard(participant, "/admin/users")).toBe("participant");
    expect(shellDashboard(participant, "/organizer")).toBe("participant");
    expect(shellDashboard(admin, "/organizer")).toBe("admin");
    expect(shellDashboard(organizer, "/admin")).toBe("organizer");
  });
  it("lets an account holding both roles reach both areas through plain links", () => {
    const both = { ...admin, organizerStatus: "active" as const };
    expect(shellDashboard(both, "/organizer/events")).toBe("organizer");
    expect(navigationFor(both, "admin").at(-1)).toMatchObject({ href: "/organizer" });
    expect(navigationFor(both, "organizer").at(-1)).toMatchObject({ href: "/admin" });
    expect(navigationFor(admin, "admin")).toEqual(navigation.admin);
    expect(navigationFor(organizer, "organizer")).toEqual(navigation.organizer);
  });
});

describe("organizer capability", () => {
  it("matches the database rule: only active Organizers use organizer tools; Admins are not Organizers unless granted", () => {
    expect(canUseOrganizerTools(organizer)).toBe(true);
    expect(canUseOrganizerTools(admin)).toBe(false);
    expect(canViewOrganizerWorkspace(admin)).toBe(false);
    expect(canUseOrganizerTools(participant)).toBe(false);
  });
  it.each(["suspended", "revoked"] as const)("keeps %s organizers read-only, even when also Admin", status => {
    expect(canUseOrganizerTools({ organizerStatus: status })).toBe(false);
    expect(canViewOrganizerWorkspace({ organizerStatus: status })).toBe(true);
  });
});

describe("event sections in My Events", () => {
  const id = "e1000000-0000-4000-8000-000000000001";
  it("offers only Overview, Registrations and Attendance, on the existing routes", () => {
    expect(eventSections.map(s => s.label)).toEqual(["Overview", "Registrations", "Attendance"]);
    expect(eventSections.map(s => eventSectionHref(id, s.segment))).toEqual([`/organizer/events/${id}`, `/organizer/events/${id}/registrations`, `/organizer/events/${id}/attendance`]);
  });
  it("highlights exactly one section; editing counts as Overview", () => {
    const active = (path: string) => eventSections.filter(s => isActiveEventSection(path, id, s.segment)).map(s => s.label);
    expect(active(`/organizer/events/${id}`)).toEqual(["Overview"]);
    expect(active(`/organizer/events/${id}/settings`)).toEqual(["Overview"]);
    expect(active(`/organizer/events/${id}/attendance/display`)).toEqual(["Attendance"]);
    expect(active(`/organizer/events/${id}/registrations`)).toEqual(["Registrations"]);
  });
  it("recognizes event workspace paths only", () => {
    expect(eventIdFromPath(`/organizer/events/${id}/attendance`)).toBe(id);
    expect(eventIdFromPath("/organizer/events/new")).toBeNull();
    expect(eventIdFromPath("/organizer/explore")).toBeNull();
  });
});
