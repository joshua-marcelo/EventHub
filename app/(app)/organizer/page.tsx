import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { CalendarPlusIcon, CircleAlertIcon, FilePenLineIcon, UserCheckIcon } from "lucide-react";

import { PageSkeleton } from "@/components/page-skeleton";
import { StatStrip, WorkspaceSection, td, th } from "@/components/organizer/workspace-ui";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/datetime";
import { getOrganizerOverview } from "@/lib/organizer/hub";
import { cn } from "@/lib/utils";

export const metadata = { title: "Organizer overview" };
export default function Page() { return <Suspense fallback={<PageSkeleton />}><Dashboard /></Suspense>; }

const manage = "inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

async function Dashboard() {
  const o = await getOrganizerOverview();
  const create = o.canAct && <Link href="/organizer/events/new" className={buttonVariants()}><CalendarPlusIcon aria-hidden="true" />Create Event</Link>;
  const header = <PageHeader title="Overview" description="Manage your events and participant activity." action={create || undefined} />;

  if (!o.totals.events) return <div className="space-y-6">{header}
    <EmptyState title="No events yet" description={o.canAct ? "Create your first event as a draft, then publish it when it is ready." : "Events you organize will appear here."} action={create || undefined} />
  </div>;

  return <div className="space-y-8">
    {header}
    <StatStrip items={[
      { label: "Total events", value: o.totals.events },
      { label: "Published events", value: o.totals.published },
      { label: "Total registrations", value: o.totals.registrations, hint: "Approved and pending" },
      { label: "Attended participants", value: o.totals.attended, hint: "Checked in across events" },
    ]} />

    {o.attention.length > 0 && <WorkspaceSection title="Needs attention">
      <ul className="divide-y rounded-lg border bg-card">{o.attention.map(a => <li key={`${a.kind}-${a.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <span className="flex min-w-0 items-start gap-3">
          {a.kind === "pending" ? <UserCheckIcon className="mt-0.5 size-4 shrink-0 text-orange-800" aria-hidden="true" /> : <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />}
          <span className="min-w-0"><span className="block truncate font-medium">{a.title}</span><span className="block text-sm text-muted-foreground">{a.kind === "pending" ? `${a.count} registration${a.count === 1 ? "" : "s"} awaiting approval` : `${a.count} publishing requirement${a.count === 1 ? "" : "s"} missing`}</span></span>
        </span>
        <Link href={a.kind === "pending" ? `/organizer/events/${a.id}/registrations?status=pending` : `/organizer/events/${a.id}/settings`} className={buttonVariants({ variant: "outline", size: "sm" })}>{a.kind === "pending" ? "Review" : "Complete details"}</Link>
      </li>)}</ul>
    </WorkspaceSection>}

    <WorkspaceSection title="Upcoming events" description="Published events that have not started yet.">
      {o.upcoming.length ? <div className="overflow-hidden rounded-lg border bg-card"><table className="w-full table-fixed text-left text-sm"><caption className="sr-only">Upcoming events</caption>
        <thead><tr><th className={th}>Event</th><th className={cn(th, "hidden w-48 sm:table-cell")}>Date</th><th className={cn(th, "w-28 sm:w-36")}>Registrations</th><th className={cn(th, "w-20 text-right")}><span className="sr-only">Manage</span></th></tr></thead>
        <tbody>{o.upcoming.map(e => <tr key={e.id} className="group">
          <td className={td}><span className="block truncate font-medium" title={e.title}>{e.title}</span><span className="block text-xs text-muted-foreground sm:hidden">{e.starts_at ? formatDateTime(e.starts_at) : "Date not set"}</span></td>
          <td className={cn(td, "hidden text-muted-foreground sm:table-cell")}>{e.starts_at ? formatDateTime(e.starts_at) : "—"}</td>
          <td className={cn(td, "tabular-nums")}>{e.approved}{e.capacity ? ` / ${e.capacity}` : ""}{e.pending ? <span className="block text-xs text-muted-foreground">{e.pending} pending</span> : null}</td>
          <td className={cn(td, "text-right")}><Link href={`/organizer/events/${e.id}`} className={manage} aria-label={`Manage ${e.title}`}>Manage</Link></td>
        </tr>)}</tbody>
      </table></div> : <EmptyRow>No upcoming published events.</EmptyRow>}
    </WorkspaceSection>

    <WorkspaceSection title="Draft events" description="Finish these and publish them to open registration.">
      {o.drafts.length ? <ul className="divide-y rounded-lg border bg-card">{o.drafts.map(d => <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="min-w-0">
          <span className="block truncate font-medium">{d.title}</span>
          <span className="block text-sm text-muted-foreground">{d.missing.length ? `Missing: ${d.missing.slice(0, 2).join(", ")}${d.missing.length > 2 ? ` +${d.missing.length - 2} more` : ""}` : "Ready to publish"}</span>
        </span>
        <Link href={d.missing.length ? `/organizer/events/${d.id}/settings` : `/organizer/events/${d.id}`} className={buttonVariants({ variant: "outline", size: "sm" })} aria-label={`${d.missing.length ? "Edit" : "Publish"} ${d.title}`}>{d.missing.length ? <><FilePenLineIcon aria-hidden="true" />Edit</> : "Publish"}</Link>
      </li>)}</ul> : <EmptyRow>No drafts.</EmptyRow>}
    </WorkspaceSection>
  </div>;
}


function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
