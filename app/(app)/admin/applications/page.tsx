import { Suspense } from "react";
import Link from "next/link";
import { InboxIcon } from "lucide-react";

import { FilterTabs, PanelEmpty, fullName } from "@/components/admin/admin-ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/dal";
import type { Database } from "@/lib/database.types";
import { formatDate } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Application history" };

type Status = Database["public"]["Enums"]["application_status"];
const filters: { value: Status | "all"; label: string }[] = [
  { value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }, { value: "withdrawn", label: "Withdrawn" }, { value: "all", label: "All" },
];
const emptyText: Record<Status | "all", [string, string]> = {
  pending: ["No pending applications", "Historical pending applications will be listed here."],
  approved: ["No approved applications", "Approved applications will be listed here."],
  rejected: ["No rejected applications", "Rejected applications will be listed here."],
  withdrawn: ["No withdrawn applications", "Applications withdrawn by applicants will be listed here."],
  all: ["No application history", "The retired application workflow has no records to display."],
};

export default function Page({ searchParams }: PageProps<"/admin/applications">) {
  return <div className="space-y-6">
    <PageHeader title="Application History" description="Read-only records from the retired organizer application workflow. Organizer access is managed in Organizers." />
    <Suspense fallback={<PageSkeleton />}><Content searchParams={searchParams} /></Suspense>
  </div>;
}

async function Content({ searchParams }: Pick<PageProps<"/admin/applications">, "searchParams">) {
  await requireAdmin();
  const requested = (await searchParams).status;
  const current = filters.find(f => f.value === requested)?.value ?? "all";
  const { data, error } = await (await createClient()).from("organizer_applications")
    .select("id,organization_name,position_title,status,submitted_at,applicant:profiles!organizer_applications_applicant_id_fkey(first_name,last_name,student_id)")
    .order("submitted_at").limit(200);
  if (error) throw new Error("Could not load applications.");
  // Same rows as before: pending first, oldest first; the filter only narrows what is shown.
  const all = data.toSorted((a, b) => Number(b.status === "pending") - Number(a.status === "pending"));
  const rows = current === "all" ? all : all.filter(a => a.status === current);
  const [emptyTitle, emptyDescription] = emptyText[current];

  return <div className="space-y-4">
    <FilterTabs label="Filter applications by status" current={current} options={filters.map(f => ({ ...f, count: f.value === "all" ? all.length : all.filter(a => a.status === f.value).length, href: `/admin/applications?status=${f.value}` }))} />
    <DataTable caption="Organizer applications" rowKey={a => a.id} rows={rows} empty={<PanelEmpty icon={InboxIcon} title={emptyTitle} description={emptyDescription} />} columns={[
      { key: "organization", label: "Organization", render: a => <div className="min-w-0">
        <Link href={`/admin/applications/${a.id}`} className="font-medium hover:underline">{a.organization_name}</Link>
        <p className="text-xs text-muted-foreground md:hidden">{fullName(a.applicant)}</p>
        <div className="mt-1.5 sm:hidden"><StatusBadge status={a.status} /></div>
      </div> },
      { key: "applicant", label: "Applicant", className: "hidden md:table-cell", render: a => <div><p>{fullName(a.applicant)}</p>{a.applicant?.student_id && <p className="text-xs text-muted-foreground">{a.applicant.student_id}</p>}</div> },
      { key: "position", label: "Position", className: "hidden lg:table-cell", render: a => a.position_title },
      { key: "submitted", label: "Submitted", className: "hidden sm:table-cell", render: a => <span className="whitespace-nowrap text-muted-foreground">{formatDate(a.submitted_at)}</span> },
      { key: "status", label: "Status", className: "hidden sm:table-cell", render: a => <StatusBadge status={a.status} /> },
      { key: "action", label: "Action", className: "text-right", render: a => <Link href={`/admin/applications/${a.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>View</Link> },
    ]} />
  </div>;
}
