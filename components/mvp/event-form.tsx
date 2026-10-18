"use client";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
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

type Choice = { id: number; name: string; is_active: boolean };
const group = "min-w-0 space-y-5";
const legend = "mb-4 border-b pb-2 text-sm font-semibold";
// Active entries, plus an event's current (possibly inactive) entry so it is not silently dropped.
const choices = (rows: Choice[], current?: number | null) =>
  rows.filter(c => c.is_active || c.id === current).map(c => ({ value: c.id, label: c.is_active ? c.name : `${c.name} (inactive)` }));

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

export function EventForm({ event, categories, colleges }: { event?: Tables<"events">; categories: Choice[]; colleges: Choice[] }) {
  const router = useRouter();
  const [message, setMessage] = useState(""); const [errors, setErrors] = useState<Record<string,string>>({}); const [pending, start] = useTransition();
  const [banner, setBanner] = useState<BannerChange>({ kind: "none" });
  const dates = ["starts_at", "ends_at", "registration_opens_at", "registration_closes_at"] as const;
  const labels = { starts_at: "Event start", ends_at: "Event end (optional)", registration_opens_at: "Registration opens", registration_closes_at: "Registration deadline" };
  const categoryOptions = choices(categories, event?.category_id);
  const field = (name: string, label: string, control: ReactNode, hint?: string) => <Field data-invalid={errors[name] ? true : undefined}>
    <FieldLabel htmlFor={name}>{label}</FieldLabel>{control}{hint && <FieldDescription>{hint}</FieldDescription>}{errors[name] && <FieldError>{errors[name]}</FieldError>}
  </Field>;

  // onSubmit (not a form action) so field values survive a failed save.
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    start(async () => {
      setMessage(""); setErrors({});
      try {
        const r = await saveEvent(event?.id ?? null, values);
        if (!r.ok || !r.id) { setMessage(r.ok ? "Could not save the event. Refresh and try again." : r.error); setErrors(r.ok ? {} : r.fieldErrors ?? {}); return; }
        const bannerError = await applyBanner(r.id, banner).catch(() => "The banner could not be saved. Check your connection and try again.");
        if (bannerError && !event) { router.push(`/organizer/events/${r.id}/settings?banner=failed`); return; }
        if (bannerError) { setMessage(`Event details were saved, but the banner was not: ${bannerError}`); router.refresh(); return; }
        router.push(`/organizer/events/${r.id}`); router.refresh();
      } catch { setMessage("Could not save the event. Check your connection and try again."); }
    });
  }

  return <form onSubmit={submit} aria-busy={pending} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
    <div className="min-w-0 space-y-8 lg:col-start-1">
      <p className="text-sm text-muted-foreground">Save a draft first. Publishing requires description, category, venue, future start, and registration dates. All times are Philippine time.</p>
      {event?.status === "published" && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Changing dates does not notify registered participants. Share updates directly.</p>}
      <fieldset className={group}><legend className={legend}>Event details</legend>
        {field("title", "Title", <Input id="title" name="title" required minLength={5} maxLength={150} defaultValue={event?.title} />)}
        {field("description", "Description", <Textarea id="description" name="description" maxLength={5000} rows={5} defaultValue={event?.description ?? ""} />)}
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField id="category_id" name="category_id" label="Category" placeholder={categoryOptions.length ? "Choose category" : "No categories available"} options={categoryOptions} defaultValue={event?.category_id ?? ""} error={errors.category_id} />
          <SelectField id="host_college_id" name="host_college_id" label="Host college" placeholder="University-wide" options={choices(colleges, event?.host_college_id)} defaultValue={event?.host_college_id ?? ""} error={errors.host_college_id} />
        </div>
        {!categoryOptions.length && <p role="status" className="text-sm text-muted-foreground">No event categories are set up yet. You can save a draft; an administrator must add categories in Reference Data before publishing.</p>}
        {field("venue", "Venue", <Input id="venue" name="venue" maxLength={200} defaultValue={event?.venue ?? ""} />)}
      </fieldset>
      <fieldset className={group}><legend className={legend}>Schedule and registration</legend>
        <div className="grid gap-5 sm:grid-cols-2">{dates.map(key => <div key={key}>{field(key, labels[key], <Input id={key} name={key} type="datetime-local" defaultValue={event?.[key] ? formatInManila(event[key]!, "yyyy-MM-dd'T'HH:mm") : ""} />)}</div>)}</div>
      </fieldset>
      <fieldset className={group}><legend className={legend}>Capacity and approval</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          {field("capacity", "Capacity", <Input id="capacity" name="capacity" type="number" min={1} max={5000} defaultValue={event?.capacity ?? ""} />, "Leave blank for unlimited.")}
          <SelectField id="approval_mode" name="approval_mode" label="Registration approval" options={[{ value: "automatic", label: "Automatic" }, { value: "manual", label: "Organizer approval" }]} defaultValue={event?.approval_mode ?? "automatic"} error={errors.approval_mode} />
        </div>
        <SelectField id="visibility" name="visibility" label="Visibility" options={[{ value: "public", label: "Public — appears in Explore" }, { value: "unlisted", label: "Unlisted — direct link or invite only" }]} defaultValue={event?.visibility ?? "public"} error={errors.visibility} />
      </fieldset>
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
