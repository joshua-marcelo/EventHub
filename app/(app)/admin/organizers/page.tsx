import { Suspense } from "react";
import Link from "next/link";
import { BadgeCheckIcon } from "lucide-react";

import { FilterTabs, Initials, PanelEmpty, fullName } from "@/components/admin/admin-ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { getOrganizerDirectory } from "@/lib/admin/organizers";
import { formatDate } from "@/lib/datetime";
import { CreateAccountDialog } from "@/components/admin/create-account-dialog";
import { bindOrganizerActions, bindResetPassword } from "@/components/admin/organizer-status-actions";
import { UserRowActions } from "@/components/admin/user-row-actions";

export const metadata = { title: "Organizers" };

const filters = [{ value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }, { value: "revoked", label: "Revoked" }, { value: "all", label: "All" }] as const;

export default function Page({ searchParams }: PageProps<"/admin/organizers">) {
  return <div className="space-y-6">
    <PageHeader title="Organizers" description="Manage organizer access and permissions." action={<CreateAccountDialog role="organizer" />} />
    <Suspense fallback={<PageSkeleton />}><Content searchParams={searchParams} /></Suspense>
  </div>;
}

async function Content({ searchParams }: Pick<PageProps<"/admin/organizers">, "searchParams">) {
  const { admin, organizers: { data, error } } = await getOrganizerDirectory();
  const requested = (await searchParams).status;
  const current = filters.find(f => f.value === requested)?.value ?? "active";
  if (error) throw new Error("Could not load organizers.");
  const rows = current === "all" ? data : data.filter(p => p.organizer_status === current);

  return <div className="space-y-4">
    <FilterTabs label="Filter organizers by status" current={current} options={filters.map(f => ({ ...f, count: f.value === "all" ? data.length : data.filter(p => p.organizer_status === f.value).length, href: `/admin/organizers?status=${f.value}` }))} />
    <DataTable caption="Organizers" rowKey={p => p.id} rows={rows} empty={<PanelEmpty icon={BadgeCheckIcon} title={current === "all" ? "No organizers yet" : `No ${current} organizers`} description="Organizers with this status will be listed here." />} columns={[
      { key: "name", label: "Organizer", className: "min-w-40 whitespace-normal px-3", render: p => <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Initials name={fullName(p)} />
          <div className="min-w-0"><Link href={`/admin/users/${p.id}?from=organizers`} className="font-medium hover:underline">{fullName(p)}</Link><p className="break-all text-xs text-muted-foreground md:hidden">{p.email}</p>{p.student_id && <p className="text-xs text-muted-foreground">{p.student_id}</p>}</div>
        </div>
        <div className="flex items-center justify-between gap-2 sm:hidden"><StatusBadge status={p.organizer_status} /><Actions person={p} adminId={admin.id} /></div>
      </div> },
      { key: "email", label: "Email", className: "hidden whitespace-normal px-3 md:table-cell", render: p => <span className="wrap-anywhere text-muted-foreground">{p.email}</span> },
      { key: "status", label: "Status", className: "hidden px-3 sm:table-cell", render: p => <StatusBadge status={p.organizer_status} /> },
      { key: "since", label: "Organizer since", className: "hidden whitespace-normal px-3 md:table-cell", render: p => <span className="whitespace-nowrap text-muted-foreground">{p.organizer_since ? formatDate(p.organizer_since) : "—"}</span> },
      { key: "note", label: "Status note", className: "hidden whitespace-normal px-3 lg:table-cell", render: p => <p className="line-clamp-2 max-w-48 wrap-break-word text-muted-foreground" title={p.organizer_status_reason ?? undefined}>{p.organizer_status_reason || "—"}</p> },
      { key: "actions", label: "Actions", className: "hidden w-16 px-3 text-right sm:table-cell", render: p => <Actions person={p} adminId={admin.id} /> },
    ]} />
  </div>;
}

type Organizer = { id: string; first_name: string | null; last_name: string | null; organizer_status: "none" | "active" | "suspended" | "revoked" };

function Actions({ person: p, adminId }: { person: Organizer; adminId: string }) {
  return <UserRowActions name={fullName(p)} detailsHref={`/admin/users/${p.id}?from=organizers`} organizerStatus={p.organizer_status} actions={bindOrganizerActions(p.id, p.organizer_status, adminId)} resetPassword={bindResetPassword(p.id, false, adminId)} />;
}
