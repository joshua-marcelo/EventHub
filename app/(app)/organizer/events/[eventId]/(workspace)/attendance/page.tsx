import { Suspense } from "react";
import Link from "next/link";
import { MonitorIcon, ScanLineIcon } from "lucide-react";
import { getOwnedEvent } from "@/lib/mvp/queries";
import { createClient } from "@/lib/supabase/server";
import { lifecycleConfirmations } from "@/lib/event-lifecycle";
import { attendanceAction,correctAttendance } from "@/lib/attendance-actions";
import { formatDateTime } from "@/lib/datetime";
import { ActionControl } from "@/components/mvp/action-control";
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
  const timeOutStarted=sessions.data.some(s=>s.kind==="time_out");
  const now=new Date().getTime(),open=sessions.data.find(s=>s.status==="open"&&Date.parse(s.closes_at)>now);
  // Attendance is opened and closed by the Organizer, not by the clock (open_attendance_session enforces the same rule).
  const notice=e.status==="draft"?"Attendance is unavailable for draft events. Publish the event first."
    :e.status==="cancelled"?"This event was cancelled. Attendance is unavailable."
    :e.status==="completed"?"This event is completed. Attendance records are read-only except for audited corrections."
    :!active?"Your Organizer access is not active, so attendance is read-only.":null;

  return <div className="space-y-8">
    <StatStrip items={[
      {label:"Approved participants",value:registrations.data.length},
      {label:"Present",value:present,hint:registrations.data.length?`${Math.round(present*100/registrations.data.length)}% of approved`:undefined},
      ...(timeOut?[{label:"Missing time-out",value:missing}]:[]),
      ...(flags?[{label:"Unresolved flags",value:flags,hint:"Review below"}]:[]),
    ]}/>

    {notice&&<p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{notice}</p>}

    {live&&<WorkspaceSection title="Attendance session" description={open?<>Attendance is open. New scans are accepted until you close it (at the latest {formatDateTime(open.closes_at)}).</>:"Attendance is closed. Start it when participants arrive; it stays open until you close it."}
      action={open&&<Link href={`/organizer/events/${e.id}/attendance/display`} className={buttonVariants({variant:"outline"})}><MonitorIcon aria-hidden="true"/>Open attendance display</Link>}>
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex flex-wrap gap-3">{!open&&!timeOutStarted&&<ActionControl label="Start Attendance" variant="default" runAction={attendanceAction.bind(null,e.id,"time_in")} confirmation={{ ...lifecycleConfirmations.start, subject: e.title }}/>}{open&&timeOut&&open.kind==="time_in"&&<ActionControl label="Start time-out" runAction={attendanceAction.bind(null,e.id,"time_out")} confirmation={{ title: "Start time-out?", subject: e.title, description: "This ends time-in scanning and starts time-out scanning. Late arrivals will need a manual time-in.", tone: "warning" }}/>}{open&&<ActionControl label="Close Attendance" runAction={attendanceAction.bind(null,e.id,"close")} confirmation={{ title: "Close Attendance?", subject: e.title, description: "Participants will no longer be able to scan for the current attendance session.", tone: "warning" }}/>}</div>
        <p className="text-xs text-muted-foreground">Stay with this computer while attendance runs. Lock it (Windows+L) when stepping away — anyone using it while unlocked can act as you.</p>
      </div>
    </WorkspaceSection>}

    <WorkspaceSection title="Attendance records" description={correctable?"Corrections are audited and require a reason.":undefined}>
      {registrations.data.length?<DataFrame label="Attendance of approved participants">
        <thead><tr><th className={th}>Participant</th><th className={th}>Attendance</th><th className={th}>Time in</th>{timeOut&&<th className={th}>Time out</th>}<th className={th}>Flag</th>{correctable&&<th className={th}><span className="sr-only">Corrections</span></th>}</tr></thead>
        <tbody>{registrations.data.map(r=>{const a=map.get(r.id);const name=`${r.profiles?.first_name??""} ${r.profiles?.last_name??""}`.trim()||"Participant";
          const actions=correctable&&<>{!a&&<ActionControl label="Manual time-in" reason runAction={correctAttendance.bind(null,r.id,"time_in")}/>}{a?.status==="present"&&<>{!a.time_out_at&&timeOut&&<ActionControl label="Manual time-out" reason runAction={correctAttendance.bind(null,r.id,"time_out")}/>}<ActionControl label="Revoke attendance" reason confirmation={{ title: "Revoke attendance?", subject: name, description: "This participant's attendance will be marked as revoked. Your reason will be recorded in the audit log.", tone: "destructive" }} runAction={correctAttendance.bind(null,r.id,"revoke")}/>{a.flag&&!a.flag_resolution&&<><ActionControl label="Clear flag" reason runAction={correctAttendance.bind(null,r.id,"clear_flag")}/><ActionControl label="Revoke flagged record" reason confirmation={{ title: "Revoke flagged record?", subject: name, description: "This flagged attendance record will be revoked. Your reason will be recorded in the audit log.", tone: "destructive" }} runAction={correctAttendance.bind(null,r.id,"revoke_flag")}/></>}</>}</>;
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

    {live&&<WorkspaceSection title="Finish event" className="border-t pt-8" description="Completion closes attendance and makes the records read-only, apart from audited corrections. Available once the event has started.">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border p-4">
        <p className="text-sm">{present} present of {registrations.data.length} approved.{flags?` ${flags} unresolved flag${flags===1?"":"s"}.`:""}</p>
        <ActionControl label="Mark event completed" confirmation={{ title: "Mark event completed?", subject: e.title, description: "This closes attendance and makes records read-only, apart from audited corrections.", tone: "warning" }} runAction={attendanceAction.bind(null,e.id,"complete")}/>
      </div>
    </WorkspaceSection>}
  </div>;
}
