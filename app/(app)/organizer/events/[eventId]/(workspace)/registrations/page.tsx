import { Suspense } from "react";
import Link from "next/link";
import { UsersIcon } from "lucide-react";
import { getOwnedEvent } from "@/lib/mvp/queries";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/datetime";
import type { Database } from "@/lib/database.types";
import { RegistrationDecision } from "@/components/organizer/registration-decision";
import { DataFrame, Pager, StatStrip, WorkspaceSection, td, th } from "@/components/organizer/workspace-ui";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageSkeleton } from "@/components/page-skeleton";
import { cn } from "@/lib/utils";
import { canUseOrganizerTools } from "@/lib/navigation";
import { searchTerm } from "@/lib/admin/participants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export const metadata = { title: "Registrations" };
type Status = Database["public"]["Enums"]["registration_status"];
const STATUSES: Status[] = ["pending", "approved", "rejected", "cancelled"];
const PAGE = 50;
export default function Page(props: PageProps<"/organizer/events/[eventId]/registrations">) { return <Suspense fallback={<PageSkeleton />}><Content {...props} /></Suspense>; }

async function Content({ params, searchParams }: PageProps<"/organizer/events/[eventId]/registrations">) {
  const { eventId } = await params; const { event, user } = await getOwnedEvent(eventId);
  const query = await searchParams;
  const status = STATUSES.find(s => s === query.status);
  const page = Math.floor(Math.min(10000, Math.max(1, Number(query.page) || 1))); const from = (page - 1) * PAGE;
  const client = await createClient();
  const count = (s: Status) => client.from("event_registrations").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("status", s);
  // Search needs an inner join so only registrations whose participant matches are counted and paged.
  const q = searchTerm(query.q); const search = q.length >= 2 ? q : "";
  const columns = `id,user_id,status,registered_at,decision_reason,profiles!event_registrations_user_id_fkey${search ? "!inner" : ""}(first_name,last_name,student_id,colleges(name))` as "id,user_id,status,registered_at,decision_reason,profiles!event_registrations_user_id_fkey(first_name,last_name,student_id,colleges(name))";
  let list = client.from("event_registrations").select(columns, { count: "exact" }).eq("event_id", event.id);
  if (status) list = list.eq("status", status);
  if (search) list = list.or(["first_name", "last_name", "student_id"].map(c => `${c}.ilike.%${search}%`).join(","), { referencedTable: "profiles" });
  const [rows, ...counts] = await Promise.all([list.order("registered_at").range(from, from + PAGE - 1), ...STATUSES.map(count)]);
  if (rows.error || counts.some(c => c.error)) throw new Error("Could not load registrations.");
  const totals = Object.fromEntries(STATUSES.map((s, i) => [s, counts[i].count ?? 0])) as Record<Status, number>;
  const all = STATUSES.reduce((n, s) => n + totals[s], 0);
  const editable = canUseOrganizerTools(user) && event.status === "published";
  const href = (next: { status?: Status; page?: number }) => {
    const p = new URLSearchParams(); if (next.status) p.set("status", next.status); if (search) p.set("q", search); if (next.page && next.page > 1) p.set("page", String(next.page));
    const q = p.toString(); return `/organizer/events/${event.id}/registrations${q ? `?${q}` : ""}`;
  };
  const filters: { label: string; value?: Status; n: number }[] = [{ label: "All", n: all }, ...STATUSES.map(s => ({ label: s[0].toUpperCase() + s.slice(1), value: s, n: totals[s] }))];

  return <div className="space-y-8">
    <StatStrip items={[
      { label: "Approved", value: totals.approved, hint: event.capacity ? `of ${event.capacity} places` : "Unlimited capacity" },
      { label: "Pending", value: totals.pending, hint: totals.pending ? "Awaiting your decision" : undefined },
      { label: "Rejected", value: totals.rejected },
      { label: "Cancelled", value: totals.cancelled, hint: "By participants" },
    ]} />
    <WorkspaceSection title="Registrations" description={editable ? (event.approval_mode === "manual" ? "Approve or reject pending registrations." : "Registrations are approved automatically.") : "Decisions are available while the event is published."}>
      <form role="search" aria-label="Search registrations" className="flex max-w-md gap-2">{status && <input type="hidden" name="status" value={status} />}<Input type="search" name="q" defaultValue={search} placeholder="Search name or student ID" aria-label="Search name or student ID" minLength={2} maxLength={80} className="h-8" /><Button type="submit" variant="outline" size="sm">Search</Button></form>
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">{filters.map(f => { const active = f.value === status; return <Link key={f.label} href={href({ status: f.value })} aria-current={active ? "page" : undefined} className={cn("inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", active ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{f.label}<span className="tabular-nums opacity-70">{f.n}</span></Link>; })}</nav>
      {rows.data.length ? <DataFrame label="Event registrations">
        <thead><tr><th className={th}>Participant</th><th className={cn(th, "hidden md:table-cell")}>College</th><th className={th}>Status</th><th className={th}>Registered</th><th className={th}>{editable ? "Decision" : "Note"}</th></tr></thead>
        <tbody>{rows.data.map(r => {
          const p = r.profiles; const name = p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Registrant" : "Registrant";
          return <tr key={r.id} className="group">
            <td className={td}><span className="block font-medium">{p ? name : "Registrant details no longer available"}</span>{p?.student_id && <span className="block text-xs text-muted-foreground">{p.student_id}</span>}</td>
            <td className={cn(td, "hidden text-muted-foreground md:table-cell")}>{p?.colleges?.name ?? "—"}</td>
            <td className={td}><StatusBadge status={r.status} /></td>
            <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>{formatDateTime(r.registered_at)}</td>
            <td className={cn(td, "min-w-56")}>{editable && r.status === "pending" ? <RegistrationDecision id={r.id} name={name} /> : <span className="text-muted-foreground">{r.decision_reason ?? "—"}</span>}</td>
          </tr>;
        })}</tbody>
      </DataFrame> : <EmptyState icon={UsersIcon} headingLevel="h3" title={search ? "No matching registrations" : status ? `No ${status} registrations` : "No registrations yet"} description={search || status ? "Try another search or status." : event.status === "published" ? "Share the registration link from Overview. New registrations appear here." : "Registrations open once the event is published."} />}
      <Pager label="Registration pages" from={from} shown={rows.data.length} total={rows.count ?? 0} prev={page > 1 ? href({ status, page: page - 1 }) : undefined} next={from + rows.data.length < (rows.count ?? 0) ? href({ status, page: page + 1 }) : undefined} />
    </WorkspaceSection>
  </div>;
}
