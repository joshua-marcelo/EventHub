import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { formatDateTime } from "@/lib/datetime";
export const metadata = { title: "Organizer applications" };
export default function Page() { return <Suspense fallback={<PageSkeleton />}><Content /></Suspense>; }
async function Content() {
  await requireAdmin();
  const { data, error } = await (await createClient()).from("organizer_applications").select("id,organization_name,position_title,status,submitted_at").order("submitted_at").limit(200);
  if (error) throw new Error("Could not load applications.");
  const apps = data.toSorted((a,b) => Number(b.status === "pending") - Number(a.status === "pending"));
  return <div className="space-y-6"><PageHeader title="Organizer applications" description="Pending applications first, oldest first. Review proof before approving." />{apps.length ? <ul className="space-y-3">{apps.map(a => <li key={a.id} className="rounded border p-4"><Link href={`/admin/applications/${a.id}`} className="font-medium underline">{a.organization_name}</Link><p>{a.position_title} · {a.status}</p><p className="text-sm text-muted-foreground">{formatDateTime(a.submitted_at)}</p></li>)}</ul> : <p>No applications yet.</p>}</div>;
}