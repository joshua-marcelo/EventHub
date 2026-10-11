import { Suspense } from "react";
import Link from "next/link";
import { getOwnedEvent } from "@/lib/mvp/queries";
import { createClient } from "@/lib/supabase/server";
import { eligibilitySchema } from "@/lib/certificate-queries";
import { generateCertificates,enableCertificates,revokeCertificate } from "@/lib/certificate-actions";
import { ActionControl } from "@/components/mvp/action-control";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
export const metadata={title:"Event certificates"};
const labels:Record<string,string>={eligible:"Eligible",issued:"Issued",absent:"Absent",not_approved:"Not approved",missing_time_out:"Missing time-out",blocked_by_flags:"Unresolved attendance flag",identity_review:"Identity review",revoked_attendance:"Revoked attendance"};
export default function Page({params}:PageProps<"/organizer/events/[eventId]/certificates">){return <Suspense fallback={<PageSkeleton/>}><Content params={params}/></Suspense>;}
async function Content({params}:Pick<PageProps<"/organizer/events/[eventId]/certificates">,"params">){
 const {eventId}=await params,{event:e,user}=await getOwnedEvent(eventId),c=await createClient();
 const [eligibility,certificates]=await Promise.all([c.rpc("get_certificate_eligibility",{p_event_id:e.id}),c.from("certificates").select("id,recipient_name,certificate_number,revoked_at,user_id").eq("event_id",e.id).order("issued_at",{ascending:false})]);
 const parsed=eligibilitySchema.safeParse(eligibility.data);if(eligibility.error||certificates.error||!parsed.success)throw Error("Could not load certificate eligibility.");
 const active=user.organizerStatus==="active";
 const flagged=certificates.data.length?await c.from("profiles").select("id,identity_flagged_at").in("id",certificates.data.map(r=>r.user_id)):null;
 const identityFlags=new Set(flagged?.data?.filter(p=>p.identity_flagged_at).map(p=>p.id));
 return <div className="space-y-6"><PageHeader title="Certificates" description={e.title}/><Link className="underline" href={`/organizer/events/${e.id}`}>Back to event</Link><p>Fixed professional template. Names, event details, and issuer are saved at issuance.</p><p>Certificates: {e.certificates_enabled?"enabled":"disabled"}. Event: {e.status}.</p>
 {active&&e.status!=="cancelled"&&!certificates.data.length&&<ActionControl label={e.certificates_enabled?"Disable certificates":"Enable certificates"} runAction={enableCertificates.bind(null,e.id,!e.certificates_enabled)}/>}
 <dl className="flex flex-wrap gap-6">{Object.entries(parsed.data.counts).map(([reason,n])=><div key={reason}><dt className="text-sm text-muted-foreground">{labels[reason]??reason}</dt><dd className="text-2xl font-semibold">{n}</dd></div>)}</dl>
 {active&&e.status==="completed"&&e.certificates_enabled?<ActionControl label="Generate certificates" confirm runAction={generateCertificates.bind(null,e.id)}/>:<p className="text-sm">Enable certificates and mark the event completed from Attendance to generate. Resolve attendance and identity flags first.</p>}
 <section className="space-y-3"><h2 className="text-lg font-semibold">Eligibility</h2><ul className="divide-y">{parsed.data.participants.map(p=><li key={p.registration_id} className="flex justify-between gap-4 py-3"><span>{p.name}</span><span className="text-sm">{labels[p.reason]??p.reason}</span></li>)}</ul></section>
 <section className="space-y-4"><h2 className="text-lg font-semibold">Issued certificates</h2>{!certificates.data.length&&<p>None issued yet.</p>}{certificates.data.map(cert=><article key={cert.id} className="space-y-3 border-b pb-4"><p className="font-medium">{cert.recipient_name} · {cert.certificate_number}</p>{identityFlags.has(cert.user_id)&&<p className="text-sm text-destructive">Holder has an identity flag. Review this certificate.</p>}{cert.revoked_at?<p>Revoked</p>:<><a className="underline" href={`/certificates/${cert.id}/pdf`}>Download PDF</a>{active&&<ActionControl label="Revoke certificate" reason confirm runAction={revokeCertificate.bind(null,cert.id)}/>}</>}</article>)}</section></div>;
}
