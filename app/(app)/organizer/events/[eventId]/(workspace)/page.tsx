import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2Icon, CircleIcon, ClipboardCheckIcon, PencilIcon, UsersIcon } from "lucide-react";
import { eventLookups } from "@/lib/mvp/queries";
import { getEventReport } from "@/lib/report-queries";
import { publishReadiness } from "@/lib/mvp/publish-readiness";
import { EventBanner } from "@/components/mvp/event-banner";
import { InviteCodeDialog } from "@/components/mvp/invite-code-dialog";
import { EventLifecycleControls } from "@/components/mvp/event-lifecycle-controls";
import { getEventLifecycle } from "@/lib/event-lifecycle-queries";
import { buttonVariants } from "@/components/ui/button";
import { PageSkeleton } from "@/components/page-skeleton";
import { canUseOrganizerTools } from "@/lib/navigation";
export const metadata = { title: "Event overview" };
export default function Page({ params }: PageProps<"/organizer/events/[eventId]">) { return <Suspense fallback={<PageSkeleton />}><Content params={params} /></Suspense>; }

/** Compact event home: banner, real counts and the four actions. Name, status, date and venue are in the shared header. */
async function Content({ params }: Pick<PageProps<"/organizer/events/[eventId]">,"params">) {
  const { eventId } = await params;
  const [{ event: e, user, report: r }, lookups, lifecycle] = await Promise.all([getEventReport(eventId), eventLookups(), getEventLifecycle(eventId)]);
  const canEdit = canUseOrganizerTools(user) && ["draft", "published"].includes(e.status);
  const readiness = e.status === "draft" && canUseOrganizerTools(user) ? publishReadiness(e, lookups.categories, lookups.colleges) : [];
  const stats = [
    { label: "Registered", value: r.registered, hint: e.capacity ? `of ${e.capacity} places` : "Approved and pending" },
    { label: "Attended", value: r.attended, hint: r.approved ? `${r.attendance_rate}% of approved` : "Recorded by QR or manually" },
  ];

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
    <div className="min-w-0 space-y-6">
      {e.status === "cancelled" && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Cancelled{e.cancelled_by !== e.organizer_id ? " by an administrator" : ""}: {e.cancellation_reason}</p>}
      <dl className="grid grid-cols-2 divide-x rounded-lg border">{stats.map(s => <div key={s.label} className="px-4 py-3">
        <dt className="text-sm text-muted-foreground">{s.label}</dt><dd className="text-2xl font-semibold tabular-nums">{s.value}</dd><dd className="text-xs text-muted-foreground">{s.hint}</dd>
      </div>)}</dl>
      <div className="flex flex-wrap gap-2">
        {canEdit && <Link href={`/organizer/events/${e.id}/settings`} className={buttonVariants({ variant: "outline" })}><PencilIcon aria-hidden="true" />Edit Event</Link>}
        {e.status === "published" && <InviteCodeDialog code={e.invite_code} />}
        <Link href={`/organizer/events/${e.id}/registrations`} className={buttonVariants({ variant: "outline" })}><UsersIcon aria-hidden="true" />View Registrations</Link>
        <Link href={`/organizer/events/${e.id}/attendance`} className={buttonVariants({ variant: e.status === "published" ? "default" : "outline" })}><ClipboardCheckIcon aria-hidden="true" />View Attendance</Link>
      </div>
      {e.status === "published" && canUseOrganizerTools(user) && <EventLifecycleControls id={e.id} title={e.title} state={lifecycle} />}
      {readiness.length > 0 && <section aria-labelledby="ready-to-publish" className="space-y-3 rounded-lg border p-4">
        <h2 id="ready-to-publish" className="text-sm font-semibold">Ready to publish</h2>
        <ul className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">{readiness.map(i => <li key={i.label} className="flex items-center gap-2">{i.done ? <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600" aria-hidden="true" /> : <CircleIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}<span className={i.done ? "" : "text-muted-foreground"}>{i.label}<span className="sr-only">{i.done ? ": complete" : ": missing"}</span></span></li>)}</ul>
        {readiness.some(i => !i.done) && <p className="text-sm text-muted-foreground">Complete the missing details with <Link href={`/organizer/events/${e.id}/settings`} className="font-medium text-foreground underline underline-offset-4">Edit Event</Link>, then publish.</p>}
      </section>}
    </div>
    <EventBanner path={e.banner_path} sizes="288px" className={e.banner_path ? undefined : "aspect-auto h-24"} />
  </div>;
}
