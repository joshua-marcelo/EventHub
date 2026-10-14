import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, TriangleAlertIcon } from "lucide-react";

import { Panel } from "@/components/admin/admin-ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/dal";
import { formatDateTime } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Participant details" };

export default function Page({ params }: PageProps<"/admin/users/[userId]">) { return <Suspense fallback={<PageSkeleton />}><Content params={params} /></Suspense>; }

async function Content({ params }: Pick<PageProps<"/admin/users/[userId]">, "params">) {
  await requireAdmin();
  const { userId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) notFound();
  const { data: u, error } = await (await createClient()).from("profiles").select("first_name,middle_name,last_name,suffix,email,student_id,year_level,is_admin,is_complete,organizer_status,organizer_status_reason,identity_flagged_at,identity_flag_reason,created_at,colleges(name),programs(name)").eq("id", userId).maybeSingle();
  if (error) throw new Error("Could not load this participant.");
  if (!u) notFound();
  const name = [u.first_name, u.middle_name, u.last_name, u.suffix].filter(Boolean).join(" ") || "Name not set";
  const sections: [string, [string, string][]][] = [
    ["Account", [["Email", u.email], ["Joined", formatDateTime(u.created_at)], ["Profile", u.is_complete ? "Complete" : "Incomplete"]]],
    ["Student profile", [["Student ID", u.student_id ?? "Not set"], ["College", u.colleges?.name ?? "Not set"], ["Program", u.programs?.name ?? "Not set"], ["Year level", u.year_level ? String(u.year_level) : "Not set"]]],
  ];

  return <div className="max-w-3xl space-y-6">
    <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" aria-hidden="true" />Participants</Link>
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-muted-foreground">Participant</Badge>
        {u.organizer_status !== "none" && <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">Organizer <StatusBadge status={u.organizer_status} /></span>}
        {u.is_admin && <Badge variant="outline" className="border-slate-300 bg-slate-900 text-white">Admin</Badge>}
      </div>
      <p className="text-sm text-muted-foreground">Read-only account summary.</p>
    </div>

    {u.identity_flagged_at && <div role="status" className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      <p>Identity flagged {formatDateTime(u.identity_flagged_at)}{u.identity_flag_reason ? `: ${u.identity_flag_reason}` : ""}</p>
    </div>}

    {sections.map(([title, facts]) => <Panel key={title} title={title}>
      <dl className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2">{facts.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k}</dt><dd className="mt-1 break-words text-sm">{v}</dd></div>)}</dl>
    </Panel>)}

    {u.organizer_status_reason && <Panel title="Organizer status note"><p className="whitespace-pre-wrap p-4 text-sm">{u.organizer_status_reason}</p></Panel>}
  </div>;
}
