import Link from "next/link";
import { CalendarDaysIcon, MapPinIcon, TicketIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { eventLookups } from "@/lib/mvp/queries";
import { formatDateTime } from "@/lib/datetime";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ParticipantEmptyState } from "@/components/participant/empty-state";

export type DiscoveryParams = Promise<Record<string, string | string[] | undefined>>;

/** Shared by Home and the existing Explore route; one discovery query and filter flow. */
export async function EventDiscovery({ searchParams, basePath }: { searchParams: DiscoveryParams; basePath: "/dashboard" | "/events" }) {
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 100) : "";
  const category = Number(query.category);
  const page = Math.floor(Math.min(10000, Math.max(1, Number(query.page) || 1)));
  const from = (page - 1) * 24;
  const client = await createClient();
  const lookups = await eventLookups();
  let request = client.from("events").select("id,title,venue,starts_at,capacity,category_id", { count: "exact" }).eq("status", "published").eq("visibility", "public").gt("starts_at", new Date().toISOString()).order("starts_at");
  if (q) request = request.textSearch("search", q, { type: "websearch", config: "simple" });
  if (Number.isInteger(category) && category > 0 && category < 32768) request = request.eq("category_id", category);
  const { data, error, count } = await request.range(from, from + 23);
  if (error) throw new Error("Could not load events.");
  const paging = (n: number) => `${basePath}?${new URLSearchParams({ q, category: category > 0 ? String(category) : "", page: String(n) })}`;
  const filtered = Boolean(q || category > 0 || page > 1);
  return <section aria-labelledby="available-events" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="available-events" className="text-lg font-semibold text-slate-900">Available Events</h2><Link href="/events/join" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"><TicketIcon className="size-4" aria-hidden="true" />Join by Invite Code</Link></div>
    <form action={basePath} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_auto]">
      <Input aria-label="Search events" name="q" defaultValue={q} placeholder="Search events" className="h-10 bg-white" />
      <select className="h-10 min-w-0 rounded-lg border border-input bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-orange-600" name="category" defaultValue={category || ""} aria-label="Category"><option value="">All categories</option>{lookups.categories.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <Button type="submit" className="h-10">Search</Button>
    </form>
    {data.length ? <div className="grid gap-4 lg:grid-cols-2">{data.map(e => <article key={e.id} className="min-w-0 space-y-4 rounded-xl border bg-white p-5">
      <div><p className="mb-2 text-xs font-medium text-orange-800">{lookups.categories.find(c => c.id === e.category_id)?.name ?? "University event"}</p><h3 className="break-words text-lg font-semibold text-slate-900"><Link className="hover:underline focus-visible:outline-2 focus-visible:outline-orange-600" href={`/events/${e.id}`}>{e.title}</Link></h3></div>
      <div className="space-y-2 text-sm text-muted-foreground"><p className="flex gap-2"><CalendarDaysIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{e.starts_at && formatDateTime(e.starts_at)}</p><p className="flex gap-2 break-words"><MapPinIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{e.venue}</p></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm"><span className="text-muted-foreground">Capacity: {e.capacity ?? "unlimited"}</span><Link className="font-medium text-orange-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-orange-600" href={`/events/${e.id}`}>View event</Link></div>
    </article>)}</div> : <ParticipantEmptyState icon={CalendarDaysIcon} title={filtered ? "No matching events." : "No events available yet."} description={filtered ? "Try another search or category." : "Published university events will appear here."} action={filtered ? <Link href={basePath} className="text-sm font-medium text-orange-800 underline">Clear filters</Link> : undefined} />}
    {(page > 1 || from + data.length < (count ?? 0)) && <nav aria-label="Event pages" className="flex justify-between gap-4 text-sm font-medium">{page > 1 && <Link href={paging(page - 1)} className="underline">Previous</Link>}{from + data.length < (count ?? 0) && <Link href={paging(page + 1)} className="ml-auto underline">Next</Link>}</nav>}
  </section>;
}
