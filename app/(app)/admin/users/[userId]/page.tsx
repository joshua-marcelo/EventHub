import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { formatDateTime } from "@/lib/datetime";
export const metadata = { title: "User details" };
export default function Page({ params }: PageProps<"/admin/users/[userId]">) { return <Suspense fallback={<PageSkeleton />}><Content params={params} /></Suspense>; }
async function Content({ params }: Pick<PageProps<"/admin/users/[userId]">, "params">) {
  await requireAdmin();
  const { userId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) notFound();
  const { data: u, error } = await (await createClient()).from("profiles").select("first_name,middle_name,last_name,suffix,email,student_id,year_level,is_admin,is_complete,organizer_status,organizer_status_reason,identity_flagged_at,identity_flag_reason,created_at,colleges(name),programs(name)").eq("id", userId).maybeSingle();
  if (error) throw new Error("Could not load this user.");
  if (!u) notFound();
  const name = [u.first_name, u.middle_name, u.last_name, u.suffix].filter(Boolean).join(" ") || "Name not set";
  const facts: [string, string][] = [
    ["Email", u.email], ["Student ID", u.student_id ?? "Not set"], ["College", u.colleges?.name ?? "Not set"], ["Program", u.programs?.name ?? "Not set"],
    ["Year level", u.year_level ? String(u.year_level) : "Not set"], ["Profile", u.is_complete ? "Complete" : "Incomplete"],
    ["Roles", [u.is_admin && "Admin", u.organizer_status !== "none" && `Organizer (${u.organizer_status})`].filter(Boolean).join(", ") || "Participant"],
    ["Joined", formatDateTime(u.created_at)],
  ];
  return <div className="space-y-6"><PageHeader title={name} description="Read-only account summary." />
    <dl className="grid gap-3 rounded border p-4 sm:grid-cols-2">{facts.map(([k, v]) => <div key={k}><dt className="text-sm text-muted-foreground">{k}</dt><dd className="break-all">{v}</dd></div>)}</dl>
    {u.organizer_status_reason && <p><span className="font-medium">Organizer status note:</span> {u.organizer_status_reason}</p>}
    {u.identity_flagged_at && <p role="status" className="rounded border border-destructive/40 p-4">Identity flagged {formatDateTime(u.identity_flagged_at)}{u.identity_flag_reason ? `: ${u.identity_flag_reason}` : ""}</p>}
    <Link href="/admin/users" className="text-sm underline">Back to users</Link>
  </div>;
}
