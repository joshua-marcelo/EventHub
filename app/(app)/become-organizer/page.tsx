import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { canUseOrganizerTools } from "@/lib/navigation";
export const metadata = { title: "Organizer access" };
export default function Page() { return <Suspense fallback={<PageSkeleton />}><Content /></Suspense>; }
async function Content() {
  const user = await requireUser({ next: "/become-organizer" });
  const { data, error } = await (await createClient()).from("organizer_applications").select("*").eq("applicant_id",user.id).order("submitted_at",{ ascending:false });
  if (error) throw new Error("Could not load applications.");
  return <div className="space-y-6"><PageHeader title="Organizer access" description="Organizer access is managed exclusively by administrators through invitations or participant promotion. Applications are closed." />
    {canUseOrganizerTools(user) ? <Link className="underline" href="/organizer/events">Open organizer events</Link> : <p>Contact an administrator about organizer access.</p>}
    <p className="text-sm text-muted-foreground">Previous applications are retained below for reference. Pending records will not be approved through this retired workflow.</p>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Application history</h2>{data.length ? data.map(a => <article key={a.id} className="rounded border p-4"><p className="font-medium">{a.organization_name}</p><p className="capitalize">{a.status}</p>{a.review_notes && <p className="text-sm">{a.review_notes}</p>}</article>) : <p className="text-muted-foreground">No applications yet.</p>}</section>
  </div>;
}
