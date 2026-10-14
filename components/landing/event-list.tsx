import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatInManila } from "@/lib/datetime";

export async function PublicEventList() {
  const client = await createClient();
  const { data: events, error } = await client.rpc("get_upcoming_public_events");
  if (error) return <p className="rounded-lg border border-stone-200 bg-white p-6 text-slate-600">The event calendar is temporarily unavailable. Please try again shortly.</p>;
  if (!events.length) return <div className="border-y border-stone-200 py-8"><p className="text-lg font-semibold text-slate-900">No upcoming events yet.</p><p className="mt-2 text-sm text-slate-600">Published events will appear here.</p></div>;
  return <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{events.map(event => {
    const poster = event.banner_path ? client.storage.from("event-banners").getPublicUrl(event.banner_path).data.publicUrl : null;
    return <article key={event.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <Link href={`/events/${event.id}`} tabIndex={-1} aria-hidden="true" className="block aspect-[16/10] overflow-hidden bg-slate-900">
        {poster ? <Image src={poster} alt="" width={640} height={400} unoptimized className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-between gap-6 p-6 text-white"><div><p className="text-xs uppercase tracking-[.16em] text-orange-300">Campus calendar</p><p className="mt-3 max-w-52 text-2xl font-semibold leading-tight">{event.title}</p></div><CalendarDays className="size-10 shrink-0 text-orange-400" strokeWidth={1.5} /></div>}
      </Link>
      <div className="p-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-medium text-slate-500">{event.category_name}</span><span className={`rounded-full px-2.5 py-1 font-medium ${event.registration_state === "Registration open" ? "bg-orange-50 text-orange-800" : "bg-stone-100 text-slate-600"}`}>{event.registration_state}</span></div>
        <h3 className="text-lg font-semibold leading-snug"><Link href={`/events/${event.id}`} className="flex items-start justify-between gap-3 hover:text-orange-800">{event.title}<ArrowUpRight className="mt-1 size-4 shrink-0" aria-hidden="true" /></Link></h3>
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-600"><CalendarDays className="size-4" aria-hidden="true" />{formatInManila(event.starts_at!,"MMM d, yyyy · h:mm a")}</p><p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><MapPin className="size-4 shrink-0" aria-hidden="true" />{event.venue}</p>
      </div>
    </article>;
  })}</div>;
}
