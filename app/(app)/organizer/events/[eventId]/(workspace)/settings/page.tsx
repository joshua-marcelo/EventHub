import { Suspense } from "react";
import { getOwnedEvent,eventLookups } from "@/lib/mvp/queries";
import { eventAction } from "@/lib/mvp/actions";
import { ActionControl } from "@/components/mvp/action-control";
import { EventForm } from "@/components/mvp/event-form";
import { WorkspaceSection } from "@/components/organizer/workspace-ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { FormAlert } from "@/components/forms/form-alert";
import { canUseOrganizerTools } from "@/lib/navigation";
export const metadata = { title: "Edit event" };
export default function Page({ params, searchParams }: PageProps<"/organizer/events/[eventId]/settings">) { return <Suspense fallback={<PageSkeleton />}><Content params={params} searchParams={searchParams} /></Suspense>; }
async function Content({ params, searchParams }: Pick<PageProps<"/organizer/events/[eventId]/settings">,"params"|"searchParams">) {
  const { eventId } = await params; const { banner } = await searchParams;
  const { event,user } = await getOwnedEvent(eventId); const lookups = await eventLookups();
  const editable = canUseOrganizerTools(user) && ["draft","published"].includes(event.status);
  if (!editable) return <p className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">{event.status === "cancelled" || event.status === "completed" ? `This event is ${event.status} and can no longer be edited.` : "Your Organizer access is not active, so this event is read-only."}</p>;
  return <div className="space-y-8">
    <h2 className="text-lg font-semibold">Edit event</h2>
    {banner === "failed" && <FormAlert>The event was saved, but the banner could not be uploaded. Choose the image again and save.</FormAlert>}
    <EventForm event={event} {...lookups} />
    <WorkspaceSection title={event.status === "draft" ? "Delete draft" : "Cancel event"} className="border-t pt-8"
      description={event.status === "draft" ? "Permanently removes this draft." : "Registered participants will see the event as cancelled. This cannot be undone."}>
      {event.status === "draft" ? <ActionControl label="Delete draft" runAction={eventAction.bind(null,event.id,"delete")} confirmation={{ title: "Delete draft?", subject: event.title, description: "This permanently deletes the draft. This cannot be undone.", tone: "destructive" }} /> : <div className="max-w-md"><ActionControl label="Cancel event" runAction={eventAction.bind(null,event.id,"cancel")} reason confirmation={{ title: "Cancel event?", subject: event.title, description: "Registered participants will see this event as cancelled. This cannot be undone.", tone: "destructive" }} /></div>}
    </WorkspaceSection>
  </div>;
}
