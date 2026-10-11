import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/mvp";
import { registrationAction } from "@/lib/mvp/actions";
import { ActionControl } from "@/components/mvp/action-control";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { formatDateTime } from "@/lib/datetime";
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
    return <div className="max-w-2xl space-y-6"><PageHeader title={e?.title ?? "Log in to view this event"} />{e && <><p className="whitespace-pre-wrap">{e.description}</p><p>{e.starts_at && formatDateTime(e.starts_at)} · {e.venue}</p><p>{e.category_name} · {e.host_college_name ?? "University-wide"} · {e.organization_name}</p>{e.status_label !== "published" && <p className="capitalize">Event {e.status_label} — registration is closed.</p>}</>}<Link className="inline-flex rounded border px-4 py-2" href={`/login?next=${encodeURIComponent(next)}`}>{e?.status_label === "published" ? "Register — log in" : "Log in"}</Link></div>;
  }
  const {data:e,error} = valid ? await client.from("events").select("*").eq("id",eventId).maybeSingle() : {data:null,error:null};
  if (error) throw new Error("Could not load event."); if (!e || e.status === "draft" && e.organizer_id !== user.id && !user.isAdmin) return <PageHeader title="This event isn’t available" />;
  const {data:r,error:registrationError} = await client.from("event_registrations").select("status,decision_reason").eq("event_id",e.id).eq("user_id",user.id).maybeSingle();
  if (registrationError) throw new Error("Could not load registration.");
  const now = new Date().getTime(); const open = e.status === "published" && !!e.registration_opens_at && !!e.registration_closes_at && now >= Date.parse(e.registration_opens_at) && now < Date.parse(e.registration_closes_at);
  const canCancel = e.status === "published" && !!e.starts_at && now < Date.parse(e.starts_at) && !!r && ["pending","approved"].includes(r.status);
  return <div className="max-w-2xl space-y-6"><PageHeader title={e.title} description={e.status === "draft" ? "Draft preview — not open for registration" : undefined} /><p className="whitespace-pre-wrap">{e.description}</p><p>{e.starts_at && formatDateTime(e.starts_at)}{e.ends_at && ` – ${formatDateTime(e.ends_at)}`}</p><p>{e.venue}</p><p>Capacity: {e.capacity ?? "unlimited"} · {e.approval_mode === "manual" ? "Organizer approval required" : "Automatic registration"}</p>{e.registration_opens_at && <p>Registration opens: {formatDateTime(e.registration_opens_at)}</p>}{e.registration_closes_at && <p>Registration deadline: {formatDateTime(e.registration_closes_at)}</p>}
    {e.status === "cancelled" && <p>Cancelled{e.cancelled_by !== e.organizer_id ? " by an administrator" : ""}: {e.cancellation_reason}</p>}{e.status === "completed" && <p>This event has ended.</p>}
    <p>Attendance: {e.attendance_policy === "time_in_and_out" ? "Time-in and time-out required" : "Time-in required"}. Certificates {e.certificates_enabled ? "available for eligible attendees after completion" : "not enabled"}.</p>
    {r && <p>Registration: <strong>{r.status}</strong>{r.decision_reason && ` — ${r.decision_reason}`}</p>}
    {r?.status === "approved" && e.status === "published" && <Link className="block underline" href={`/scan?event=${e.id}`}>Scan attendance at the venue</Link>}
    {e.organizer_id === user.id ? <Link className="underline" href={`/organizer/events/${e.id}`}>Open organizer workspace</Link> : open && (!r || r.status === "cancelled") ? user.isComplete ? <ActionControl label="Register for event" runAction={registrationAction.bind(null,e.id,"register")} /> : <Link className="underline" href={`/onboarding?next=${encodeURIComponent(next)}`}>Complete profile to register</Link> : e.status === "published" && (!r || r.status === "cancelled") ? <p>Registration is not currently open.</p> : null}
    {canCancel && <ActionControl label="Cancel registration" runAction={registrationAction.bind(null,e.id,"cancel")} confirm />}
  </div>;
}
