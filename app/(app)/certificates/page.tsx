import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { formatDate } from "@/lib/datetime";
export const metadata={title:"My certificates"};
export default function Page(){return <Suspense fallback={<PageSkeleton/>}><Content/></Suspense>;}
async function Content(){
 const user=await requireUser({allowIncomplete:true}),{data,error}=await(await createClient()).from("certificates").select("id,certificate_number,event_title,event_date,revoked_at").eq("user_id",user.id).order("issued_at",{ascending:false});
 if(error)throw Error("Could not load certificates.");
 return <div className="space-y-6"><PageHeader title="My certificates" description="Digital certificates for your eligible event attendance."/>{!data.length?<p>No certificates yet. Your organizer generates certificates after the event is completed.</p>:<ul className="divide-y">{data.map(c=><li key={c.id} className="flex flex-wrap items-center justify-between gap-4 py-5"><div><Link className="font-semibold underline" href={`/certificates/${c.id}`}>{c.event_title}</Link><p className="text-sm text-muted-foreground">{formatDate(c.event_date+"T00:00:00+08:00")} · {c.certificate_number}</p></div>{c.revoked_at?<span>Revoked</span>:<a className="underline" href={`/certificates/${c.id}/pdf`}>Download PDF</a>}</li>)}</ul>}</div>;
}
