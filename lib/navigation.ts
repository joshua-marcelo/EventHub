import type { Database } from "@/lib/database.types";

export type Dashboard = "participant" | "organizer" | "admin";
export type Permissions = { isAdmin: boolean; isComplete: boolean; organizerStatus: Database["public"]["Enums"]["organizer_status"] };
// `destination` and `description` name the switch link shown in the other dashboards.
export const dashboards = {
  participant: { label: "Participant", href: "/dashboard", destination: "Participant Dashboard", description: "Switch to participant view" },
  organizer: { label: "Organizer", href: "/organizer", destination: "Organizer Dashboard", description: "Switch to organizer view" },
  admin: { label: "Admin", href: "/admin", destination: "Admin Dashboard", description: "Switch to admin view" },
} as const;
export const navigation = {
  participant: [
    { label: "Home", href: "/dashboard", icon: "home" },
    { label: "My Events", href: "/my-events", icon: "events" },
    { label: "Certificates", href: "/certificates", icon: "certificates" },
  ],
  organizer: [
    { label: "Overview", href: "/organizer", icon: "home" },
    { label: "My Organized Events", href: "/organizer/events", icon: "events" },
    { label: "Reports", href: "/organizer/reports", icon: "reports" },
  ],
  admin: [
    { label: "Overview", href: "/admin", icon: "home" },
    { label: "Applications", href: "/admin/applications", icon: "applications" },
    { label: "Organizers", href: "/admin/organizers", icon: "organizers" },
    // Every account is a participant (sign-up always creates one); roles are added on top.
    { label: "Participants", href: "/admin/users", icon: "people" },
    { label: "Reference Data", href: "/admin/lookups", icon: "reference" },
  ],
} as const;
export function permittedDashboards(user: Permissions): Dashboard[] {
  return ["participant", ...(user.organizerStatus !== "none" ? ["organizer"] : []), ...(user.isAdmin ? ["admin"] : [])] as Dashboard[];
}
export function defaultDashboard(user: Permissions) { return user.isAdmin && !user.isComplete ? "/admin" : "/dashboard"; }
export function dashboardForPath(path: string): Dashboard {
  if (path === "/admin" || path.startsWith("/admin/")) return "admin";
  if (path === "/organizer" || path.startsWith("/organizer/")) return "organizer";
  return "participant";
}
export function isActiveLink(path: string, href: string) {
  if (href === "/dashboard" && (path === "/events" || path.startsWith("/events/"))) return true;
  return path === href || (!["/dashboard", "/admin", "/organizer"].includes(href) && path.startsWith(`${href}/`));
}
export function isAttendanceDisplay(path: string) { return /^\/organizer\/events\/[^/]+\/attendance\/display\/?$/.test(path); }
