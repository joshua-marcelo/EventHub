import { Suspense } from "react";
import Link from "next/link";
import { BadgeCheckIcon } from "lucide-react";

import { FilterTabs, Initials, PanelEmpty, fullName } from "@/components/admin/admin-ui";
import { ReviewAction } from "@/components/admin/review-action";
import { PageSkeleton } from "@/components/page-skeleton";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireAdmin } from "@/lib/auth/dal";
import { formatDate } from "@/lib/datetime";
import { changeOrganizerStatus } from "@/lib/mvp/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Organizers" };

const filters = [{ value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }, { value: "revoked", label: "Revoked" }, { value: "all", label: "All" }] as const;

export default function Page({ searchParams }: PageProps<"/admin/organizers">) {
  return <div className="space-y-6">
    <PageHeader title="Organizers" description="Participants approved to run events. Suspended and revoked organizers cannot change events or registrations." />
    <Suspense fallback={<PageSkeleton />}><Content searchParams={searchParams} /></Suspense>
  </div>;
}

async function Content({ searchParams }: Pick<PageProps<"/admin/organizers">, "searchParams">) {
  await requireAdmin();
  const requested = (await searchParams).status;
  const current = filters.find(f => f.value === requested)?.value ?? "active";
  const { data, error } = await (await createClient()).from("profiles").select("id,first_name,last_name,student_id,organizer_status,organizer_status_reason,organizer_since").neq("organizer_status", "none").order("last_name").limit(200);
  if (error) throw new Error("Could not load organizers.");
  const rows = current === "all" ? data : data.filter(p => p.organizer_status === current);

  return <div className="space-y-4">
    <FilterTabs label="Filter organizers by status" current={current} options={filters.map(f => ({ ...f, count: f.value === "all" ? data.length : data.filter(p => p.organizer_status === f.value).length, href: `/admin/organizers?status=${f.value}` }))} />
    <DataTable caption="Organizers" rowKey={p => p.id} rows={rows} empty={<PanelEmpty icon={BadgeCheckIcon} title={current === "all" ? "No organizers yet" : `No ${current} organizers`} description={current === "all" ? "Approved organizer applications add organizers here." : "Organizers with this status will be listed here."} />} columns={[
      { key: "name", label: "Organizer", render: p => <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Initials name={fullName(p)} />
          <div className="min-w-0"><Link href={`/admin/users/${p.id}`} className="font-medium hover:underline">{fullName(p)}</Link>{p.student_id && <p className="text-xs text-muted-foreground">{p.student_id}</p>}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:hidden"><StatusBadge status={p.organizer_status} /><Actions person={p} /></div>
      </div> },
      { key: "status", label: "Status", className: "hidden sm:table-cell", render: p => <StatusBadge status={p.organizer_status} /> },
      { key: "since", label: "Organizer since", className: "hidden md:table-cell", render: p => <span className="whitespace-nowrap text-muted-foreground">{p.organizer_since ? formatDate(p.organizer_since) : "—"}</span> },
      { key: "note", label: "Status note", className: "hidden lg:table-cell", render: p => <p className="max-w-xs truncate text-muted-foreground" title={p.organizer_status_reason ?? undefined}>{p.organizer_status_reason || "—"}</p> },
      { key: "actions", label: "Actions", className: "hidden text-right sm:table-cell", render: p => <div className="flex flex-wrap justify-end gap-2"><Actions person={p} /></div> },
    ]} />
  </div>;
}

type Organizer = { id: string; first_name: string | null; last_name: string | null; organizer_status: "none" | "active" | "suspended" | "revoked" };

/** The existing status transitions only: suspend or revoke an active organizer, reinstate or revoke a suspended one. */
function Actions({ person: p }: { person: Organizer }) {
  const name = fullName(p);
  return <>
    {p.organizer_status === "active" && <ReviewAction size="sm" tone="outline" reason="required" label="Suspend" title={`Suspend ${name}?`} description="Suspended organizers cannot change events or registrations until reinstated." confirmLabel="Suspend organizer" runAction={changeOrganizerStatus.bind(null, p.id, "suspended")} />}
    {p.organizer_status === "suspended" && <ReviewAction size="sm" tone="outline" reason="required" label="Reinstate" title={`Reinstate ${name}?`} description="They can manage their events and registrations again." confirmLabel="Reinstate organizer" runAction={changeOrganizerStatus.bind(null, p.id, "active")} />}
    {p.organizer_status !== "revoked" && <ReviewAction size="sm" tone="destructive" reason="required" label="Revoke" title={`Revoke ${name}'s organizer access?`} description="Revoked organizers cannot change events or registrations." confirmLabel="Revoke access" runAction={changeOrganizerStatus.bind(null, p.id, "revoked")} />}
    {p.organizer_status === "revoked" && <span className="text-xs text-muted-foreground">No actions</span>}
  </>;
}
