import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { EventDiscovery } from "@/components/participant/event-discovery";
export const metadata = { title: "Events" };
export default function Page({ searchParams }: PageProps<"/events">) { return <Suspense fallback={<PageSkeleton />}><Content searchParams={searchParams} /></Suspense>; }
async function Content({ searchParams }: Pick<PageProps<"/events">, "searchParams">) {
  // Browsing does not need a complete student profile; registering does (checked on the event page).
  await requireUser({ next: "/events", allowIncomplete: true });
  return <div className="space-y-6"><PageHeader title="Events" description="Published university events. Open one to register." /><EventDiscovery searchParams={searchParams} basePath="/events" /></div>;
}
