import { Suspense } from "react";
import Link from "next/link";
import { getCertificate } from "@/lib/certificate-queries";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { formatDate } from "@/lib/datetime";
export default function Page({params}:PageProps<"/certificates/[certificateId]">){return <Suspense fallback={<PageSkeleton/>}><Content params={params}/></Suspense>;}
async function Content({params}:Pick<PageProps<"/certificates/[certificateId]">,"params">){
 const {certificateId}=await params,c=await getCertificate(certificateId);
 return <div className="max-w-3xl space-y-6"><PageHeader title={c.event_title} description="Certificate of participation"/><Link href="/certificates" className="underline">My certificates</Link><dl className="grid gap-3"><div><dt className="text-sm text-muted-foreground">Recipient</dt><dd className="text-xl font-semibold">{c.recipient_name}</dd></div><div><dt className="text-sm text-muted-foreground">Event date</dt><dd>{formatDate(c.event_date+"T00:00:00+08:00")}</dd></div><div><dt className="text-sm text-muted-foreground">Certificate number</dt><dd>{c.certificate_number}</dd></div></dl>{c.revoked_at?<p role="status">This certificate has been revoked. Download unavailable.</p>:<><a className="inline-flex rounded bg-primary px-4 py-2 text-primary-foreground" href={`/certificates/${c.id}/pdf`}>Download PDF</a><iframe className="h-[500px] w-full rounded border" title="Certificate preview" src={`/certificates/${c.id}/pdf?preview=1#view=FitH`}/></>}<Link className="block underline" href={`/verify/${c.verification_code}`}>Verify certificate</Link></div>;
}
