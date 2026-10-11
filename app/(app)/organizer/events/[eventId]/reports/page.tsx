import { Suspense } from "react";
import Link from "next/link";
import { getEventReport } from "@/lib/report-queries";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { formatDateTime } from "@/lib/datetime";
export const metadata={title:"Event report"};
export default function Page({params}:PageProps<"/organizer/events/[eventId]/reports">){return <Suspense fallback={<PageSkeleton/>}><Content params={params}/></Suspense>;}
async function Content({params}:Pick<PageProps<"/organizer/events/[eventId]/reports">,"params">){
 const {eventId}=await params,{event:e,report:r}=await getEventReport(eventId);
 return <div className="space-y-6"><PageHeader title="Event report" description={e.title}/><Link className="underline" href={`/organizer/events/${e.id}`}>Back to event</Link><p className="text-sm text-muted-foreground">{e.status} · {e.starts_at?formatDateTime(e.starts_at):"Schedule not set"} · {e.venue??"Venue not set"}</p>
 <dl className="grid gap-6 border-y py-6 sm:grid-cols-2 lg:grid-cols-4">{[["Registered participants",r.registered],["Attended participants",r.attended],["Attendance rate",`${r.attendance_rate}%`],["Certificates issued",r.certificates_issued]].map(([label,value])=><div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-2 text-3xl font-semibold">{value}</dd></div>)}</dl>
 <p className="text-sm text-muted-foreground">Registered includes approved and pending registrations. Attendance rate uses {r.approved} approved registration(s). Revoked attendance and certificates are excluded. {r.certificates_revoked} certificate(s) revoked.</p>
 <a href={`/organizer/events/${e.id}/reports/export`} className="inline-flex rounded bg-primary px-4 py-2 text-primary-foreground">Download participant CSV</a><p className="max-w-2xl text-sm text-muted-foreground">CSV contains participant and attendance data. Keep it private. Profile details are hidden after the event’s 30-day organizer access period. Emails, photos, and private correction notes are excluded.</p>
 <div className="flex flex-wrap gap-4"><Link className="underline" href={`/organizer/events/${e.id}/registrations`}>View registrations</Link><Link className="underline" href={`/organizer/events/${e.id}/attendance`}>View attendance</Link><Link className="underline" href={`/organizer/events/${e.id}/certificates`}>View certificates</Link></div></div>;
}
