import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/mvp";
import { getEventLifecycle } from "@/lib/event-lifecycle-queries";
import { registrationAction } from "@/lib/mvp/actions";
import { ActionControl } from "@/components/mvp/action-control";
import { ScanAttendanceDialog } from "@/components/mvp/scan-attendance-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { EventBanner } from "@/components/mvp/event-banner";
import { formatDateTime, formatEventSchedule } from "@/lib/datetime";
import { CalendarDaysIcon, MapPinIcon, UsersIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { attendanceLabel, registrationLabel } from "@/lib/participant/labels";
export async function generateMetadata({ params }: PageProps<"/events/[eventId]">): Promise<Metadata> {
  const { eventId } = await params;
  const { data } = idSchema.safeParse(eventId).success ? await (await createClient()).rpc("get_public_event_preview",{p_event_id:eventId}) : {data:null};
  const e = data?.[0];
  return { title:e?.title ?? "Event", description:e?.description?.slice(0,160) ?? "Open this event in EventHub.",robots:{index:false,follow:false},openGraph:{title:e?.title ?? "EventHub",description:e?.description?.slice(0,160) ?? "Open this event in EventHub."} };
}
export default function Page({ params }: PageProps<"/events/[eventId]">) { return <Suspense fallback={<PageSkeleton />}><Content params={params} /></Suspense>; }
async function Content({ params }: Pick<PageProps<"/events/[eventId]">,"params">) {
  const { eventId } = await params; const valid = idSchema.safeParse(eventId).success;
  const user = await getCurrentUser(); const client = await createClient(); const next = `/events/${eventId}`;
  if (!user) {
    const {data,error} = valid ? await client.rpc("get_public_event_preview",{p_event_id:eventId}) : {data:null,error:null};
    if (error) throw new Error("Could not load event preview."); const e = data?.[0];
    return <div className="max-w-2xl space-y-6"><PageHeader title={e?.title ?? "Log in to view this event"} />{e && <><EventBanner path={e.banner_path} /><p className="whitespace-pre-wrap">{e.description}</p><p>{e.starts_at && formatDateTime(e.starts_at)} · {e.venue}</p><p>{e.category_name} · {e.host_college_name ?? "University-wide"} · {e.organization_name}</p>{e.status_label !== "published" && <p className="capitalize">Event {e.status_label} — registration is closed.</p>}</>}<Link className="inline-flex rounded border px-4 py-2" href={`/login?next=${encodeURIComponent(next)}`}>{e?.status_label === "published" ? "Register — log in" : "Log in"}</Link></div>;
  }
  const {data:e,error} = valid ? await client.from("events").select("*").eq("id",eventId).maybeSingle() : {data:null,error:null};
  if (error) throw new Error("Could not load event."); if (!e || e.status === "draft" && e.organizer_id !== user.id && !user.isAdmin) return <PageHeader title="This event isn’t available" />;
  const [{data:r,error:registrationError},{data:a}] = await Promise.all([
    client.from("event_registrations").select("id,status,decision_reason").eq("event_id",e.id).eq("user_id",user.id).maybeSingle(),
    client.from("attendance_records").select("status").eq("event_id",e.id).eq("user_id",user.id).maybeSingle(),
  ]);
  if (registrationError) throw new Error("Could not load registration.");
  const lifecycle = await getEventLifecycle(e.id);
  const now = new Date().getTime();
  const active = r && r.status !== "cancelled" ? r : null;
  const canCancel = e.status === "published" && !!e.starts_at && now < Date.parse(e.starts_at) && !!active && ["pending","approved"].includes(active.status);
  // Why registration is unavailable, in the same order register_for_event checks it (the database stays the authority).
  const unavailable = e.organizer_id === user.id ? null
    : e.status === "draft" ? "This is a draft preview. The organizer must publish the event and open registration."
    : e.status === "cancelled" ? "This event was cancelled."
    : e.status === "completed" ? "This event has ended."
    : !lifecycle ? "Registration is unavailable. Refresh and try again."
    : !lifecycle.registration_enabled || lifecycle.attendance_started ? "Registration is closed."
    : !e.registration_opens_at || now < Date.parse(e.registration_opens_at) ? (e.registration_opens_at ? `Registration opens ${formatDateTime(e.registration_opens_at)}.` : "Registration is not open yet.")
    : !e.registration_closes_at || now >= Date.parse(e.registration_closes_at) ? "Registration is closed."
    : null;
  return <div className="mx-auto max-w-2xl space-y-6">
    <article className="overflow-hidden rounded-lg border bg-card">
      {e.banner_path && <EventBanner path={e.banner_path} sizes="(min-width: 768px) 672px, 100vw" className="rounded-none border-0 border-b" />}
      <div className="space-y-4 p-5 sm:p-6">
        <div className="space-y-1">
          <h1 className="break-words text-2xl font-semibold tracking-tight">{e.title}</h1>
          {e.status === "draft" && <p className="text-sm text-muted-foreground">Draft preview, not open for registration.</p>}
        </div>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li className="flex gap-2"><CalendarDaysIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{e.starts_at ? formatEventSchedule(e.starts_at, e.ends_at) : "Schedule to be announced"}</li>
          <li className="flex gap-2 break-words"><MapPinIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{e.venue ?? "Venue to be announced"}</li>
          {e.capacity && <li className="flex gap-2"><UsersIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Capacity {e.capacity}</li>}
        </ul>
        {e.description && <p className="whitespace-pre-wrap break-words text-sm leading-6">{e.description}</p>}
        {e.status === "cancelled" && e.cancellation_reason && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Cancelled{e.cancelled_by !== e.organizer_id ? " by an administrator" : ""}: {e.cancellation_reason}</p>}
      </div>
      <section aria-label="Registration" className="space-y-3 border-t bg-slate-50/60 p-5 sm:p-6">
        {e.organizer_id === user.id ? <Link className={buttonVariants({ variant: "outline" })} href={`/organizer/events/${e.id}`}>Manage this event</Link>
        : active ? <>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Registration</dt><dd className="font-semibold">{registrationLabel[active.status]}</dd></div>
            <div><dt className="text-muted-foreground">Attendance</dt><dd className="font-semibold">{attendanceLabel(a?.status ?? null)}</dd></div>
          </dl>
          {e.status === "published" && lifecycle && !lifecycle.attendance_kind && <p className="text-sm text-muted-foreground">Attendance hasn&apos;t started yet.</p>}
          {active.decision_reason && <p className="break-words text-sm text-muted-foreground">{active.decision_reason}</p>}
          <div className="flex flex-wrap items-start gap-2">
            {lifecycle?.can_scan_attendance && <ScanAttendanceDialog expected={e.id} className={buttonVariants()}>Scan Attendance</ScanAttendanceDialog>}
            {canCancel && <ActionControl label="Cancel registration" runAction={registrationAction.bind(null,e.id,"cancel")} confirmation={{ title: "Cancel registration?", subject: e.title, description: "You will give up your place at this event.", tone: "destructive" }} />}
          </div>
        </>
        : unavailable ? <><Button disabled>Register</Button><p className="text-sm text-muted-foreground">{unavailable}</p></>
        : !user.isComplete ? <><Link className={buttonVariants()} href={`/onboarding?next=${encodeURIComponent(next)}`}>Complete your profile to register</Link><p className="text-sm text-muted-foreground">Registration uses your student profile, so it is needed once.</p></>
        : <><ActionControl label="Register" variant="default" runAction={registrationAction.bind(null,e.id,"register")} /><p className="text-sm text-muted-foreground">{e.approval_mode === "manual" ? "The organizer approves registrations." : "Registration is approved immediately."} Your student profile is used; nothing else to fill in.</p></>}
      </section>
    </article>
  </div>;
}
