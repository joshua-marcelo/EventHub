import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { requireOrganizer } from "@/lib/auth/dal";
import { eventLookups } from "@/lib/mvp/queries";
import { EventForm } from "@/components/mvp/event-form";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
export const metadata = { title: "Create event" };
export default function Page() { return <Suspense fallback={<PageSkeleton />}><Content /></Suspense>; }
async function Content() {
  await requireOrganizer(); const lookups = await eventLookups();
  return <div className="mx-auto w-full max-w-5xl space-y-6">
    <Link href="/organizer/events" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><ArrowLeftIcon className="size-4" aria-hidden="true" />Events</Link>
    <PageHeader title="Create event" description="Start with a draft. You can publish once the required details are complete." />
    <EventForm {...lookups} />
  </div>;
}
