import Link from "next/link";
import { Suspense } from "react";
import { requireOrganizer } from "@/lib/auth/dal";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
export const metadata = { title: "Organizer dashboard" };
export default function Page() { return <Suspense fallback={<PageSkeleton />}><Dashboard /></Suspense>; }
async function Dashboard() {
  const user = await requireOrganizer({ allowInactive: true });
  return <div className="space-y-6"><PageHeader title="Organizer dashboard" description="Bring your campus together. Manage events, attendance and certificates." action={<StatusBadge status={user.organizerStatus} />} /><EmptyState title="Your events will appear here" description="Event management will be available soon. Your participant dashboard remains available from the dashboard switcher." action={<Link href="/organizer/events" className={buttonVariants({ variant: "outline" })}>My Organized Events</Link>} /></div>;
}
