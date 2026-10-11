import { Suspense } from "react";
import Link from "next/link";
import { getOwnedEvent,eventLookups } from "@/lib/mvp/queries";
import { eventAction } from "@/lib/mvp/actions";
import { ActionControl } from "@/components/mvp/action-control";
import { EventForm } from "@/components/mvp/event-form";
import { PosterUpload } from "@/components/mvp/poster-upload";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
export default function Page({ params }: PageProps<"/organizer/events/[eventId]/settings">) { return <Suspense fallback={<PageSkeleton />}><Content params={params} /></Suspense>; }
async function Content({ params }: Pick<PageProps<"/organizer/events/[eventId]/settings">,"params">) {
  const { eventId } = await params; const { event,user } = await getOwnedEvent(eventId); const lookups = await eventLookups();
  const editable = user.organizerStatus === "active" && ["draft","published"].includes(event.status);
  return <div className="space-y-6"><PageHeader title="Event settings" /><Link className="underline" href={`/organizer/events/${event.id}`}>Back to event</Link>{editable ? <><PosterUpload eventId={event.id} currentPath={event.banner_path} /><EventForm event={event} {...lookups} />{event.status === "draft" ? <ActionControl label="Delete draft" runAction={eventAction.bind(null,event.id,"delete")} confirm /> : <ActionControl label="Cancel event" runAction={eventAction.bind(null,event.id,"cancel")} reason confirm />}</> : <p>This event is read-only.</p>}</div>;
}
