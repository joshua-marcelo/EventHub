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
  return <div className="space-y-6"><PageHeader title="Organizer dashboard" description="Create events and manage participant registrations." action={<StatusBadge status={user.organizerStatus} />} /><EmptyState title="Manage your campus events" description="Open an event to edit, publish, share its registration QR, or approve participants." action={<Link href="/organizer/events" className={buttonVariants({ variant: "outline" })}>My Organized Events</Link>} /></div>;
}
