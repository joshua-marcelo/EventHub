import type { Database } from "@/lib/database.types";

export type Dashboard = "participant" | "organizer" | "admin";
export type Permissions = { isAdmin: boolean; isComplete: boolean; organizerStatus: Database["public"]["Enums"]["organizer_status"] };
export const dashboards = {
  participant: { label: "Participant", href: "/dashboard" },
  organizer: { label: "Organizer", href: "/organizer" },
  admin: { label: "Admin", href: "/admin" },
} as const;
export const navigation = {
  participant: [
    { label: "Home", href: "/dashboard", icon: "home" },
    { label: "Explore", href: "/events", icon: "explore" },
    { label: "Scan", href: "/scan", icon: "scan" },
    { label: "My Events", href: "/my-events", icon: "events" },
    { label: "Certificates", href: "/certificates", icon: "certificates" },
    { label: "Become an organizer", href: "/become-organizer", icon: "organizer" },
  ],
  organizer: [
    { label: "Overview", href: "/organizer", icon: "home" },
    { label: "My Organized Events", href: "/organizer/events", icon: "events" },
    { label: "Reports", href: "/organizer/reports", icon: "reports" },
  ],
  admin: [
    { label: "Overview", href: "/admin", icon: "home" },
    { label: "Applications", href: "/admin/applications", icon: "organizer" },
    { label: "Organizers", href: "/admin/organizers", icon: "people" },
    { label: "Users", href: "/admin/users", icon: "people" },
    { label: "Lookups", href: "/admin/lookups", icon: "settings" },
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
  return path === href || (!["/dashboard", "/admin", "/organizer"].includes(href) && path.startsWith(`${href}/`));
}
export function isAttendanceDisplay(path: string) { return /^\/organizer\/events\/[^/]+\/attendance\/display\/?$/.test(path); }
