import Link from "next/link";
import { CalendarDaysIcon, CheckCircle2Icon, TicketIcon } from "lucide-react";
import { EventEntryActions } from "@/components/participant/event-entry-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/datetime";
import { attendanceLabel, registrationLabel } from "@/lib/participant/labels";
import type { ParticipantDashboardData } from "@/lib/participant/dashboard";

const positive = "border-emerald-200 bg-emerald-50 text-emerald-800";
const warning = "border-amber-200 bg-amber-50 text-amber-900";
const neutral = "border-border bg-muted text-muted-foreground";
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function ParticipantDashboard({ firstName, data }: { firstName: string; data: ParticipantDashboardData }) {
  return <div className="space-y-6">
    <PageHeader title={`Welcome back, ${firstName}!`} description="Discover events and keep track of your participation." action={<EventEntryActions prominent />} />

    <dl aria-label="Participation summary" className="grid grid-cols-2 gap-3">
      {[{ label: "Registered Events", value: data.registeredCount, icon: TicketIcon }, { label: "Events Attended", value: data.attendedCount, icon: CheckCircle2Icon }].map(({ label, value, icon: Icon }) => <div key={label} className="flex items-stretch justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="flex min-w-0 flex-col justify-between"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd></div>
        <Icon className="hidden size-5 shrink-0 self-center text-orange-800 sm:block" aria-hidden="true" />
      </div>)}
    </dl>

    <section aria-labelledby="my-registrations" className="min-w-0 space-y-3">
      <h2 id="my-registrations" className="text-base font-semibold">My Registered Events</h2>
      {data.registrations.length ? <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.registrations.map(r => <li key={r.id} className="min-w-0">
        <Link href={`/events/${r.eventId}`} className={`block h-full space-y-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40 ${focus}`}>
          <h3 className="break-words font-semibold leading-snug">{r.title}</h3>
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground"><CalendarDaysIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{r.startsAt ? <time dateTime={r.startsAt}>{formatDateTime(r.startsAt)}</time> : "Date to be announced"}</p>
          <dl className="space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2"><dt className="text-muted-foreground">Registration</dt><dd><Badge variant="outline" className={r.status === "approved" ? positive : ["pending", "rejected"].includes(r.status) ? warning : neutral}>{registrationLabel[r.status]}</Badge></dd></div>
            <div className="flex flex-wrap items-center justify-between gap-2"><dt className="text-muted-foreground">Attendance</dt><dd><Badge variant="outline" className={r.attendance === "present" ? positive : r.attendance === "revoked" ? warning : neutral}>{attendanceLabel(r.attendance)}</Badge></dd></div>
          </dl>
        </Link>
      </li>)}</ul> : <div className="space-y-1 rounded-lg border bg-card px-4 py-6 text-center"><p className="text-sm font-medium">No registered events yet.</p><p className="text-sm text-muted-foreground">Explore upcoming events or join with an invite code.</p></div>}
    </section>
  </div>;
}
