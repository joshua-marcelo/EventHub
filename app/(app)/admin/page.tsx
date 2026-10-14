import Link from "next/link";
import { Suspense } from "react";
import { BadgeCheckIcon, CalendarCheckIcon, CalendarDaysIcon, ClipboardListIcon, InboxIcon, UsersIcon } from "lucide-react";

import { Panel, PanelEmpty, PanelLink, StatCard, fullName } from "@/components/admin/admin-ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { requireAdmin } from "@/lib/auth/dal";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin overview" };

export default function Page() { return <Suspense fallback={<PageSkeleton />}><Overview /></Suspense>; }

async function Overview() {
  await requireAdmin();
  const client = await createClient();
  // Counts use exact head queries (no rows transferred); lists are capped at five.
  const [pendingCount, organizers, participants, publishedCount, pending, events] = await Promise.all([
    client.from("organizer_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    client.from("profiles").select("id", { count: "exact", head: true }).eq("organizer_status", "active"),
    client.from("profiles").select("id", { count: "exact", head: true }).eq("is_complete", true),
    client.from("events").select("id", { count: "exact", head: true }).eq("status", "published"),
    client.from("organizer_applications").select("id,organization_name,position_title,submitted_at,applicant:profiles!organizer_applications_applicant_id_fkey(first_name,last_name)").eq("status", "pending").order("submitted_at").limit(5),
    client.from("events").select("id,title,starts_at,venue,published_at,event_categories(name),organizer:profiles!events_organizer_id_fkey(first_name,last_name)").eq("status", "published").order("published_at", { ascending: false, nullsFirst: false }).limit(5),
  ]);
  if (pendingCount.error || organizers.error || participants.error || publishedCount.error || pending.error || events.error) throw new Error("Could not load admin overview.");
  const waiting = pendingCount.count ?? 0;

  return <div className="space-y-6">
    <PageHeader title="Admin Overview" description="Organizer applications awaiting review and what is currently published across EventHub." />

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Pending Applications" value={waiting} hint={waiting ? "Waiting for an administrator" : "Nothing to review"} icon={ClipboardListIcon} href="/admin/applications" highlight={waiting > 0} />
      <StatCard label="Active Organizers" value={organizers.count ?? 0} hint="Can publish and manage events" icon={BadgeCheckIcon} href="/admin/organizers" />
      <StatCard label="Registered Participants" value={participants.count ?? 0} hint="Accounts with a completed profile" icon={UsersIcon} href="/admin/users" />
      <StatCard label="Published Events" value={publishedCount.count ?? 0} hint="Currently open to participants" icon={CalendarCheckIcon} />
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Pending Organizer Applications" description="Oldest first" action={<PanelLink href="/admin/applications">View all</PanelLink>}>
        {pending.data.length ? <ul className="divide-y">
          {pending.data.map(a => <li key={a.id}>
            <Link href={`/admin/applications/${a.id}`} className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{a.organization_name}</span>
                <span className="block truncate text-xs text-muted-foreground">{fullName(a.applicant)} · {a.position_title}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDate(a.submitted_at)}</span>
            </Link>
          </li>)}
        </ul> : <PanelEmpty icon={InboxIcon} title="No pending applications" description="New organizer applications will appear here for review." />}
      </Panel>

      <Panel title="Recent Published Events" description="Most recently published" >
        {events.data.length ? <ul className="divide-y">
          {events.data.map(e => <li key={e.id}>
            <Link href={`/admin/events/${e.id}`} className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{e.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{[fullName(e.organizer), e.event_categories?.name, e.venue].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="shrink-0 text-right text-xs text-muted-foreground">{e.starts_at ? formatDateTime(e.starts_at) : "Date to be announced"}</span>
            </Link>
          </li>)}
        </ul> : <PanelEmpty icon={CalendarDaysIcon} title="No published events" description="Events appear here once organizers publish them." />}
      </Panel>
    </div>
  </div>;
}
