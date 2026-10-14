import { Suspense } from "react";
import Link from "next/link";
import { SearchIcon, UserSearchIcon } from "lucide-react";

import { Initials, PanelEmpty, fullName } from "@/components/admin/admin-ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Participants" };

export default function Page({ searchParams }: PageProps<"/admin/users">) {
  return <div className="space-y-6">
    <PageHeader title="Participants" description="Every EventHub account is a participant; organizer and admin access are added on top. Search by name, email or student ID." />
    <Suspense fallback={<PageSkeleton />}><Content searchParams={searchParams} /></Suspense>
  </div>;
}

// Keep only characters that appear in names, emails and student IDs; this also keeps
// PostgREST filter syntax (commas, parentheses, wildcards) out of the query.
function searchTerm(value: string | string[] | undefined) { return (typeof value === "string" ? value : "").replace(/[^\p{L}\p{N}@._\- ]/gu, "").trim().slice(0, 80); }

type Row = { id: string; first_name: string | null; last_name: string | null; email: string; student_id: string | null; is_admin: boolean; is_complete: boolean | null; organizer_status: string; identity_flagged_at: string | null };

async function Content({ searchParams }: Pick<PageProps<"/admin/users">, "searchParams">) {
  await requireAdmin();
  const q = searchTerm((await searchParams).q);
  let rows: Row[] = [];
  if (q.length >= 2) {
    const { data, error } = await (await createClient()).from("profiles").select("id,first_name,last_name,email,student_id,is_admin,is_complete,organizer_status,identity_flagged_at").or(["first_name", "last_name", "email", "student_id"].map(c => `${c}.ilike.%${q}%`).join(",")).order("last_name").limit(50);
    if (error) throw new Error("Could not search participants.");
    rows = data;
  }

  return <div className="space-y-4">
    <form role="search" className="flex max-w-xl gap-2">
      <div className="relative min-w-0 flex-1">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input name="q" defaultValue={q} aria-label="Search participants" placeholder="Name, email or student ID" minLength={2} maxLength={80} className="h-9 pl-8" />
      </div>
      <Button type="submit" className="h-9">Search</Button>
    </form>

    {q.length < 2
      ? <div className="rounded-lg border border-dashed bg-card"><PanelEmpty icon={UserSearchIcon} title="Search for a participant" description="Enter at least 2 characters of a name, email or student ID." /></div>
      : <>
        <p className="text-sm text-muted-foreground" role="status">{rows.length === 50 ? "Showing the first 50 matches. Refine the search to narrow them down." : `${rows.length} ${rows.length === 1 ? "match" : "matches"} for “${q}”`}</p>
        <DataTable caption={`Participants matching ${q}`} rowKey={u => u.id} rows={rows} empty={<PanelEmpty icon={UserSearchIcon} title="No matching participants" description="Check the spelling or search by email or student ID." />} columns={[
          { key: "name", label: "Participant", render: u => <div className="flex items-center gap-3">
            <Initials name={fullName(u)} />
            <div className="min-w-0">
              <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">{fullName(u)}</Link>
              <p className="break-all text-xs text-muted-foreground md:hidden">{u.email}</p>
            </div>
          </div> },
          { key: "email", label: "Email", className: "hidden md:table-cell", render: u => <span className="break-all text-muted-foreground">{u.email}</span> },
          { key: "student", label: "Student ID", className: "hidden lg:table-cell", render: u => u.student_id ?? <span className="text-muted-foreground">Not set</span> },
          { key: "roles", label: "Access", render: u => <RoleBadges user={u} /> },
          { key: "profile", label: "Profile", className: "hidden sm:table-cell", render: u => <span className={u.is_complete ? "text-foreground" : "text-muted-foreground"}>{u.is_complete ? "Complete" : "Incomplete"}</span> },
        ]} />
      </>}
  </div>;
}

function RoleBadges({ user: u }: { user: Row }) {
  return <div className="flex flex-wrap gap-1">
    <Badge variant="outline" className="text-muted-foreground">Participant</Badge>
    {u.organizer_status !== "none" && <Badge variant="outline" className={u.organizer_status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}>Organizer{u.organizer_status === "active" ? "" : ` · ${u.organizer_status}`}</Badge>}
    {u.is_admin && <Badge variant="outline" className="border-slate-300 bg-slate-900 text-white">Admin</Badge>}
    {u.identity_flagged_at && <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">Identity flagged</Badge>}
  </div>;
}
