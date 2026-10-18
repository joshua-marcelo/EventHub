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
    { label: "Events", href: "/organizer/events", icon: "events" },
    { label: "Reports", href: "/organizer/reports", icon: "reports" },
  ],
  admin: [
    { label: "Overview", href: "/admin", icon: "home" },
    { label: "Organizers", href: "/admin/organizers", icon: "organizers" },
    // Every account is a participant (sign-up always creates one); roles are added on top.
    { label: "Participants", href: "/admin/users", icon: "people" },
    { label: "Reference Data", href: "/admin/lookups", icon: "reference" },
  ],
} as const;
/**
 * Organizer tools (create, edit, publish, attendance, certificates): active organizers, and admins
 * acting on events they own. Mirrors private.is_active_organizer() in the database, which stays the
 * authority; every organizer RPC is also limited to organizer_id = auth.uid().
 */
export function canUseOrganizerTools(user: Pick<Permissions, "isAdmin" | "organizerStatus">) {
  return user.isAdmin || user.organizerStatus === "active";
}
/** Organizer workspace visibility: everyone with organizer tools, plus suspended/revoked organizers (read-only). */
export function canViewOrganizerWorkspace(user: Pick<Permissions, "isAdmin" | "organizerStatus">) {
  return user.isAdmin || user.organizerStatus !== "none";
}
export function permittedDashboards(user: Permissions): Dashboard[] {
  return ["participant", ...(canViewOrganizerWorkspace(user) ? ["organizer"] : []), ...(user.isAdmin ? ["admin"] : [])] as Dashboard[];
}
/** Account-page context is presentation/navigation only, always limited to actual roles. */
export function resolveWorkspaceContext(user: Permissions, requested?: unknown): Dashboard {
  const allowed = permittedDashboards(user);
  if (typeof requested === "string" && allowed.includes(requested as Dashboard)) return requested as Dashboard;
  return user.isAdmin ? "admin" : user.organizerStatus !== "none" ? "organizer" : "participant";
}
export function accountProfileHref(workspace: Dashboard) { return `/account/profile?workspace=${workspace}`; }
export function isSharedAccountPath(path: string) { return path === "/account/profile" || path === "/profile"; }
export function defaultDashboard(user: Permissions) {
  if (user.isAdmin && !user.isComplete) return "/admin";
  return !user.isComplete && user.organizerStatus !== "none" ? "/organizer" : "/dashboard";
}
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
