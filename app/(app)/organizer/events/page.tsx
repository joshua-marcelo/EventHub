import { Suspense } from "react";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { requireOrganizer } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { EventBanner } from "@/components/mvp/event-banner";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/datetime";
import { canUseOrganizerTools } from "@/lib/navigation";
export const metadata = { title: "My Events" };
export default function Page() { return <Suspense fallback={<PageSkeleton />}><Content /></Suspense>; }
async function Content() {
  const user = await requireOrganizer({ allowInactive:true });
  const { data, error } = await (await createClient()).from("events").select("id,title,status,starts_at,venue,banner_path").eq("organizer_id",user.id).order("created_at",{ascending:false}).limit(100);
  if (error) throw new Error("Could not load events.");
  const create = canUseOrganizerTools(user) && <Link href="/organizer/events/new" className={buttonVariants()}>Create event</Link>;
  return <div className="mx-auto w-full max-w-5xl space-y-6"><PageHeader title="My Events" description="Events you organize. Open one to edit, publish or manage it." action={create} />
    {data.length ? <ul className="divide-y rounded-lg border">{data.map(e => <li key={e.id}>
      <Link href={`/organizer/events/${e.id}`} className="group flex items-center gap-4 p-3 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:p-4">
        <EventBanner path={e.banner_path} sizes="128px" className="w-24 shrink-0 rounded-md sm:w-32" />
        <span className="min-w-0 flex-1 space-y-1"><span className="flex flex-wrap items-center gap-2"><span className="break-words font-medium">{e.title}</span><StatusBadge status={e.status} /></span><span className="block truncate text-sm text-muted-foreground">{[e.starts_at ? formatDateTime(e.starts_at) : "Schedule not set", e.venue].filter(Boolean).join(" · ")}</span></span>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </li>)}</ul> : <EmptyState title="No events yet" description="Create your first event as a draft, then publish it when it is ready." action={create || undefined} />}
  </div>;
}
