import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { Panel, fullName } from "@/components/admin/admin-ui";
import { ReviewAction } from "@/components/admin/review-action";
import { PageSkeleton } from "@/components/page-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireAdmin } from "@/lib/auth/dal";
import { formatDateTime } from "@/lib/datetime";
import { eventAction } from "@/lib/mvp/actions";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/mvp";

export const metadata = { title: "Event review" };

export default function Page({ params }: PageProps<"/admin/events/[eventId]">) { return <Suspense fallback={<PageSkeleton />}><Content params={params} /></Suspense>; }

async function Content({ params }: Pick<PageProps<"/admin/events/[eventId]">, "params">) {
  await requireAdmin(); const { eventId } = await params; if (!idSchema.safeParse(eventId).success) notFound();
  const { data: e, error } = await (await createClient()).from("events").select("id,title,status,description,cancellation_reason,starts_at,ends_at,venue,event_categories(name),organizer:profiles!events_organizer_id_fkey(first_name,last_name)").eq("id", eventId).maybeSingle();
  if (error) throw new Error("Could not load event."); if (!e) notFound();
  const facts: [string, string][] = [
    ["Organizer", fullName(e.organizer)], ["Category", e.event_categories?.name ?? "Not set"], ["Venue", e.venue ?? "Not set"],
    ["Starts", e.starts_at ? formatDateTime(e.starts_at) : "Not set"], ["Ends", e.ends_at ? formatDateTime(e.ends_at) : "Not set"],
  ];

  return <div className="max-w-3xl space-y-6">
    <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" aria-hidden="true" />Overview</Link>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold tracking-tight">{e.title}</h1><StatusBadge status={e.status} /></div><p className="text-sm text-muted-foreground">Event review</p></div>
      {e.status === "published" && <ReviewAction tone="destructive" reason="required" label="Cancel event" title={`Cancel ${e.title}?`} description="Cancel this published event as an administrator. Give the reason for cancelling." confirmLabel="Cancel event" runAction={eventAction.bind(null, e.id, "cancel")} />}
    </div>
    <Panel title="Details"><dl className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2">{facts.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k}</dt><dd className="mt-1 break-words text-sm">{v}</dd></div>)}</dl></Panel>
    <Panel title="Description">{e.description ? <p className="whitespace-pre-wrap p-4 text-sm leading-relaxed">{e.description}</p> : <p className="p-4 text-sm text-muted-foreground">No description.</p>}</Panel>
    {e.cancellation_reason && <Panel title="Cancellation reason"><p className="whitespace-pre-wrap p-4 text-sm">{e.cancellation_reason}</p></Panel>}
  </div>;
}
