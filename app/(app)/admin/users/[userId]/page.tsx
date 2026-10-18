import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, TriangleAlertIcon } from "lucide-react";

import { Panel } from "@/components/admin/admin-ui";
import { OrganizerStatusButtons } from "@/components/admin/organizer-status-actions";
import { PageSkeleton } from "@/components/page-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { profileStatus } from "@/lib/admin/participants";
import { requireAdmin } from "@/lib/auth/dal";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "User details" };

type Fact = [label: string, value: string, muted?: boolean];

export default function Page({ params, searchParams }: PageProps<"/admin/users/[userId]">) { return <Suspense fallback={<PageSkeleton />}><Content params={params} searchParams={searchParams} /></Suspense>; }

async function Content({ params, searchParams }: Pick<PageProps<"/admin/users/[userId]">, "params" | "searchParams">) {
  const admin = await requireAdmin();
  const { userId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) notFound();
  const client = await createClient();
  const [{ data: u, error }, invitation] = await Promise.all([
    client.from("profiles").select("first_name,middle_name,last_name,suffix,email,student_id,year_level,is_admin,is_complete,organizer_status,organizer_status_reason,organizer_since,identity_flagged_at,identity_flag_reason,created_at,colleges(name),programs(name)").eq("id", userId).maybeSingle(),
    client.from("organizer_invitations").select("id").eq("user_id", userId).eq("state", "accepted").limit(1),
  ]);
  if (error) throw new Error("Could not load this user.");
  if (!u) notFound();
  // Before the invitation migration is applied nobody can have been invited, so a missing table means "not invited".
  if (invitation.error && !["PGRST205", "42P01"].includes(invitation.error.code)) throw new Error("Could not load this user.");
  const fromOrganizers = (await searchParams).from === "organizers";
  const back = fromOrganizers ? { href: "/admin/organizers", label: "Organizers" } : { href: "/admin/users", label: "Participants" };

  const name = [u.first_name, u.middle_name, u.last_name, u.suffix].filter(Boolean).join(" ") || "Name not set";
  const isOrganizer = u.organizer_status !== "none";
  // Directly invited organizers get organizer access without student onboarding, so missing student
  // details are expected rather than a problem. Everyone else keeps the participant completeness rule.
  const profile = profileStatus({ isComplete: u.is_complete, isOrganizer, invited: Boolean(invitation.data?.length) });
  const studentOptional = profile.optional;
  const missing = studentOptional ? "Not provided" : "Not set";
  const account: Fact[] = [["Email", u.email], ["Joined", formatDateTime(u.created_at)], ["Student profile", profile.label, studentOptional]];
  const student: Fact[] = [["Student ID", u.student_id ?? missing, !u.student_id], ["College", u.colleges?.name ?? missing, !u.colleges], ["Program", u.programs?.name ?? missing, !u.programs], ["Year level", u.year_level ? String(u.year_level) : missing, !u.year_level]];

  return <div className="space-y-6">
    <Link href={back.href} className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><ArrowLeftIcon className="size-4" aria-hidden="true" />{back.label}</Link>
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-muted-foreground">Participant</Badge>
        {isOrganizer && <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">Organizer <StatusBadge status={u.organizer_status} /></span>}
        {u.is_admin && <Badge variant="outline" className="border-slate-300 bg-slate-900 text-white">Admin</Badge>}
      </div>
      <p className="text-sm text-muted-foreground">Account summary{isOrganizer ? " and organizer access" : ""}. Profile details are read-only.</p>
    </div>

    {u.identity_flagged_at && <div role="status" className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      <p>Identity flagged {formatDateTime(u.identity_flagged_at)}{u.identity_flag_reason ? `: ${u.identity_flag_reason}` : ""}</p>
    </div>}

    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,13fr)_minmax(0,7fr)]">
      <div className="space-y-6">
        <Panel title="Account"><Facts facts={account} /></Panel>
        <Panel title="Student profile" description={studentOptional ? "Optional for invited organizers." : undefined}><Facts facts={student} /></Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Roles">
          <dl className="divide-y text-sm">
            <Role label="Participant" value="Every account" />
            <Role label="Organizer" value={isOrganizer ? <StatusBadge status={u.organizer_status} /> : "No access"} />
            <Role label="Admin" value={u.is_admin ? "Yes" : "No"} />
          </dl>
        </Panel>

        {isOrganizer && <Panel title="Organizer access">
          <dl className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Fact label="Status" value={<StatusBadge status={u.organizer_status} />} />
            <Fact label="Organizer since" value={u.organizer_since ? formatDate(u.organizer_since) : "Not recorded"} muted={!u.organizer_since} />
            <div className="min-w-0 sm:col-span-2 lg:col-span-1 xl:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status note</dt>
              <dd className={u.organizer_status_reason ? "mt-1 whitespace-pre-wrap break-words text-sm" : "mt-1 text-sm text-muted-foreground"}>{u.organizer_status_reason || "No note"}</dd>
            </div>
          </dl>
          <div className="border-t p-4"><OrganizerStatusButtons id={userId} name={name} status={u.organizer_status} currentAdminId={admin.id} /></div>
        </Panel>}
      </div>
    </div>
  </div>;
}

function Facts({ facts }: { facts: Fact[] }) {
  return <dl className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2">{facts.map(([k, v, muted]) => <Fact key={k} label={k} value={v} muted={muted} />)}</dl>;
}

function Fact({ label, value, muted = false }: { label: string; value: ReactNode; muted?: boolean }) {
  return <div className="min-w-0"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt><dd className={muted ? "mt-1 break-words text-sm text-muted-foreground" : "mt-1 break-words text-sm"}>{value}</dd></div>;
}

function Role({ label, value }: { label: string; value: ReactNode }) {
  return <div className="flex items-center justify-between gap-3 px-4 py-2.5"><dt className="font-medium">{label}</dt><dd className="text-muted-foreground">{value}</dd></div>;
}
