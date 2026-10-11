import { Suspense } from "react";
import Link from "next/link";
import { requireOrganizer } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { formatDateTime } from "@/lib/datetime";
export const metadata={title:"Reports"};
export default function Page(){return <Suspense fallback={<PageSkeleton/>}><Content/></Suspense>;}
async function Content(){
 const user=await requireOrganizer({allowInactive:true});const {data,error}=await(await createClient()).from("events").select("id,title,status,starts_at").eq("organizer_id",user.id).order("starts_at",{ascending:false}).limit(100);
 if(error)throw Error("Could not load reports.");return <div className="space-y-6"><PageHeader title="Reports" description="Simple summaries and CSV exports for your events."/>{!data.length?<p>No events yet.</p>:<ul className="divide-y">{data.map(e=><li className="flex flex-wrap items-center justify-between gap-3 py-4" key={e.id}><div><p className="font-medium">{e.title}</p><p className="text-sm text-muted-foreground">{e.status} · {e.starts_at?formatDateTime(e.starts_at):"No schedule"}</p></div><Link className="underline" href={`/organizer/events/${e.id}/reports`}>View report</Link></li>)}</ul>}</div>;
}
