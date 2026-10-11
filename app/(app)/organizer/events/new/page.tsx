import { Suspense } from "react";
import { requireOrganizer } from "@/lib/auth/dal";
import { eventLookups } from "@/lib/mvp/queries";
import { EventForm } from "@/components/mvp/event-form";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
export default function Page() { return <Suspense fallback={<PageSkeleton />}><Content /></Suspense>; }
async function Content() { await requireOrganizer(); const lookups = await eventLookups(); return <div className="space-y-6"><PageHeader title="Create event" /><EventForm {...lookups} /></div>; }