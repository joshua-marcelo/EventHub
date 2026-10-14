import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { EventDiscovery } from "@/components/participant/event-discovery";
export const metadata = { title: "Explore events" };
export default function Page({ searchParams }: PageProps<"/events">) { return <Suspense fallback={<PageSkeleton />}><Content searchParams={searchParams} /></Suspense>; }
async function Content({ searchParams }: Pick<PageProps<"/events">, "searchParams">) {
  await requireUser({ next: "/events" });
  return <div className="space-y-6"><PageHeader title="Explore events" description="Find your next university event." /><EventDiscovery searchParams={searchParams} basePath="/events" /></div>;
}
