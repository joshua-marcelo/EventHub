import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { eventLookups } from "@/lib/mvp/queries";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/datetime";
export const metadata = { title: "Explore events" };
export default function Page(props: PageProps<"/events">) { return <Suspense fallback={<PageSkeleton />}><Content {...props} /></Suspense>; }
async function Content({ searchParams }: PageProps<"/events">) {
  await requireUser({ next:"/events" }); const query = await searchParams; const q = typeof query.q === "string" ? query.q.trim().slice(0,100) : ""; const category = Number(query.category);
  const page = Math.floor(Math.min(10000,Math.max(1,Number(query.page) || 1))); const from = (page-1)*24;
  const client = await createClient(); const lookups = await eventLookups();
  let request = client.from("events").select("id,title,venue,starts_at,capacity,category_id",{count:"exact"}).eq("status","published").eq("visibility","public").gt("starts_at",new Date().toISOString()).order("starts_at");
  if (q) request = request.textSearch("search",q,{type:"websearch",config:"simple"});
  if (Number.isInteger(category) && category > 0 && category < 32768) request = request.eq("category_id",category);
  const { data,error,count } = await request.range(from,from+23);
  if (error) throw new Error("Could not load events.");
  const paging = (n:number) => `/events?${new URLSearchParams({q,category:category > 0 ? String(category) : "",page:String(n)})}`;
  return <div className="space-y-6"><PageHeader title="Explore events" action={<Link className="underline" href="/events/join">Join by invite code</Link>} /><form className="flex flex-wrap gap-3"><Input aria-label="Search events" name="q" defaultValue={q} placeholder="Search events" className="max-w-sm" /><select className="rounded border p-2" name="category" defaultValue={category || ""} aria-label="Category"><option value="">All categories</option>{lookups.categories.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><Button type="submit">Search</Button></form>
    {data.length ? <div className="grid gap-4 sm:grid-cols-2">{data.map(e => <article key={e.id} className="space-y-2 rounded border p-4"><Link className="font-semibold underline" href={`/events/${e.id}`}>{e.title}</Link><p>{e.starts_at && formatDateTime(e.starts_at)}</p><p>{e.venue}</p><p className="text-sm text-muted-foreground">{lookups.categories.find(c => c.id === e.category_id)?.name} · Capacity: {e.capacity ?? "unlimited"}</p></article>)}</div> : <p>No matching upcoming events.</p>}
    <nav aria-label="Event pages" className="flex gap-4">{page > 1 && <Link href={paging(page-1)} className="underline">Previous</Link>}{from+data.length < (count ?? 0) && <Link href={paging(page+1)} className="underline">Next</Link>}</nav>
  </div>;
}