import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeftIcon, CalendarDaysIcon, MapPinIcon } from "lucide-react";
import { getOwnedEvent } from "@/lib/mvp/queries";
import { eventAction } from "@/lib/mvp/actions";
import { formatEventSchedule } from "@/lib/datetime";
import { ActionControl } from "@/components/mvp/action-control";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrentEventRegistrar } from "@/components/shell/current-event";
import { Skeleton } from "@/components/ui/skeleton";
import { canUseOrganizerTools } from "@/lib/navigation";

/** Shared Organizer event workspace header. Section navigation lives in the sidebar under My Events → this event. */
export default function Layout({ children, params }: LayoutProps<"/organizer/events/[eventId]">) {
  return <div className="mx-auto w-full max-w-6xl space-y-6">
    <Suspense fallback={<HeaderSkeleton />}><Header params={params} /></Suspense>
    {children}
  </div>;
}

async function Header({ params }: Pick<LayoutProps<"/organizer/events/[eventId]">, "params">) {
  const { eventId } = await params; const { event: e, user } = await getOwnedEvent(eventId);
  const canPublish = e.status === "draft" && canUseOrganizerTools(user);
  return <div className="space-y-4 border-b pb-6">
    <Link href="/organizer/events" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><ArrowLeftIcon className="size-4" aria-hidden="true" />My Events</Link>
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h1 className="break-words text-2xl font-semibold tracking-tight">{e.title}</h1><StatusBadge status={e.status} /></div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><CalendarDaysIcon className="size-4 shrink-0" aria-hidden="true" />{e.starts_at ? formatEventSchedule(e.starts_at, e.ends_at) : "Schedule not set"}</span>
          <span className="inline-flex min-w-0 items-center gap-1.5"><MapPinIcon className="size-4 shrink-0" aria-hidden="true" /><span className="truncate">{e.venue ?? "Venue not set"}</span></span>
        </p>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        {canPublish && <ActionControl label="Publish Event" runAction={eventAction.bind(null, e.id, "publish")} variant="default" confirmation={{ title: "Publish Event?", subject: e.title, description: "Publishing makes this event visible to participants." }} />}
      </div>
    </header>
    <CurrentEventRegistrar id={e.id} title={e.title} />
  </div>;
}

function HeaderSkeleton() {
  return <div aria-busy="true" className="space-y-4"><Skeleton className="h-4 w-16" /><Skeleton className="h-8 w-72" /><Skeleton className="h-4 w-56" /></div>;
}
