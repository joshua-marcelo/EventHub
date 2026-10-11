import { describe, expect, it } from "vitest";
import { defaultDashboard, permittedDashboards, dashboardForPath, isActiveLink, isAttendanceDisplay } from "@/lib/navigation";
const participant = { isAdmin: false, isComplete: true, organizerStatus: "none" as const };
describe("dashboard permissions and routes", () => {
  it("offers only participant access to ordinary accounts", () => expect(permittedDashboards(participant)).toEqual(["participant"]));
  it.each(["active", "suspended", "revoked"] as const)("keeps %s organizers in the switcher", status => expect(permittedDashboards({ ...participant, organizerStatus: status })).toEqual(["participant", "organizer"]));
  it("combines admin and organizer access without role state", () => expect(permittedDashboards({ ...participant, organizerStatus: "active", isAdmin: true })).toEqual(["participant", "organizer", "admin"]));
  it("lands incomplete admins in admin and complete admins in participant", () => {
    expect(defaultDashboard({ ...participant, isAdmin: true, isComplete: false })).toBe("/admin");
    expect(defaultDashboard({ ...participant, isAdmin: true })).toBe("/dashboard");
    expect(defaultDashboard({ ...participant, isComplete: false })).toBe("/dashboard");
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
