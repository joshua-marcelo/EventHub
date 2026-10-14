import { Suspense } from "react";
import Link from "next/link";
import { AwardIcon, DownloadIcon, ArrowUpRightIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ParticipantEmptyState } from "@/components/participant/empty-state";
import { PageSkeleton } from "@/components/page-skeleton";
import { formatDate } from "@/lib/datetime";
export const metadata = { title: "My certificates" };
export default function Page() { return <Suspense fallback={<PageSkeleton />}><Content /></Suspense>; }
async function Content() {
  const user = await requireUser({ allowIncomplete: true });
  const { data, error } = await (await createClient()).from("certificates").select("id,certificate_number,event_title,event_date,revoked_at").eq("user_id", user.id).order("issued_at", { ascending: false });
  if (error) throw Error("Could not load certificates.");
  return <div className="space-y-6"><PageHeader title="Certificates" description="View and download certificates issued for your event participation." />
    {!data.length ? <ParticipantEmptyState icon={AwardIcon} title="No certificates yet." description="Your certificates will appear here once issued." /> : <ul className="grid gap-4 lg:grid-cols-2">{data.map(c => <li key={c.id} className="min-w-0 rounded-xl border bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3"><AwardIcon className="size-6 text-orange-800" aria-hidden="true" />{c.revoked_at && <StatusBadge status="revoked" />}</div>
      <h2 className="break-words text-lg font-semibold text-slate-900"><Link className="hover:underline focus-visible:outline-2 focus-visible:outline-orange-600" href={`/certificates/${c.id}`}>{c.event_title}</Link></h2>
      <p className="mt-2 text-sm text-muted-foreground">{formatDate(c.event_date + "T00:00:00+08:00")}</p><p className="mt-1 break-all text-xs text-muted-foreground">{c.certificate_number}</p>
      <div className="mt-5 flex flex-wrap gap-4 border-t pt-3 text-sm font-medium">
        <Link className="inline-flex min-h-10 items-center gap-1 text-orange-800 hover:underline focus-visible:outline-2 focus-visible:outline-orange-600" href={`/certificates/${c.id}`}>View certificate<ArrowUpRightIcon className="size-4" aria-hidden="true" /></Link>
        {!c.revoked_at && <a className="inline-flex min-h-10 items-center gap-2 hover:underline focus-visible:outline-2 focus-visible:outline-orange-600" href={`/certificates/${c.id}/pdf`}><DownloadIcon className="size-4" aria-hidden="true" />Download PDF</a>}
      </div>
    </li>)}</ul>}
  </div>;
}
