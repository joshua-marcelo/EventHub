import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { PageSkeleton } from "@/components/page-skeleton";
import { getCurrentUser } from "@/lib/auth/dal";
import { canViewOrganizerWorkspace, roleDashboard } from "@/lib/navigation";
import { getMyRegistrations } from "@/lib/participant/registrations";
import { getSidebarEvents } from "@/lib/organizer/hub";
import { getAvatarUrl } from "@/lib/profile/queries";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="mx-auto max-w-6xl p-6"><PageSkeleton /></div>}><SessionShell>{children}</SessionShell></Suspense>;
}
async function SessionShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Only the Organizer's own events, and only a few; the full list lives at /organizer/events.
  const [myEvents, myRegistrations, avatarUrl] = await Promise.all([
    user && canViewOrganizerWorkspace(user) ? getSidebarEvents(user.id) : null,
    user && roleDashboard(user) === "participant" ? getMyRegistrations(user.id) : null,
    // Short-lived signed URL for the private avatars bucket; re-signed on every render of the shell.
    user ? getAvatarUrl(user.profile.avatar_path) : null,
  ]);
  return <AppShell user={user ? { name: user.profile.first_name ?? "", email: user.email, isAdmin: user.isAdmin, isComplete: user.isComplete, organizerStatus: user.organizerStatus, avatarUrl } : null} myEvents={myEvents} myRegistrations={myRegistrations}>{children}</AppShell>;
}
