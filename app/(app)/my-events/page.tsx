import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { registrationAction } from "@/lib/mvp/actions";
import { ActionControl } from "@/components/mvp/action-control";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { formatDateTime } from "@/lib/datetime";
export default function Page() { return <Suspense fallback={<PageSkeleton />}><Content /></Suspense>; }
async function Content() {
  const user = await requireUser({ next:"/my-events" }); const client = await createClient();
  const { data, error } = await client.from("event_registrations").select("id,event_id,status,decision_reason").eq("user_id",user.id).order("registered_at",{ascending:false}).limit(100);
  if (error) throw new Error("Could not load your registrations.");
  const { data:events,error:eventError } = data.length ? await client.from("events").select("id,title,status,starts_at,cancellation_reason,cancelled_by,organizer_id").in("id",data.map(r => r.event_id)) : {data:[],error:null};
  if (eventError) throw new Error("Could not load your events.");
  return <div className="space-y-6"><PageHeader title="My events" />{data.length ? data.map(r => { const e = events?.find(e => e.id === r.event_id); return <article key={r.id} className="space-y-2 rounded border p-4"><Link className="font-semibold underline" href={`/events/${r.event_id}`}>{e?.title ?? "Event unavailable"}</Link><p>Registration: {r.status}</p>{e?.starts_at && <p>{formatDateTime(e.starts_at)}</p>}{r.decision_reason && <p>{r.decision_reason}</p>}{e?.status === "cancelled" && <p>Event cancelled{e.cancelled_by !== e.organizer_id ? " by an administrator" : ""}: {e.cancellation_reason}</p>}{e?.status === "published" && e.starts_at && Date.parse(e.starts_at) > new Date().getTime() && ["pending","approved"].includes(r.status) && <ActionControl label="Cancel registration" runAction={registrationAction.bind(null,r.event_id,"cancel")} confirm />}</article>; }) : <p>No registrations yet. <Link className="underline" href="/events">Explore events</Link></p>}</div>;
}