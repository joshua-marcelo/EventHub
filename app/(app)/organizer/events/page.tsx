import { Suspense } from "react";
import Link from "next/link";
import { requireOrganizer } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/datetime";
export default function Page() { return <Suspense fallback={<PageSkeleton />}><Content /></Suspense>; }
async function Content() {
  const user = await requireOrganizer({ allowInactive:true });
  const { data, error } = await (await createClient()).from("events").select("id,title,status,starts_at").eq("organizer_id",user.id).order("created_at",{ascending:false}).limit(100);
  if (error) throw new Error("Could not load events.");
  return <div className="space-y-6"><PageHeader title="My organized events" action={user.organizerStatus === "active" && <Link href="/organizer/events/new" className={buttonVariants()}>Create event</Link>} />{data.length ? data.map(e => <article key={e.id} className="rounded border p-4"><Link href={`/organizer/events/${e.id}`} className="font-semibold underline">{e.title}</Link><p>{e.status} · {e.starts_at ? formatDateTime(e.starts_at) : "Schedule not set"}</p></article>) : <p>No events yet.</p>}</div>;
}