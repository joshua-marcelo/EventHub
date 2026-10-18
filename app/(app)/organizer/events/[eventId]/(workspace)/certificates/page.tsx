import { Suspense } from "react";
import { AwardIcon, DownloadIcon } from "lucide-react";
import { getOwnedEvent } from "@/lib/mvp/queries";
import { createClient } from "@/lib/supabase/server";
import { eligibilitySchema } from "@/lib/certificate-queries";
import { generateCertificates,enableCertificates,revokeCertificate } from "@/lib/certificate-actions";
import { ActionControl } from "@/components/mvp/action-control";
import { DataFrame, RowActions, WorkspaceSection, td, th } from "@/components/organizer/workspace-ui";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageSkeleton } from "@/components/page-skeleton";
import { cn } from "@/lib/utils";
import { canUseOrganizerTools } from "@/lib/navigation";
export const metadata={title:"Event certificates"};
const labels:Record<string,string>={eligible:"Eligible",issued:"Issued",absent:"Absent",not_approved:"Not approved",missing_time_out:"Missing time-out",blocked_by_flags:"Unresolved attendance flag",identity_review:"Identity review",revoked_attendance:"Revoked attendance"};
const positive=new Set(["eligible","issued"]);
export default function Page({params}:PageProps<"/organizer/events/[eventId]/certificates">){return <Suspense fallback={<PageSkeleton/>}><Content params={params}/></Suspense>;}

async function Content({params}:Pick<PageProps<"/organizer/events/[eventId]/certificates">,"params">){
  const {eventId}=await params,{event:e,user}=await getOwnedEvent(eventId),c=await createClient();
  const [eligibility,certificates]=await Promise.all([c.rpc("get_certificate_eligibility",{p_event_id:e.id}),c.from("certificates").select("id,recipient_name,certificate_number,revoked_at,user_id").eq("event_id",e.id).order("issued_at",{ascending:false})]);
  const parsed=eligibilitySchema.safeParse(eligibility.data);if(eligibility.error||certificates.error||!parsed.success)throw Error("Could not load certificate eligibility.");
  const active=canUseOrganizerTools(user);
  const flagged=certificates.data.length?await c.from("profiles").select("id,identity_flagged_at").in("id",certificates.data.map(r=>r.user_id)):null;
  const identityFlags=new Set(flagged?.data?.filter(p=>p.identity_flagged_at).map(p=>p.id));
  const counts=Object.entries(parsed.data.counts).filter(([,n])=>n>0);
  const canToggle=active&&e.status!=="cancelled"&&!certificates.data.length;
  const canGenerate=active&&e.status==="completed"&&e.certificates_enabled;
  const nextStep=!e.certificates_enabled?"Enable certificates to issue them after the event.":e.status!=="completed"?"Mark the event completed from Attendance to generate certificates. Resolve attendance and identity flags first.":null;

  return <div className="space-y-8">
    <WorkspaceSection title="Certificates" description="Fixed professional template. Names, event details and issuer are saved at issuance.">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-1"><p className="flex items-center gap-2 text-sm font-medium">Status <Badge variant="outline" className={e.certificates_enabled?"border-emerald-200 bg-emerald-50 text-emerald-800":"text-muted-foreground"}>{e.certificates_enabled?"Enabled":"Not enabled"}</Badge></p>{nextStep&&<p className="text-sm text-muted-foreground">{nextStep}</p>}</div>
        <div className="flex flex-wrap gap-2">{canToggle&&<ActionControl label={e.certificates_enabled?"Disable certificates":"Enable certificates"} runAction={enableCertificates.bind(null,e.id,!e.certificates_enabled)}/>}{canGenerate&&<ActionControl label="Generate certificates" variant="default" confirm runAction={generateCertificates.bind(null,e.id)}/>}</div>
      </div>
      {counts.length>0&&<ul className="flex flex-wrap gap-2" aria-label="Eligibility summary">{counts.map(([reason,n])=><li key={reason} className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"><span className="text-muted-foreground">{labels[reason]??reason}</span><span className="font-semibold tabular-nums">{n}</span></li>)}</ul>}
    </WorkspaceSection>

    <WorkspaceSection title="Eligibility" description="Based on approved registrations and attendance.">
      {parsed.data.participants.length?<DataFrame label="Certificate eligibility">
        <thead><tr><th className={th}>Participant</th><th className={th}>Eligibility</th></tr></thead>
        <tbody>{parsed.data.participants.map(p=><tr key={p.registration_id} className="group"><td className={cn(td,"font-medium")}>{p.name}</td><td className={td}><Badge variant="outline" className={positive.has(p.reason)?"border-emerald-200 bg-emerald-50 text-emerald-800":"text-muted-foreground"}>{labels[p.reason]??p.reason}</Badge></td></tr>)}</tbody>
      </DataFrame>:<EmptyState icon={AwardIcon} headingLevel="h3" title="No participants to evaluate" description="Approved participants appear here with their certificate eligibility."/>}
    </WorkspaceSection>

    <WorkspaceSection title="Issued certificates">
      {certificates.data.length?<DataFrame label="Issued certificates">
        <thead><tr><th className={th}>Recipient</th><th className={th}>Certificate no.</th><th className={th}>Status</th><th className={th}><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{certificates.data.map(cert=><tr key={cert.id} className="group">
          <td className={td}><span className="block font-medium">{cert.recipient_name}</span>{identityFlags.has(cert.user_id)&&<span className="block text-xs text-destructive">Holder has an identity flag. Review this certificate.</span>}</td>
          <td className={cn(td,"font-mono text-xs")}>{cert.certificate_number}</td>
          <td className={td}><Badge variant="outline" className={cert.revoked_at?"border-amber-200 bg-amber-50 text-amber-900":"border-emerald-200 bg-emerald-50 text-emerald-800"}>{cert.revoked_at?"Revoked":"Issued"}</Badge></td>
          <td className={cn(td,"w-0 min-w-52")}>{!cert.revoked_at&&<div className="flex flex-wrap items-start gap-2"><a className={buttonVariants({variant:"outline",size:"sm"})} href={`/certificates/${cert.id}/pdf`}><DownloadIcon aria-hidden="true"/>PDF</a>{active&&<RowActions label="Revoke"><ActionControl label="Revoke certificate" reason confirm runAction={revokeCertificate.bind(null,cert.id)}/></RowActions>}</div>}</td>
        </tr>)}</tbody>
      </DataFrame>:<EmptyState icon={AwardIcon} headingLevel="h3" title="No certificates issued" description={canGenerate?"Generate certificates for eligible attendees above.":"Issued certificates will appear here."}/>}
    </WorkspaceSection>
  </div>;
}
