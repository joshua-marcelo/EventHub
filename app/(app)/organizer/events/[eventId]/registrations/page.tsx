import { Suspense } from "react";
import Link from "next/link";
import { getOwnedEvent } from "@/lib/mvp/queries";
import { createClient } from "@/lib/supabase/server";
import { decideRegistration } from "@/lib/mvp/actions";
import { ActionControl } from "@/components/mvp/action-control";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
export const metadata = { title: "Registrations" };
export default function Page(props: PageProps<"/organizer/events/[eventId]/registrations">) { return <Suspense fallback={<PageSkeleton />}><Content {...props} /></Suspense>; }
async function Content({ params,searchParams }: PageProps<"/organizer/events/[eventId]/registrations">) {
  const { eventId } = await params; const { event,user } = await getOwnedEvent(eventId);
  const query = await searchParams; const page = Math.min(10000,Math.max(1,Number(query.page) || 1)); const from = (Math.floor(page)-1)*50;
  const client = await createClient();
  const { data, error, count } = await client.from("event_registrations").select("id,user_id,status,registered_at,decision_reason",{count:"exact"}).eq("event_id",event.id).order("registered_at").range(from,from+49);
  if (error) throw new Error("Could not load registrations.");
  const profileIds = data.map(r => r.user_id);
  const { data:profiles, error:profileError } = profileIds.length ? await client.from("profiles").select("id,first_name,last_name,student_id").in("id",profileIds) : {data:[],error:null};
  if (profileError) throw new Error("Could not load registrants.");
  const editable = user.organizerStatus === "active" && event.status === "published";
  return <div className="space-y-6"><PageHeader title={`Registrations — ${event.title}`} description={`${count ?? 0} registrations. Capacity: ${event.capacity ?? "unlimited"}.`} /><Link className="underline" href={`/organizer/events/${event.id}`}>Back to event</Link>
    {data.length ? data.map(r => { const p = profiles?.find(p => p.id === r.user_id); return <article key={r.id} className="space-y-3 rounded border p-4"><h2 className="font-medium">{p ? `${p.first_name} ${p.last_name} · ${p.student_id}` : "Registrant details no longer available"}</h2><p className="capitalize">{r.status}</p>{r.decision_reason && <p className="text-sm">{r.decision_reason}</p>}{editable && r.status === "pending" && <div className="flex flex-wrap gap-4"><ActionControl label="Approve registration" runAction={decideRegistration.bind(null,r.id,"approved")} /><ActionControl label="Reject registration" runAction={decideRegistration.bind(null,r.id,"rejected")} reason /></div>}</article>; }) : <p>No registrations on this page.</p>}
    <nav aria-label="Registration pages" className="flex gap-4">{page > 1 && <Link className="underline" href={`?page=${page-1}`}>Previous</Link>}{from+data.length < (count ?? 0) && <Link className="underline" href={`?page=${page+1}`}>Next</Link>}</nav>
  </div>;
}