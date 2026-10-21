"use client";
import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { SelectField } from "@/components/forms/select-field";
import { BannerField, type BannerChange } from "@/components/mvp/banner-field";
import { saveEvent, setEventBanner } from "@/lib/mvp/actions";
import { BANNER_BUCKET, bannerUrl, newBannerPath, type BannerType } from "@/lib/mvp/banner";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";
import { formatInManila } from "@/lib/datetime";
import { composeSchedule } from "@/lib/event-schedule";

type Choice = { id: number; name: string; is_active: boolean };
// Active entries, plus an event's current (possibly inactive) entry so it is not silently dropped.
const choices = (rows: Choice[], current?: number | null) =>
  rows.filter(c => c.is_active || c.id === current).map(c => ({ value: c.id, label: c.is_active ? c.name : `${c.name} (inactive)` }));
const manila = (value: string | null | undefined, pattern: string) => value ? formatInManila(value, pattern) : "";
// Server field names → the inputs that produce them.
const fieldFor: Record<string, string> = { starts_at: "start_date", ends_at: "end_time" };

/** Uploads to the event's own Storage folder (RLS: active owner only), then attaches it server-side. */
async function applyBanner(eventId: string, change: BannerChange): Promise<string | null> {
  if (change.kind === "none") return null;
  if (change.kind === "remove") { const r = await setEventBanner(eventId, null); return r.ok ? null : r.error; }
  const path = newBannerPath(eventId, change.file.type as BannerType);
  const { error } = await createClient().storage.from(BANNER_BUCKET).upload(path, change.file, { contentType: change.file.type, cacheControl: "31536000", upsert: false });
  if (error) return "The image could not be uploaded. Check your connection and try again.";
  const r = await setEventBanner(eventId, path);
  return r.ok ? null : r.error;
}

/**
 * Essentials first: title, short description, category, start and end date/time, venue, capacity
 * and an optional banner. Approval, visibility, host college and the registration deadline sit in an
 * optional Advanced area with defaults (automatic approval, public, university-wide, registration
 * open from saving until the event starts). Publishing still validates everything on the server.
 */
export function EventForm({ event, categories, colleges }: { event?: Tables<"events">; categories: Choice[]; colleges: Choice[] }) {
  const router = useRouter();
  const [message, setMessage] = useState(""); const [errors, setErrors] = useState<Record<string,string>>({}); const [pending, start] = useTransition();
  const [banner, setBanner] = useState<BannerChange>({ kind: "none" });
  const categoryOptions = choices(categories, event?.category_id);
  const endDate = useRef<HTMLInputElement>(null);
  const field = (name: string, label: string, control: ReactNode, hint?: string) => <Field data-invalid={errors[name] ? true : undefined}>
    <FieldLabel htmlFor={name}>{label}</FieldLabel>{control}{hint && <FieldDescription>{hint}</FieldDescription>}{errors[name] && <FieldError>{errors[name]}</FieldError>}
  </Field>;

  // onSubmit (not a form action) so field values survive a failed save.
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { start_date, start_time, end_date, end_time, ...rest } = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    // Checked on submit only, so nothing is flagged while the organizer is still typing.
    const schedule = composeSchedule({ start_date, start_time, end_date, end_time });
    if (Object.keys(schedule.errors).length) { setErrors(schedule.errors as Record<string, string>); setMessage("Check the event schedule."); return; }
    const values = { ...rest, starts_at: schedule.starts_at, ends_at: schedule.ends_at };
    start(async () => {
      setMessage(""); setErrors({});
      try {
        const r = await saveEvent(event?.id ?? null, values);
        if (!r.ok || !r.id) {
          setMessage(r.ok ? "Could not save the event. Refresh and try again." : r.error);
          setErrors(r.ok ? {} : Object.fromEntries(Object.entries(r.fieldErrors ?? {}).map(([k, v]) => [fieldFor[k] ?? k, v])));
          return;
        }
        const bannerError = await applyBanner(r.id, banner).catch(() => "The banner could not be saved. Check your connection and try again.");
        if (bannerError && !event) { router.push(`/organizer/events/${r.id}/settings?banner=failed`); return; }
        if (bannerError) { setMessage(`Event details were saved, but the banner was not: ${bannerError}`); router.refresh(); return; }
        router.push(`/organizer/events/${r.id}`); router.refresh();
      } catch { setMessage("Could not save the event. Check your connection and try again."); }
    });
  }

  return <form onSubmit={submit} aria-busy={pending} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
    <div className="min-w-0 space-y-6 lg:col-start-1">
      {event?.status === "published" && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Changing the date or time does not notify registered participants. Share updates directly.</p>}
      {field("title", "Event title", <Input id="title" name="title" required minLength={5} maxLength={150} defaultValue={event?.title} />)}
      {field("description", "Short description", <Textarea id="description" name="description" maxLength={5000} rows={3} defaultValue={event?.description ?? ""} />, "Required to publish.")}
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField id="category_id" name="category_id" label="Category" placeholder={categoryOptions.length ? "Choose category" : "No categories available"} options={categoryOptions} defaultValue={event?.category_id ?? ""} error={errors.category_id} />
        {field("venue", "Venue", <Input id="venue" name="venue" maxLength={200} defaultValue={event?.venue ?? ""} />)}
      </div>
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-3 text-sm text-muted-foreground">Schedule, in Philippine time. Overnight and multi-day events (up to 7 days) are fine.</legend>
        {field("start_date", "Start date", <Input id="start_date" name="start_date" type="date" defaultValue={manila(event?.starts_at, "yyyy-MM-dd")} onChange={e => { if (endDate.current && !endDate.current.value) endDate.current.value = e.target.value; }} />)}
        {field("start_time", "Start time", <Input id="start_time" name="start_time" type="time" defaultValue={manila(event?.starts_at, "HH:mm")} />)}
        {field("end_date", "End date", <Input ref={endDate} id="end_date" name="end_date" type="date" defaultValue={manila(event?.ends_at, "yyyy-MM-dd")} />)}
        {field("end_time", "End time", <Input id="end_time" name="end_time" type="time" defaultValue={manila(event?.ends_at, "HH:mm")} />)}
      </fieldset>
      {field("capacity", "Capacity", <Input id="capacity" name="capacity" type="number" min={1} max={5000} defaultValue={event?.capacity ?? ""} className="sm:max-w-40" />, "Leave blank for unlimited.")}
      {!categoryOptions.length && <p role="status" className="text-sm text-muted-foreground">No event categories are set up yet. You can save a draft; an administrator must add categories in Reference Data before publishing.</p>}
      <details className="group rounded-lg border" open={Boolean(errors.registration_closes_at || errors.host_college_id)}>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring"><ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" aria-hidden="true" />Advanced (optional)</summary>
        <div className="grid gap-5 border-t p-4 sm:grid-cols-2">
          <SelectField id="approval_mode" name="approval_mode" label="Registration approval" options={[{ value: "automatic", label: "Automatic" }, { value: "manual", label: "Organizer approval" }]} defaultValue={event?.approval_mode ?? "automatic"} error={errors.approval_mode} />
          <SelectField id="visibility" name="visibility" label="Visibility" options={[{ value: "public", label: "Public — listed in Events" }, { value: "unlisted", label: "Unlisted — link or QR only" }]} defaultValue={event?.visibility ?? "public"} error={errors.visibility} />
          <SelectField id="host_college_id" name="host_college_id" label="Host college" placeholder="University-wide" options={choices(colleges, event?.host_college_id)} defaultValue={event?.host_college_id ?? ""} error={errors.host_college_id} />
          {field("registration_closes_at", "Registration deadline", <Input id="registration_closes_at" name="registration_closes_at" type="datetime-local" defaultValue={manila(event?.registration_closes_at, "yyyy-MM-dd'T'HH:mm")} />, "Defaults to the event start.")}
          {/* Registration opens when the event is first saved unless an earlier opening was already set. */}
          <input type="hidden" name="registration_opens_at" value={manila(event?.registration_opens_at, "yyyy-MM-dd'T'HH:mm")} />
        </div>
      </details>
    </div>
    <aside className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
      <div className="lg:sticky lg:top-6"><BannerField currentUrl={bannerUrl(event?.banner_path)} value={banner} onChange={setBanner} disabled={pending} /></div>
    </aside>
    <div className="space-y-3 border-t pt-5 lg:col-start-1">
      {message && <div role="alert" className="text-sm text-destructive"><p>{message}</p>{Object.entries(errors).map(([key,value]) => <p key={key}>{key.replaceAll("_"," ")}: {value}</p>)}</div>}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : event ? "Save changes" : "Save draft"}</Button>
    </div>
  </form>;
}
