import { describe, expect, it } from "vitest";
import { navigation, canUseOrganizerTools, canViewOrganizerWorkspace, defaultDashboard, permittedDashboards, dashboardForPath, isActiveLink, isAttendanceDisplay, resolveWorkspaceContext, accountProfileHref, isSharedAccountPath } from "@/lib/navigation";
const participant = { isAdmin: false, isComplete: true, organizerStatus: "none" as const };
describe("dashboard permissions and routes", () => {
  it("keeps the four admin modules without the retired Applications workflow", () => {
    expect(navigation.admin.map(({ label, href }) => ({ label, href }))).toEqual([
      { label: "Overview", href: "/admin" },
      { label: "Organizers", href: "/admin/organizers" },
      { label: "Participants", href: "/admin/users" },
      { label: "Reference Data", href: "/admin/lookups" },
    ]);
  });
  it("keeps participant navigation focused while discovery routes remain part of Home", () => {
    expect(navigation.participant.map(({ label, href }) => ({ label, href }))).toEqual([
      { label: "Home", href: "/dashboard" }, { label: "My Events", href: "/my-events" }, { label: "Certificates", href: "/certificates" },
    ]);
    expect(isActiveLink("/events", "/dashboard")).toBe(true);
    expect(isActiveLink("/events/event-id", "/dashboard")).toBe(true);
    expect(isActiveLink("/events-other", "/dashboard")).toBe(false);
    expect(isActiveLink("/scan", "/dashboard")).toBe(false);
  });
  it("offers only participant access to ordinary accounts", () => expect(permittedDashboards(participant)).toEqual(["participant"]));
  it.each(["active", "suspended", "revoked"] as const)("keeps %s organizers in the switcher", status => expect(permittedDashboards({ ...participant, organizerStatus: status })).toEqual(["participant", "organizer"]));
  it("combines admin and organizer access without role state", () => expect(permittedDashboards({ ...participant, organizerStatus: "active", isAdmin: true })).toEqual(["participant", "organizer", "admin"]));
  it("lands incomplete admins in admin and complete admins in participant", () => {
    expect(defaultDashboard({ ...participant, isAdmin: true, isComplete: false })).toBe("/admin");
    expect(defaultDashboard({ ...participant, isAdmin: true })).toBe("/dashboard");
    expect(defaultDashboard({ ...participant, isComplete: false })).toBe("/dashboard");
  });
  it.each(["active", "suspended", "revoked"] as const)("routes an incomplete %s Organizer to their authorized workspace", organizerStatus => {
    expect(defaultDashboard({ ...participant, isComplete: false, organizerStatus })).toBe("/organizer");
    expect(defaultDashboard({ ...participant, organizerStatus })).toBe("/dashboard");
  });
  it("matches route segments instead of prefix collisions", () => {
    expect(dashboardForPath("/administrator")).toBe("participant");
    expect(dashboardForPath("/admin/lookups")).toBe("admin");
    expect(dashboardForPath("/organizer/events/abc")).toBe("organizer");
    expect(isActiveLink("/organizer/events/new", "/organizer/events")).toBe(true);
    expect(isActiveLink("/organizer/events", "/organizer")).toBe(false);
    expect(isActiveLink("/events-other", "/events")).toBe(false);
  });
  it("limits fullscreen to attendance display", () => {
    expect(isAttendanceDisplay("/organizer/events/abc/attendance/display")).toBe(true);
    expect(isAttendanceDisplay("/organizer/events/abc/attendance")).toBe(false);
    expect(isAttendanceDisplay("/organizer/events/abc/attendance/display/settings")).toBe(false);
  });
});

describe("shared account workspace context", () => {
  const admin = { ...participant, isAdmin: true };
  const organizer = { ...participant, isComplete: false, organizerStatus: "active" as const };
  it("defaults direct account visits to an actual authorized workspace", () => {
    expect(resolveWorkspaceContext(admin)).toBe("admin");
    expect(resolveWorkspaceContext(organizer)).toBe("organizer");
    expect(resolveWorkspaceContext(participant)).toBe("participant");
  });
  it("retains explicit authorized context for multi-workspace users", () => {
    expect(resolveWorkspaceContext(admin, "participant")).toBe("participant");
    expect(resolveWorkspaceContext({ ...admin, organizerStatus: "active" }, "organizer")).toBe("organizer");
  });
  it.each(["admin", "organizer", "https://evil.test", "__proto__", ["admin", "participant"], null])("does not grant permissions from untrusted context %o", requested => {
    expect(resolveWorkspaceContext(participant, requested)).toBe("participant");
  });
  it("gives Admins the Organizer workspace without changing their organizer status", () => {
    expect(permittedDashboards(admin)).toEqual(["participant", "organizer", "admin"]);
    expect(resolveWorkspaceContext(admin, "organizer")).toBe("organizer");
    expect(admin.organizerStatus).toBe("none");
  });
});

describe("organizer capability", () => {
  const participant = { isAdmin: false, organizerStatus: "none" as const };
  it("matches the database rule: active organizers and admins use organizer tools", () => {
    expect(canUseOrganizerTools({ ...participant, organizerStatus: "active" })).toBe(true);
    expect(canUseOrganizerTools({ ...participant, isAdmin: true })).toBe(true);
    expect(canUseOrganizerTools(participant)).toBe(false);
  });
  it.each(["suspended", "revoked"] as const)("keeps %s organizers read-only unless independently Admin", status => {
    expect(canUseOrganizerTools({ ...participant, organizerStatus: status })).toBe(false);
    expect(canViewOrganizerWorkspace({ ...participant, organizerStatus: status })).toBe(true);
    expect(canUseOrganizerTools({ isAdmin: true, organizerStatus: status })).toBe(true);
  });
  it("never shows Admin or Organizer workspaces to ordinary participants", () => {
    expect(canViewOrganizerWorkspace(participant)).toBe(false);
    expect(permittedDashboards({ ...participant, isComplete: true })).toEqual(["participant"]);
  });
  it("uses one account route and keeps student details outside shared workspace context", () => {
    expect(accountProfileHref("admin")).toBe("/account/profile?workspace=admin");
    expect(accountProfileHref("organizer")).toBe("/account/profile?workspace=organizer");
    expect(isSharedAccountPath("/profile")).toBe(true);
    expect(isSharedAccountPath("/account/profile")).toBe(true);
    expect(isSharedAccountPath("/profile/student")).toBe(false);
  });
});
