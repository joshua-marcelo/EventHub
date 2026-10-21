import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { getEventLifecycle } from "@/lib/event-lifecycle-queries";
import { idSchema } from "@/lib/validation/mvp";
import { AttendanceScanner } from "@/components/mvp/attendance-scanner";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
export const metadata={title:"Scan attendance"};
export default function Page({searchParams}:PageProps<"/scan">){return <Suspense fallback={<PageSkeleton/>}><Content searchParams={searchParams}/></Suspense>;}
async function Content({searchParams}:Pick<PageProps<"/scan">,"searchParams">){
 await requireUser({next:"/scan"});const p=await searchParams;const expected=idSchema.safeParse(p.event);
 if (p.event !== undefined) {
  const state = expected.success ? await getEventLifecycle(expected.data) : null;
  if (!state?.can_scan_attendance) return <div className="space-y-4"><PageHeader title="Scan attendance" /><p role="status">{state && !state.attendance_kind ? "Attendance hasn't started yet." : "Attendance scanning is unavailable for your registration. Return to the event for its current status."}</p></div>;
 }
 // General entry has no event yet. submit_attendance_scan checks the signed QR, active session,
 // approved registration and participant profile under the event lock before any attendance write.
 return <div className="space-y-6"><PageHeader title="Scan attendance" description="Use your own phone and account at the event venue."/><div className="max-w-md"><AttendanceScanner expected={expected.success?expected.data:null} autoStart/></div></div>;
}
