import { CalendarDaysIcon, ClockIcon } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { ParticipantEmptyState } from "@/components/participant/empty-state";
import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { registrationAction } from "@/lib/mvp/actions";
import { ActionControl } from "@/components/mvp/action-control";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { formatDateTime } from "@/lib/datetime";
export const metadata = { title: "My events" };
export default function Page({ searchParams }: PageProps<"/my-events">) { return <Suspense fallback={<PageSkeleton />}><Content searchParams={searchParams} /></Suspense>; }
async function Content({ searchParams }: Pick<PageProps<"/my-events">, "searchParams">) {
  const params = await searchParams;
  const statuses = ["pending", "approved", "rejected", "cancelled"] as const;
  const filter = typeof params.status === "string" && statuses.some(s => s === params.status) ? params.status : "";
  const user = await requireUser({ next:"/my-events" }); const client = await createClient();
  const { data, error } = await client.from("event_registrations").select("id,event_id,status,decision_reason").eq("user_id",user.id).order("registered_at",{ascending:false}).limit(100);
  if (error) throw new Error("Could not load your registrations.");
  const { data:events,error:eventError } = data.length ? await client.from("events").select("id,title,status,starts_at,cancellation_reason,cancelled_by,organizer_id").in("id",data.map(r => r.event_id)) : {data:[],error:null};
  if (eventError) throw new Error("Could not load your events.");
  const {data:attendance,error:attendanceError} = await client.from("attendance_records").select("registration_id,status,time_in_at,time_out_at").eq("user_id",user.id);
  if(attendanceError) throw new Error("Could not load your attendance.");
  const visible = filter ? data.filter(r => r.status === filter) : data;
  return <div className="space-y-6">
    <PageHeader title="My Events" description="Review your registrations, attendance, and event updates." />
    <nav aria-label="Filter registrations" className="flex flex-wrap gap-2">
      {[{ value: "", label: "All events" }, ...statuses.map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))].map(item => <Link key={item.value} href={item.value ? `/my-events?status=${item.value}` : "/my-events"} aria-current={filter === item.value ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-lg border px-3 text-sm focus-visible:outline-2 focus-visible:outline-orange-600 ${filter === item.value ? "border-slate-900 bg-slate-900 text-white" : "bg-white text-muted-foreground hover:text-foreground"}`}>{item.label}</Link>)}
    </nav>
    {visible.length ? <div className="grid gap-4 lg:grid-cols-2">{visible.map(r => {
      const e = events?.find(e => e.id === r.event_id);
      const a = attendance.find(a => a.registration_id === r.id);
      return <article key={r.id} className="min-w-0 space-y-4 rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="min-w-0 flex-1 break-words text-lg font-semibold text-slate-900"><Link className="hover:underline focus-visible:outline-2 focus-visible:outline-orange-600" href={`/events/${r.event_id}`}>{e?.title ?? "Event unavailable"}</Link></h2><StatusBadge status={r.status} /></div>
        {e?.starts_at && <p className="flex gap-2 text-sm text-muted-foreground"><CalendarDaysIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{formatDateTime(e.starts_at)}</p>}
        {a && <p className="flex gap-2 text-sm text-muted-foreground"><ClockIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>Attendance: {a.status === "revoked" ? "Revoked" : a.time_out_at ? "Timed out" : "Timed in"} &middot; {formatDateTime(a.time_out_at ?? a.time_in_at)}</span></p>}
        {r.decision_reason && <p className="break-words rounded-lg bg-slate-50 p-3 text-sm">{r.decision_reason}</p>}
        {e?.status === "cancelled" && <p className="break-words text-sm text-amber-900">Event cancelled{e.cancelled_by !== e.organizer_id ? " by an administrator" : ""}: {e.cancellation_reason}</p>}
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <Link className="inline-flex min-h-10 items-center text-sm font-medium text-orange-800 hover:underline focus-visible:outline-2 focus-visible:outline-orange-600" href={`/events/${r.event_id}`}>View event</Link>
          {r.status === "approved" && e?.status === "published" && <Link className="inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-medium hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-orange-600" href={`/scan?event=${r.event_id}`}>Scan attendance</Link>}
          {e?.status === "published" && e.starts_at && Date.parse(e.starts_at) > new Date().getTime() && ["pending", "approved"].includes(r.status) && <ActionControl label="Cancel registration" runAction={registrationAction.bind(null, r.event_id, "cancel")} confirm />}
        </div>
      </article>;
    })}</div> : <ParticipantEmptyState icon={CalendarDaysIcon} title={filter ? "No registrations with this status." : "No registered events yet."} description={filter ? "Choose another status to see your events." : "Events you register for will appear here."} action={<Link href="/dashboard" className="text-sm font-medium text-orange-800 underline">Find events on Home</Link>} />}
  </div>;
}
