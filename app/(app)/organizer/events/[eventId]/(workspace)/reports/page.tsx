import { Suspense } from "react";
import { DownloadIcon, ShieldAlertIcon } from "lucide-react";
import { getEventReport } from "@/lib/report-queries";
import { StatStrip, WorkspaceSection } from "@/components/organizer/workspace-ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
export const metadata={title:"Event report"};
export default function Page({params}:PageProps<"/organizer/events/[eventId]/reports">){return <Suspense fallback={<PageSkeleton/>}><Content params={params}/></Suspense>;}

async function Content({params}:Pick<PageProps<"/organizer/events/[eventId]/reports">,"params">){
  const {eventId}=await params,{event:e,report:r}=await getEventReport(eventId);
  return <div className="space-y-8">
    <WorkspaceSection title="Summary" description={<>Registered includes approved and pending registrations. Attendance rate uses {r.approved} approved registration{r.approved===1?"":"s"}. Revoked attendance and certificates are excluded.</>}>
      <StatStrip items={[
        {label:"Registered participants",value:r.registered},
        {label:"Attended participants",value:r.attended},
        {label:"Attendance rate",value:`${r.attendance_rate}%`},
        {label:"Certificates issued",value:r.certificates_issued,hint:r.certificates_revoked?`${r.certificates_revoked} revoked`:undefined},
      ]}/>
    </WorkspaceSection>
    <WorkspaceSection title="Participant export" description="One row per registration with attendance and certificate details.">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border p-4">
        <p className="flex max-w-2xl gap-2 text-sm text-muted-foreground"><ShieldAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true"/>Contains participant and attendance data — keep it private. Profile details are hidden after the event’s 30-day organizer access period. Emails, photos and private correction notes are excluded.</p>
        <a href={`/organizer/events/${e.id}/reports/export`} className={buttonVariants()}><DownloadIcon aria-hidden="true"/>Download CSV</a>
      </div>
    </WorkspaceSection>
  </div>;
}
