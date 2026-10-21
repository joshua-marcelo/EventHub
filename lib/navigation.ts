import type { Database } from "@/lib/database.types";

export type Dashboard = "participant" | "organizer" | "admin";
export type Permissions = { isAdmin: boolean; isComplete: boolean; organizerStatus: Database["public"]["Enums"]["organizer_status"] };
export const dashboards = {
  participant: { label: "Participant", href: "/dashboard" },
  organizer: { label: "Organizer", href: "/organizer" },
  admin: { label: "Admin", href: "/admin" },
} as const;
export type NavItem = { label: string; href: string; icon: "home" | "dashboard" | "events" | "explore" | "attendance" | "people" | "organizers" | "reference" | "admin" | "scan" | "create" };
export const navigation = {
  // Registered events are listed below these, under MY REGISTERED EVENTS.
  participant: [
    { label: "Dashboard", href: "/dashboard", icon: "home" },
    { label: "Events", href: "/events", icon: "explore" },
  ],
  // Registrations and Attendance belong to one event, under MY EVENTS.
  organizer: [
    { label: "Overview", href: "/organizer", icon: "dashboard" },
    { label: "Create Event", href: "/organizer/events/new", icon: "create" },
  ],
  admin: [
    { label: "Overview", href: "/admin", icon: "home" },
    { label: "Organizers", href: "/admin/organizers", icon: "organizers" },
    { label: "Participants", href: "/admin/users", icon: "people" },
    { label: "Reference Data", href: "/admin/lookups", icon: "reference" },
  ],
} as const satisfies Record<Dashboard, readonly NavItem[]>;
/**
 * Organizer tools (create, edit, publish, attendance, certificates): active organizers only. Mirrors
 * private.is_active_organizer() in the database, which stays the authority; every organizer RPC is
 * also limited to organizer_id = auth.uid(). Administrators are not Organizers unless granted.
 */
export function canUseOrganizerTools(user: Pick<Permissions, "organizerStatus">) {
  return user.organizerStatus === "active";
}
/** Organizer workspace visibility: active organizers, plus suspended/revoked organizers (read-only). */
export function canViewOrganizerWorkspace(user: Pick<Permissions, "organizerStatus">) {
  return user.organizerStatus !== "none";
}
/** The account's own experience, by priority: Admin, then Organizer, then Participant. */
export function roleDashboard(user: Pick<Permissions, "isAdmin" | "organizerStatus">): Dashboard {
  return user.isAdmin ? "admin" : canViewOrganizerWorkspace(user) ? "organizer" : "participant";
}
/** Default destination after login and for the brand link. Navigation only; never grants access. */
export function homeFor(user: Pick<Permissions, "isAdmin" | "organizerStatus">) {
  return dashboards[roleDashboard(user)].href;
}
/** Where to send an account right after login or a password change: a Participant without student
 * details goes straight to Student Onboarding instead of bouncing through Home. */
export function landingFor(user: Pick<Permissions, "isAdmin" | "organizerStatus" | "isComplete">) {
  return roleDashboard(user) === "participant" && !user.isComplete ? "/onboarding" : homeFor(user);
}
function areaOfPath(path: string): Dashboard | null {
  if (path === "/admin" || path.startsWith("/admin/")) return "admin";
  if (path === "/organizer" || path.startsWith("/organizer/")) return "organizer";
  return null;
}
/**
 * Which sidebar to show. There is no workspace switcher: each account sees its own experience, and an
 * account that really holds two roles (an Admin who is also an Organizer) sees the area it is in.
 */
export function shellDashboard(user: Pick<Permissions, "isAdmin" | "organizerStatus">, path: string): Dashboard {
  const area = areaOfPath(path);
  if (area === "admin" && user.isAdmin) return "admin";
  if (area === "organizer" && canViewOrganizerWorkspace(user)) return "organizer";
  return roleDashboard(user);
}
/** Sidebar items, plus a plain link to the other area for the rare account holding both roles. */
export function navigationFor(user: Pick<Permissions, "isAdmin" | "organizerStatus">, dashboard: Dashboard): readonly NavItem[] {
  const items: readonly NavItem[] = navigation[dashboard];
  if (dashboard === "admin" && canViewOrganizerWorkspace(user)) return [...items, { label: "My Organizer Events", href: "/organizer", icon: "events" }];
  if (dashboard === "organizer" && user.isAdmin) return [...items, { label: "Administration", href: "/admin", icon: "admin" }];
  return items;
}
export const ACCOUNT_PROFILE_PATH = "/account/profile";
export const CHANGE_PASSWORD_PATH = "/change-password";
export function isActiveLink(path: string, href: string) {
  return path === href || (!["/dashboard", "/admin", "/organizer", "/organizer/events/new"].includes(href) && path.startsWith(`${href}/`));
}
/** Sections of one event, nested under the event in the Organizer sidebar's MY EVENTS. Editing starts from Overview. */
export const eventSections = [
  { segment: "", label: "Overview", icon: "dashboard" },
  { segment: "registrations", label: "Registrations", icon: "people" },
  { segment: "attendance", label: "Attendance", icon: "attendance" },
] as const;
export function eventSectionHref(eventId: string, segment: string) { return `/organizer/events/${eventId}${segment ? `/${segment}` : ""}`; }
/** Overview also covers its Edit page (/settings); other sections also match their sub-routes. */
export function isActiveEventSection(path: string, eventId: string, segment: string) {
  const href = eventSectionHref(eventId, segment);
  return segment ? path === href || path.startsWith(`${href}/`) : path === href || path === `${href}/settings`;
}
/** The event id when the path is inside one event workspace (not /organizer/events/new). */
export function eventIdFromPath(path: string) {
  const match = /^\/organizer\/events\/([0-9a-f-]{36})(?:\/|$)/i.exec(path);
  return match?.[1] ?? null;
}
export function isAttendanceDisplay(path: string) { return /^\/organizer\/events\/[^/]+\/attendance\/display\/?$/.test(path); }
