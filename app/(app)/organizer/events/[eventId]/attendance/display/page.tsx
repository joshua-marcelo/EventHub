import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getOwnedEvent } from "@/lib/mvp/queries";
import { attendanceDisplay } from "@/lib/attendance-actions";
import { getAppOrigin } from "@/lib/app-origin";
import { AttendanceDisplay } from "@/components/mvp/attendance-display";
import { PageSkeleton } from "@/components/page-skeleton";
export const metadata={title:"Attendance display"};
export default function Page({params}:PageProps<"/organizer/events/[eventId]/attendance/display">){return <Suspense fallback={<PageSkeleton/>}><Content params={params}/></Suspense>;}
async function Content({params}:Pick<PageProps<"/organizer/events/[eventId]/attendance/display">,"params">){
 const {eventId}=await params;await getOwnedEvent(eventId);const state=await attendanceDisplay(eventId);if(!state)notFound();
 return <AttendanceDisplay id={eventId} initial={state} origin={await getAppOrigin()}/>;
}
