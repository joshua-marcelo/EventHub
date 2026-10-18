import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import { eventLookups } from "@/lib/mvp/queries";
import { getEventReport } from "@/lib/report-queries";
import { getAppOrigin } from "@/lib/app-origin";
import { registrationUrl, registrationQr } from "@/lib/qr";
import { publishReadiness } from "@/lib/mvp/publish-readiness";
import { formatDateTime } from "@/lib/datetime";
import { EventBanner } from "@/components/mvp/event-banner";
import { SharePanel } from "@/components/mvp/share-panel";
import { StatStrip, WorkspaceSection } from "@/components/organizer/workspace-ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { canUseOrganizerTools } from "@/lib/navigation";
export const metadata = { title: "Event overview" };
export default function Page({ params }: PageProps<"/organizer/events/[eventId]">) { return <Suspense fallback={<PageSkeleton />}><Content params={params} /></Suspense>; }

async function Content({ params }: Pick<PageProps<"/organizer/events/[eventId]">,"params">) {
  const { eventId } = await params;
  const [{ event: e, user, report: r }, lookups, origin] = await Promise.all([getEventReport(eventId), eventLookups(), getAppOrigin()]);
  const url = registrationUrl(origin, e.id); const qr = e.status === "published" ? await registrationQr(url) : null;
  const readiness = e.status === "draft" && canUseOrganizerTools(user) ? publishReadiness(e, lookups.categories, lookups.colleges) : [];
  const details: [string, string][] = [
    ["Starts", e.starts_at ? formatDateTime(e.starts_at) : "Not set"],
    ["Ends", e.ends_at ? formatDateTime(e.ends_at) : "Not set"],
    ["Venue", e.venue ?? "Not set"],
    ["Category", lookups.categories.find(c => c.id === e.category_id)?.name ?? "Not set"],
    ["Host college", lookups.colleges.find(c => c.id === e.host_college_id)?.name ?? "University-wide"],
    ["Registration", e.registration_opens_at && e.registration_closes_at ? `${formatDateTime(e.registration_opens_at)} – ${formatDateTime(e.registration_closes_at)}` : "Not set"],
    ["Approval", e.approval_mode === "manual" ? "Organizer approval" : "Automatic"],
    ["Visibility", e.visibility === "unlisted" ? "Unlisted" : "Public"],
  ];

  return <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
    <div className="min-w-0 space-y-8">
      {e.status === "cancelled" && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Cancelled{e.cancelled_by !== e.organizer_id ? " by an administrator" : ""}: {e.cancellation_reason}</p>}
      <StatStrip items={[
        { label: "Registered", value: r.registered, hint: "Approved and pending" },
        { label: "Capacity", value: e.capacity ?? "Unlimited", hint: e.capacity ? `${Math.max(0, e.capacity - r.approved)} places left` : undefined },
        { label: "Attended", value: r.attended, hint: r.approved ? `${r.attendance_rate}% of approved` : undefined },
        { label: "Certificates", value: r.certificates_issued, hint: e.certificates_enabled ? "Enabled" : "Not enabled" },
      ]} />
      {readiness.length > 0 && <WorkspaceSection title="Ready to publish" description="Publishing opens the event to participants. These are checked again when you publish.">
        <ul className="grid gap-x-6 gap-y-2 rounded-lg border px-4 py-3 text-sm sm:grid-cols-2">{readiness.map(i => <li key={i.label} className="flex items-center gap-2">{i.done ? <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600" aria-hidden="true" /> : <CircleIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}<span className={i.done ? "" : "text-muted-foreground"}>{i.label}<span className="sr-only">{i.done ? ": complete" : ": missing"}</span></span></li>)}</ul>
        {readiness.some(i => !i.done) && <p className="text-sm text-muted-foreground">Add the missing details in <Link href={`/organizer/events/${e.id}/settings`} className="font-medium text-foreground underline underline-offset-4">Settings</Link>.</p>}
      </WorkspaceSection>}
      <WorkspaceSection title="Description"><p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{e.description || "No description yet."}</p></WorkspaceSection>
      {qr && <WorkspaceSection title="Share registration" description="Participants can scan the QR code or open the link to register."><SharePanel url={url} qr={qr} inviteCode={e.invite_code} /></WorkspaceSection>}
    </div>
    <aside className="space-y-4">
      <EventBanner path={e.banner_path} sizes="320px" className={e.banner_path ? undefined : "aspect-auto h-24"} />
      {!e.banner_path && e.status !== "cancelled" && e.status !== "completed" && <p className="-mt-2 text-xs text-muted-foreground">No banner. <Link href={`/organizer/events/${e.id}/settings`} className="font-medium text-foreground underline underline-offset-4">Add one in Settings</Link>.</p>}
      <dl className="divide-y rounded-lg border text-sm">{details.map(([k, v]) => <div key={k} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 px-4 py-2.5"><dt className="text-muted-foreground">{k}</dt><dd className="break-words">{v}</dd></div>)}</dl>
    </aside>
  </div>;
}
