import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
export const metadata = { title: "Admin dashboard" };
export default function Page() { return <Suspense fallback={<PageSkeleton />}><Dashboard /></Suspense>; }
async function Dashboard() {
  await requireAdmin(); const client = await createClient();
  const [applications,organizers,events] = await Promise.all([
    client.from("organizer_applications").select("id",{count:"exact",head:true}).eq("status","pending"),
    client.from("profiles").select("id",{count:"exact",head:true}).eq("organizer_status","active"),
    client.from("events").select("id,title,status").neq("status","draft").order("created_at",{ascending:false}).limit(20),
  ]);
  if (applications.error || organizers.error || events.error) throw new Error("Could not load admin overview.");
  return <div className="space-y-6"><PageHeader title="Admin dashboard" description="Review organizers and maintain campus information." action={<Link href="/admin/lookups" className={buttonVariants()}>Manage lookups</Link>} /><div className="flex flex-wrap gap-4"><Link href="/admin/applications" className="rounded border p-4 underline">Pending applications: {applications.count ?? 0}</Link><Link href="/admin/organizers" className="rounded border p-4 underline">Active organizers: {organizers.count ?? 0}</Link></div><section className="space-y-3"><h2 className="text-lg font-semibold">Recent published events</h2>{events.data.length ? events.data.map(e => <p key={e.id}><Link className="underline" href={`/admin/events/${e.id}`}>{e.title}</Link> · {e.status}</p>) : <p>No published events yet.</p>}</section></div>;
}