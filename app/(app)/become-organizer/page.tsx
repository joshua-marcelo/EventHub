import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ApplicationForm } from "@/components/mvp/application-form";
import { ActionControl } from "@/components/mvp/action-control";
import { withdrawApplication } from "@/lib/mvp/actions";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
export const metadata = { title: "Become an organizer" };
export default function Page() { return <Suspense fallback={<PageSkeleton />}><Content /></Suspense>; }
async function Content() {
  const user = await requireUser({ next: "/become-organizer" });
  const { data, error } = await (await createClient()).from("organizer_applications").select("*").eq("applicant_id",user.id).order("submitted_at",{ ascending:false });
  if (error) throw new Error("Could not load applications.");
  const pending = data.find(a => a.status === "pending");
  return <div className="space-y-6"><PageHeader title="Become an organizer" description="An administrator reviews your authorization before you can publish events." />
    {user.organizerStatus === "active" ? <Link className="underline" href="/organizer/events">Open organizer events</Link> : user.organizerStatus === "suspended" ? <p>Your organizer access is suspended. Contact an administrator.</p> : pending ? <section className="space-y-3"><p>Your application is pending review.</p><ActionControl label="Withdraw application" runAction={withdrawApplication.bind(null,pending.id)} confirm /></section> : <ApplicationForm userId={user.id} />}
    <section className="space-y-3"><h2 className="text-lg font-semibold">Application history</h2>{data.length ? data.map(a => <article key={a.id} className="rounded border p-4"><p className="font-medium">{a.organization_name}</p><p className="capitalize">{a.status}</p>{a.review_notes && <p className="text-sm">{a.review_notes}</p>}</article>) : <p className="text-muted-foreground">No applications yet.</p>}</section>
  </div>;
}