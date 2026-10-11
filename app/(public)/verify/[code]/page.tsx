import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { verificationSchema } from "@/lib/certificate-queries";
import { formatDate } from "@/lib/datetime";
export const metadata={title:"Verify certificate",robots:{index:false,follow:false}};
export default function Page({params}:PageProps<"/verify/[code]">){return <Suspense fallback={<p className="p-8">Checking certificate…</p>}><Content params={params}/></Suspense>;}
async function Content({params}:Pick<PageProps<"/verify/[code]">,"params">){
 const {code}=await params;if(!/^[A-Za-z0-9_-]{22}$/.test(code))return <Unavailable/>;
 const {data,error}=await(await createClient()).rpc("verify_certificate",{p_code:code});const v=verificationSchema.safeParse(data);if(error||!v.success)return <Unavailable/>;
 const c=v.data;return <main className="mx-auto max-w-2xl space-y-6 px-5 py-12"><Link href="/"><Image src="/images/eventhub-logo.png" width={180} height={38} alt="EventHub"/></Link><h1 className="text-3xl font-semibold">Certificate verification</h1><p className={`w-fit rounded px-4 py-2 font-semibold ${c.status==="Valid"?"bg-green-50 text-green-800":"bg-red-50 text-red-800"}`}>{c.status}</p><p>Issued by {c.issuer_name} through EventHub to the account holder named <strong>{c.recipient_name}</strong>.</p><dl className="space-y-4"><div><dt className="text-sm text-muted-foreground">Event</dt><dd className="font-medium">{c.event_title}</dd></div><div><dt className="text-sm text-muted-foreground">Event date</dt><dd>{formatDate(c.event_date+"T00:00:00+08:00")}</dd></div><div><dt className="text-sm text-muted-foreground">Certificate number</dt><dd>{c.certificate_number}</dd></div><div><dt className="text-sm text-muted-foreground">Issued</dt><dd>{formatDate(c.issued_at)}</dd></div></dl>{c.status==="Revoked"&&<p>This certificate is no longer valid.</p>}</main>;
}
function Unavailable(){return <main className="mx-auto max-w-2xl space-y-4 px-5 py-12"><h1 className="text-2xl font-semibold">Certificate unavailable</h1><p>No certificate matches this verification code.</p><Link href="/verify" className="underline">Check another certificate</Link></main>;}
