import { Suspense } from "react";
import Link from "next/link";
import { getOwnedEvent } from "@/lib/mvp/queries";
import { getAppOrigin } from "@/lib/app-origin";
import { registrationUrl, registrationQr } from "@/lib/qr";
import { eventAction } from "@/lib/mvp/actions";
import { ActionControl } from "@/components/mvp/action-control";
import { SharePanel } from "@/components/mvp/share-panel";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { formatDateTime } from "@/lib/datetime";
export default function Page({ params }: PageProps<"/organizer/events/[eventId]">) { return <Suspense fallback={<PageSkeleton />}><Content params={params} /></Suspense>; }
async function Content({ params }: Pick<PageProps<"/organizer/events/[eventId]">,"params">) {
  const { eventId } = await params; const { event:e,user } = await getOwnedEvent(eventId);
  const url = registrationUrl(await getAppOrigin(),e.id); const qr = e.status === "published" ? await registrationQr(url) : null;
  return <div className="space-y-6"><PageHeader title={e.title} description={`Status: ${e.status}`} /><nav className="flex flex-wrap gap-4" aria-label="Event workspace"><Link className="underline" href={`/organizer/events/${e.id}/settings`}>Edit / settings</Link><Link className="underline" href={`/organizer/events/${e.id}/registrations`}>Registrations</Link><Link className="underline" href={`/events/${e.id}`}>Participant view</Link></nav>
    <p className="whitespace-pre-wrap">{e.description || "No description yet."}</p><p>{e.venue || "Venue not set"} · {e.starts_at ? formatDateTime(e.starts_at) : "Schedule not set"}</p>
    {e.status === "draft" && user.organizerStatus === "active" && <ActionControl label="Publish event" runAction={eventAction.bind(null,e.id,"publish")} confirm />}
    {e.status === "cancelled" && <p>Cancelled{e.cancelled_by !== e.organizer_id ? " by an administrator" : ""}: {e.cancellation_reason}</p>}
    {qr ? <SharePanel url={url} qr={qr} inviteCode={e.invite_code} /> : <p className="text-sm text-muted-foreground">Registration sharing is available only while the event is published.</p>}
  </div>;
}