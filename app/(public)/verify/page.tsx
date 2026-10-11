import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
export const metadata={title:"Verify certificate",robots:{index:false,follow:false}};
export default function Page({searchParams}:PageProps<"/verify">){return <Suspense fallback={<p className="p-8">Loading…</p>}><Content searchParams={searchParams}/></Suspense>;}
async function Content({searchParams}:Pick<PageProps<"/verify">,"searchParams">){
 const p=await searchParams;if(typeof p.code==="string"&&/^[A-Za-z0-9_-]{22}$/.test(p.code))redirect(`/verify/${p.code}`);
 return <main className="mx-auto max-w-xl space-y-6 px-5 py-12"><Link href="/" className="font-semibold">EventHub</Link><h1 className="text-3xl font-semibold">Verify a certificate</h1><p>Scan the verification QR printed on the certificate, or enter its verification code.</p><form action="/verify" className="space-y-3"><label className="grid gap-2">Verification code<input className="rounded border p-3" name="code" required pattern="[A-Za-z0-9_-]{22}" maxLength={22}/></label><button className="rounded bg-primary px-4 py-2 text-primary-foreground">Verify certificate</button></form>{p.code&&<p role="alert">Enter the 22-character verification code.</p>}</main>;
}
