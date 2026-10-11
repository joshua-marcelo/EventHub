import { Suspense } from "react";
import Link from "next/link";
import { getOwnedEvent } from "@/lib/mvp/queries";
import { createClient } from "@/lib/supabase/server";
import { attendanceAction,correctAttendance } from "@/lib/attendance-actions";
import { ActionControl } from "@/components/mvp/action-control";
import { AttendanceSettings } from "@/components/mvp/attendance-settings";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { formatDateTime } from "@/lib/datetime";
export const metadata={title:"Attendance"};
export default function Page({params}:PageProps<"/organizer/events/[eventId]/attendance">){return <Suspense fallback={<PageSkeleton/>}><Content params={params}/></Suspense>;}
async function Content({params}:Pick<PageProps<"/organizer/events/[eventId]/attendance">,"params">){
 const {eventId}=await params;const {event:e,user}=await getOwnedEvent(eventId),c=await createClient();
 const [sessions,registrations,records]=await Promise.all([c.from("attendance_sessions").select("*").eq("event_id",e.id).order("opened_at",{ascending:false}),c.from("event_registrations").select("id,user_id,status,profiles!event_registrations_user_id_fkey(first_name,last_name)").eq("event_id",e.id).eq("status","approved"),c.from("attendance_records").select("*").eq("event_id",e.id)]);
 if(sessions.error||registrations.error||records.error)throw new Error("Could not load attendance.");
 const active=user.organizerStatus==="active",correctable=active&&["published","completed"].includes(e.status),map=new Map(records.data.map(r=>[r.registration_id,r]));
 const flags=records.data.filter(r=>r.flag&&!r.flag_resolution).length,missing=records.data.filter(r=>r.status==="present"&&!r.time_out_at).length;
 return <div className="space-y-8"><PageHeader title="Attendance" description={e.title}/><Link href={`/organizer/events/${e.id}`} className="underline">Back to event</Link>
 <AttendanceSettings id={e.id} policy={e.attendance_policy} lead={e.attendance_opens_minutes_before} onsite={e.allow_onsite_registration} locked={!!sessions.data.length} disabled={!active||!["draft","published"].includes(e.status)}/>
 {active&&e.status==="published"&&<section className="space-y-4"><p className="text-sm text-muted-foreground">Stay with this computer. Lock it (Windows+L) when stepping away. Anyone using it while unlocked can act as you.</p><div className="flex flex-wrap gap-3"><ActionControl label="Start Attendance" runAction={attendanceAction.bind(null,e.id,"time_in")}/>{e.attendance_policy==="time_in_and_out"&&<ActionControl label="Start time-out" runAction={attendanceAction.bind(null,e.id,"time_out")} confirm/>}<ActionControl label="Close attendance" runAction={attendanceAction.bind(null,e.id,"close")} confirm/><Link className="self-center underline" href={`/organizer/events/${e.id}/attendance/display`}>Open display</Link></div></section>}
 <section className="space-y-4"><h2 className="text-xl font-semibold">Approved participants</h2>{registrations.data.length===0&&<p>No approved registrations yet.</p>}{registrations.data.map(r=>{const a=map.get(r.id);return <article className="space-y-3 border-b pb-5" key={r.id}><h3 className="font-medium">{r.profiles?.first_name} {r.profiles?.last_name}</h3><p className="text-sm">{a?`${a.status} · In: ${formatDateTime(a.time_in_at)}${a.time_out_at?` · Out: ${formatDateTime(a.time_out_at)}`:""}`:"No attendance"}{a?.flag&&` · Shared-device flag: ${a.flag_resolution??"unresolved"}`}</p>{correctable&&<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{!a&&<ActionControl label="Manual time-in" reason runAction={correctAttendance.bind(null,r.id,"time_in")}/>} {a?.status==="present"&&<>{!a.time_out_at&&e.attendance_policy==="time_in_and_out"&&<ActionControl label="Manual time-out" reason runAction={correctAttendance.bind(null,r.id,"time_out")}/>}<ActionControl label="Revoke attendance" reason confirm runAction={correctAttendance.bind(null,r.id,"revoke")}/>{a.flag&&!a.flag_resolution&&<><ActionControl label="Clear flag" reason runAction={correctAttendance.bind(null,r.id,"clear_flag")}/><ActionControl label="Revoke flagged record" reason confirm runAction={correctAttendance.bind(null,r.id,"revoke_flag")}/></>}</>}</div>}</article>;})}</section>
 {active&&e.status==="published"&&<section className="space-y-3 border-t pt-6"><h2 className="font-semibold">Finish event</h2><p>{flags} unresolved flag(s). {e.attendance_policy==="time_in_and_out"?`${missing} attendee(s) missing time-out; these cannot receive certificates.`:""}</p><p className="text-sm">Completion closes attendance. Audited corrections remain available before certificates are issued.</p><ActionControl label="Mark event completed" confirm runAction={attendanceAction.bind(null,e.id,"complete")}/></section>}
 </div>;
}
