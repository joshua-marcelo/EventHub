"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveEvent } from "@/lib/mvp/actions";
import type { Tables } from "@/lib/database.types";
import { formatInManila } from "@/lib/datetime";

type Choice = { id: number; name: string; is_active: boolean };
export function EventForm({ event, categories, colleges }: { event?: Tables<"events">; categories: Choice[]; colleges: Choice[] }) {
  const [message, setMessage] = useState(""); const [errors, setErrors] = useState<Record<string,string>>({}); const [pending, start] = useTransition();
  const dates = ["starts_at", "ends_at", "registration_opens_at", "registration_closes_at"] as const;
  const labels = { starts_at: "Event start", ends_at: "Event end (optional)", registration_opens_at: "Registration opens", registration_closes_at: "Registration deadline" };
  return <form className="max-w-2xl space-y-4" action={form => start(async () => {
    setMessage(""); setErrors({});
    const r = await saveEvent(event?.id ?? null, Object.fromEntries(form));
    if (!r.ok) { setMessage(r.error); setErrors(r.fieldErrors ?? {}); }
  })}>
    <p className="text-sm text-muted-foreground">Save a draft first. Publishing requires description, category, venue, future start, and registration dates. All times are Philippine time.</p>
    {event?.status === "published" && <p className="text-sm">Changing dates does not notify registered participants. Share updates directly.</p>}
    <label className="block space-y-1"><span>Title</span><Input name="title" required minLength={5} maxLength={150} defaultValue={event?.title} /></label>
    <label className="block space-y-1"><span>Description</span><Textarea name="description" maxLength={5000} defaultValue={event?.description ?? ""} /></label>
    <label className="block space-y-1"><span>Category</span><select className="w-full rounded-md border p-2" name="category_id" defaultValue={event?.category_id ?? ""}><option value="">Choose category</option>{categories.filter(c => c.is_active || c.id === event?.category_id).map(c => <option key={c.id} value={c.id}>{c.name}{!c.is_active ? " (inactive)" : ""}</option>)}</select></label>
    <label className="block space-y-1"><span>Host college</span><select className="w-full rounded-md border p-2" name="host_college_id" defaultValue={event?.host_college_id ?? ""}><option value="">University-wide</option>{colleges.filter(c => c.is_active || c.id === event?.host_college_id).map(c => <option key={c.id} value={c.id}>{c.name}{!c.is_active ? " (inactive)" : ""}</option>)}</select></label>
    <label className="block space-y-1"><span>Venue</span><Input name="venue" maxLength={200} defaultValue={event?.venue ?? ""} /></label>
    <div className="grid gap-4 sm:grid-cols-2">{dates.map(key => <label key={key} className="block space-y-1"><span>{labels[key]}</span><Input name={key} type="datetime-local" defaultValue={event?.[key] ? formatInManila(event[key]!, "yyyy-MM-dd'T'HH:mm") : ""} />{errors[key] && <p className="text-sm text-destructive">{errors[key]}</p>}</label>)}</div>
    <label className="block space-y-1"><span>Capacity (blank = unlimited)</span><Input name="capacity" type="number" min={1} max={5000} defaultValue={event?.capacity ?? ""} /></label>
    <label className="block space-y-1"><span>Registration approval</span><select className="w-full rounded-md border p-2" name="approval_mode" defaultValue={event?.approval_mode ?? "automatic"}><option value="automatic">Automatic</option><option value="manual">Organizer approval</option></select></label>
    <label className="block space-y-1"><span>Visibility</span><select className="w-full rounded-md border p-2" name="visibility" defaultValue={event?.visibility ?? "public"}><option value="public">Public — appears in Explore</option><option value="unlisted">Unlisted — direct link or invite only</option></select></label>
    <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save event"}</Button>
    {message && <div role="alert" className="text-sm text-destructive"><p>{message}</p>{Object.entries(errors).map(([key,value]) => <p key={key}>{key.replaceAll("_"," ")}: {value}</p>)}</div>}
  </form>;
}
