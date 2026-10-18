import { Suspense } from "react";
import Link from "next/link";
import { UsersIcon, UserSearchIcon } from "lucide-react";

import { Initials, PanelEmpty, fullName } from "@/components/admin/admin-ui";
import { bindOrganizerActions } from "@/components/admin/organizer-status-actions";
import { ParticipantFilters } from "@/components/admin/participant-filters";
import { UserRowActions } from "@/components/admin/user-row-actions";
import { PageSkeleton } from "@/components/page-skeleton";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { type DirectoryRow, directoryHref, getCollegeOptions, getParticipantDirectory, hasFilters, parseDirectoryParams, profileStatus } from "@/lib/admin/participants";
import { formatDate } from "@/lib/datetime";

export const metadata = { title: "Participants" };

export default function Page({ searchParams }: PageProps<"/admin/users">) {
  return <div className="space-y-6">
    <PageHeader title="Participants" description="Regular participant accounts. Organizers, including suspended, revoked and invited ones, are managed under Organizers; administrator accounts are not listed." />
    <Suspense fallback={<PageSkeleton />}><Content searchParams={searchParams} /></Suspense>
  </div>;
}

async function Content({ searchParams }: Pick<PageProps<"/admin/users">, "searchParams">) {
  const params = parseDirectoryParams(await searchParams);
  // Both calls run requireAdmin before any query.
  const [{ adminId, rows, total, window: w }, colleges] = await Promise.all([getParticipantDirectory(params), getCollegeOptions()]);
  const filtered = hasFilters(params);

  // The filter form carries data-pending while a new page loads; the results dim rather than look current.
  return <div className="group space-y-4">
    <ParticipantFilters colleges={colleges} />
    <div className="space-y-4 transition-opacity group-has-[[data-pending]]:opacity-60" aria-live="polite">
      <p className="text-sm text-muted-foreground">
        {total === 0 ? (filtered ? "No participants match these filters." : "No participants yet.") : `Showing ${w.from}–${w.to} of ${total.toLocaleString("en-PH")} ${total === 1 ? "participant" : "participants"}${params.q ? ` matching “${params.q}”` : ""}`}
      </p>

      <DataTable caption="Participant accounts, newest first" rowKey={u => u.id} rows={rows} empty={filtered
        ? <div className="space-y-3"><PanelEmpty icon={UserSearchIcon} title="No matching participants" description="Check the spelling, search by email or student ID, or clear the filters." /><Link href="/admin/users" className={buttonVariants({ variant: "outline", size: "sm" })}>Clear filters</Link></div>
        : <PanelEmpty icon={UsersIcon} title="No participants yet" description="Participant accounts appear here as soon as people sign up." />} columns={[
        { key: "name", label: "Participant", className: "min-w-44 whitespace-normal px-3", render: u => <div className="flex items-center gap-3">
          <Initials name={fullName(u)} />
          <div className="min-w-0">
            <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">{fullName(u)}</Link>
            <p className="wrap-anywhere text-xs text-muted-foreground md:hidden">{u.email}</p>
            {u.identity_flagged_at && <Badge variant="outline" className="mt-1 border-destructive/30 bg-destructive/10 text-destructive">Identity flagged</Badge>}
          </div>
        </div> },
        { key: "email", label: "Email", className: "hidden whitespace-normal px-3 md:table-cell", render: u => <span className="wrap-anywhere text-muted-foreground">{u.email}</span> },
        { key: "college", label: "College", className: "hidden whitespace-normal px-3 lg:table-cell", render: u => u.colleges ? <span className="line-clamp-2">{u.colleges.name}</span> : <span className="text-muted-foreground">—</span> },
        { key: "profile", label: "Profile", className: "hidden px-3 sm:table-cell", render: u => <ProfileCell user={u} /> },
        { key: "joined", label: "Joined", className: "hidden whitespace-nowrap px-3 xl:table-cell", render: u => <span className="text-muted-foreground">{formatDate(u.created_at)}</span> },
        // Regular participants have no suspend/delete state; the menu offers View details (organizer actions bind to nothing here).
        { key: "actions", label: "Actions", className: "w-16 px-3 text-right", render: u => <UserRowActions name={fullName(u)} detailsHref={`/admin/users/${u.id}`} organizerStatus={u.organizer_status} actions={bindOrganizerActions(u.id, u.organizer_status, adminId)} /> },
      ]} />

      {w.totalPages > 1 && <Pagination aria-label="Participants pages">
        <PaginationContent className="w-full justify-between gap-2">
          <PaginationItem>{w.hasPrevious ? <PaginationPrevious href={directoryHref(params, { page: w.current - 1 })} /> : <PaginationPrevious aria-disabled="true" tabIndex={-1} className="pointer-events-none opacity-50" />}</PaginationItem>
          <PaginationItem><span className="text-sm text-muted-foreground" aria-current="page">Page {w.current} of {w.totalPages}</span></PaginationItem>
          <PaginationItem>{w.hasNext ? <PaginationNext href={directoryHref(params, { page: w.current + 1 })} /> : <PaginationNext aria-disabled="true" tabIndex={-1} className="pointer-events-none opacity-50" />}</PaginationItem>
        </PaginationContent>
      </Pagination>}
    </div>
  </div>;
}

function ProfileCell({ user: u }: { user: DirectoryRow }) {
  // Organizers (including invited ones) are not listed here, so the participant completeness rule applies.
  const status = profileStatus({ isComplete: u.is_complete, isOrganizer: false, invited: false });
  return <span className={u.is_complete ? "text-foreground" : "text-muted-foreground"}>{status.label}</span>;
}
