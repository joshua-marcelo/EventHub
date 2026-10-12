import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export const metadata = { title: "Users" };
export default function Page({ searchParams }: PageProps<"/admin/users">) { return <Suspense fallback={<PageSkeleton />}><Content searchParams={searchParams} /></Suspense>; }
// Keep only characters that appear in names, emails and student IDs; this also keeps
// PostgREST filter syntax (commas, parentheses, wildcards) out of the query.
function searchTerm(value: string | string[] | undefined) { return (typeof value === "string" ? value : "").replace(/[^\p{L}\p{N}@._\- ]/gu, "").trim().slice(0, 80); }
async function Content({ searchParams }: Pick<PageProps<"/admin/users">, "searchParams">) {
  await requireAdmin();
  const q = searchTerm((await searchParams).q);
  let rows: { id: string; first_name: string | null; last_name: string | null; email: string; student_id: string | null; is_admin: boolean; organizer_status: string; identity_flagged_at: string | null }[] = [];
  if (q.length >= 2) {
    const { data, error } = await (await createClient()).from("profiles").select("id,first_name,last_name,email,student_id,is_admin,organizer_status,identity_flagged_at").or(["first_name","last_name","email","student_id"].map(c => `${c}.ilike.%${q}%`).join(",")).order("last_name").limit(50);
    if (error) throw new Error("Could not search users.");
    rows = data;
  }
  return <div className="space-y-6"><PageHeader title="Users" description="Search accounts by name, email or student ID." />
    <form role="search" className="flex max-w-xl gap-2"><Input name="q" defaultValue={q} aria-label="Search users" placeholder="Name, email or student ID" minLength={2} maxLength={80} /><Button type="submit">Search</Button></form>
    {q.length < 2 ? <p className="text-sm text-muted-foreground">Enter at least 2 characters.</p> : rows.length ? <ul className="space-y-3">{rows.map(u => <li key={u.id} className="rounded border p-4"><Link href={`/admin/users/${u.id}`} className="font-medium underline">{[u.first_name, u.last_name].filter(Boolean).join(" ") || "Name not set"}</Link><p className="break-all text-sm">{u.email}{u.student_id ? ` · ${u.student_id}` : ""}</p><p className="text-sm text-muted-foreground">{[u.is_admin && "Admin", u.organizer_status !== "none" && `Organizer: ${u.organizer_status}`, u.identity_flagged_at && "Identity flagged"].filter(Boolean).join(" · ") || "Participant"}</p></li>)}</ul> : <EmptyState title="No matching users" description="Check the spelling or search by email or student ID." />}
  </div>;
}
