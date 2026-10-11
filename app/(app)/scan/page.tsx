import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { idSchema } from "@/lib/validation/mvp";
import { AttendanceScanner } from "@/components/mvp/attendance-scanner";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
export const metadata={title:"Scan attendance"};
export default function Page({searchParams}:PageProps<"/scan">){return <Suspense fallback={<PageSkeleton/>}><Content searchParams={searchParams}/></Suspense>;}
async function Content({searchParams}:Pick<PageProps<"/scan">,"searchParams">){
 await requireUser({next:"/scan"});const p=await searchParams;const expected=idSchema.safeParse(p.event);
 return <div className="space-y-6"><PageHeader title="Scan attendance" description="Use your own phone and account at the event venue."/><AttendanceScanner expected={expected.success?expected.data:null}/></div>;
}
