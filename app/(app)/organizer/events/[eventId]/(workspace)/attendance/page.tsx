import { Suspense } from "react";
import Link from "next/link";
import { MonitorIcon, ScanLineIcon } from "lucide-react";
import { getOwnedEvent } from "@/lib/mvp/queries";
import { createClient } from "@/lib/supabase/server";
import { attendanceAction,correctAttendance } from "@/lib/attendance-actions";
import { formatDateTime } from "@/lib/datetime";
import { ActionControl } from "@/components/mvp/action-control";
import { AttendanceSettings } from "@/components/mvp/attendance-settings";
import { DataFrame, RowActions, StatStrip, WorkspaceSection, td, th } from "@/components/organizer/workspace-ui";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { PageSkeleton } from "@/components/page-skeleton";
import { cn } from "@/lib/utils";
import { canUseOrganizerTools } from "@/lib/navigation";
export const metadata={title:"Attendance"};
export default function Page({params}:PageProps<"/organizer/events/[eventId]/attendance">){return <Suspense fallback={<PageSkeleton/>}><Content params={params}/></Suspense>;}

async function Content({params}:Pick<PageProps<"/organizer/events/[eventId]/attendance">,"params">){
  const {eventId}=await params;const {event:e,user}=await getOwnedEvent(eventId),c=await createClient();
  const [sessions,registrations,records]=await Promise.all([c.from("attendance_sessions").select("*").eq("event_id",e.id).order("opened_at",{ascending:false}),c.from("event_registrations").select("id,user_id,status,profiles!event_registrations_user_id_fkey(first_name,last_name)").eq("event_id",e.id).eq("status","approved"),c.from("attendance_records").select("*").eq("event_id",e.id)]);
  if(sessions.error||registrations.error||records.error)throw new Error("Could not load attendance.");
  const active=canUseOrganizerTools(user),live=active&&e.status==="published",correctable=active&&["published","completed"].includes(e.status);
  const map=new Map(records.data.map(r=>[r.registration_id,r]));
  const timeOut=e.attendance_policy==="time_in_and_out";
  const present=records.data.filter(r=>r.status==="present").length;
  const flags=records.data.filter(r=>r.flag&&!r.flag_resolution).length,missing=records.data.filter(r=>r.status==="present"&&!r.time_out_at).length;
  // A stored "open" session past its closes_at no longer accepts check-ins.
  const now=new Date().getTime(),open=sessions.data.find(s=>s.status==="open"&&Date.parse(s.closes_at)>now);

  return <div className="space-y-8">
    <StatStrip items={[
      {label:"Approved participants",value:registrations.data.length},
      {label:"Checked in",value:present,hint:registrations.data.length?`${Math.round(present*100/registrations.data.length)}% of approved`:undefined},
      {label:"Missing time-out",value:timeOut?missing:"—",hint:timeOut?"Not eligible for certificates":"Time-out not required"},
      {label:"Unresolved flags",value:flags,hint:flags?"Review below":undefined},
    ]}/>

    {live&&<WorkspaceSection title="Check-in" description={open?<>A {open.kind==="time_out"?"time-out":"time-in"} session is open until {formatDateTime(open.closes_at)}.</>:sessions.data.length?"No session is open. Start one when participants arrive.":"Attendance has not started yet."}
      action={<Link href={`/organizer/events/${e.id}/attendance/display`} className={buttonVariants({variant:"outline"})}><MonitorIcon aria-hidden="true"/>Open check-in display</Link>}>
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex flex-wrap gap-3"><ActionControl label="Start Attendance" variant="default" runAction={attendanceAction.bind(null,e.id,"time_in")}/>{timeOut&&<ActionControl label="Start time-out" runAction={attendanceAction.bind(null,e.id,"time_out")} confirm/>}<ActionControl label="Close attendance" runAction={attendanceAction.bind(null,e.id,"close")} confirm/></div>
        <p className="text-xs text-muted-foreground">Stay with this computer while check-in runs. Lock it (Windows+L) when stepping away — anyone using it while unlocked can act as you.</p>
      </div>
    </WorkspaceSection>}

    <WorkspaceSection title="Attendance records" description={correctable?"Corrections are audited and require a reason.":undefined}>
      {registrations.data.length?<DataFrame label="Attendance of approved participants">
        <thead><tr><th className={th}>Participant</th><th className={th}>Attendance</th><th className={th}>Time in</th>{timeOut&&<th className={th}>Time out</th>}<th className={th}>Flag</th>{correctable&&<th className={th}><span className="sr-only">Corrections</span></th>}</tr></thead>
        <tbody>{registrations.data.map(r=>{const a=map.get(r.id);const name=`${r.profiles?.first_name??""} ${r.profiles?.last_name??""}`.trim()||"Participant";
          const actions=correctable&&<>{!a&&<ActionControl label="Manual time-in" reason runAction={correctAttendance.bind(null,r.id,"time_in")}/>}{a?.status==="present"&&<>{!a.time_out_at&&timeOut&&<ActionControl label="Manual time-out" reason runAction={correctAttendance.bind(null,r.id,"time_out")}/>}<ActionControl label="Revoke attendance" reason confirm runAction={correctAttendance.bind(null,r.id,"revoke")}/>{a.flag&&!a.flag_resolution&&<><ActionControl label="Clear flag" reason runAction={correctAttendance.bind(null,r.id,"clear_flag")}/><ActionControl label="Revoke flagged record" reason confirm runAction={correctAttendance.bind(null,r.id,"revoke_flag")}/></>}</>}</>;
          const hasActions=correctable&&(!a||a.status==="present");
          return <tr key={r.id} className="group">
            <td className={cn(td,"font-medium")}>{name}</td>
            <td className={td}>{a?<StatusBadge status={a.status as "present"|"revoked"}/>:<span className="text-muted-foreground">Not checked in</span>}</td>
            <td className={cn(td,"whitespace-nowrap text-muted-foreground")}>{a?formatDateTime(a.time_in_at):"—"}</td>
            {timeOut&&<td className={cn(td,"whitespace-nowrap text-muted-foreground")}>{a?.time_out_at?formatDateTime(a.time_out_at):"—"}</td>}
            <td className={cn(td,"text-muted-foreground")}>{a?.flag?<span className={a.flag_resolution?undefined:"font-medium text-amber-800"}>Shared device · {a.flag_resolution??"unresolved"}</span>:"—"}</td>
            {correctable&&<td className={cn(td,"w-0 min-w-44")}>{hasActions&&<RowActions label="Correct">{actions}</RowActions>}</td>}
          </tr>;})}</tbody>
      </DataFrame>:<EmptyState icon={ScanLineIcon} headingLevel="h3" title="No approved participants yet" description="Approved registrations appear here with their check-in status."/>}
    </WorkspaceSection>

    <WorkspaceSection title="Attendance settings" description="Applies to QR check-in for this event.">
      <AttendanceSettings id={e.id} policy={e.attendance_policy} lead={e.attendance_opens_minutes_before} onsite={e.allow_onsite_registration} locked={!!sessions.data.length} disabled={!active||!["draft","published"].includes(e.status)}/>
    </WorkspaceSection>

    {live&&<WorkspaceSection title="Finish event" className="border-t pt-8" description="Completion closes attendance. Audited corrections remain available until certificates are issued.">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border p-4">
        <p className="text-sm">{flags} unresolved flag{flags===1?"":"s"}.{timeOut&&` ${missing} attendee${missing===1?"":"s"} missing time-out cannot receive certificates.`}</p>
        <ActionControl label="Mark event completed" confirm runAction={attendanceAction.bind(null,e.id,"complete")}/>
      </div>
    </WorkspaceSection>}
  </div>;
}
