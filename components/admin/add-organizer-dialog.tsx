"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { inviteOrganizer, promoteParticipant, searchParticipants } from "@/lib/organizers/actions";
import type { ParticipantMatch } from "@/lib/organizers/validation";

export function AddOrganizerDialog() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next); }}>
    <DialogTrigger render={<Button />}><PlusIcon aria-hidden="true" />Add Organizer</DialogTrigger>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Add Organizer</DialogTitle><DialogDescription>Invite a new account or grant access to an existing Participant.</DialogDescription></DialogHeader>
      {open && <OrganizerForm onSuccess={() => setOpen(false)} onBusyChange={setBusy} />}
    </DialogContent>
  </Dialog>;
}

function OrganizerForm({ onSuccess, onBusyChange }: { onSuccess: () => void; onBusyChange: (busy: boolean) => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"invite" | "promote">("invite");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ParticipantMatch[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<ParticipantMatch | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setError("");
    onBusyChange(true);
    start(async () => {
      try {
        const result = mode === "invite" ? await inviteOrganizer({ firstName: values.get("firstName"), lastName: values.get("lastName"), email: values.get("email") })
          : selected ? await promoteParticipant(selected.id) : { ok: false as const, error: "Select a Participant first." };
        if (!result.ok) { setError(result.error); return; }
        toast.success(result.message);
        onSuccess(); router.refresh();
      } catch { setError("Could not complete this operation. Check your connection and try again."); }
      finally { onBusyChange(false); }
    });
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get("query") ?? "");
    setSelected(null); setError("");
    onBusyChange(true);
    start(async () => {
      try {
        const result = await searchParticipants(query);
        setSearched(true);
        if (!result.ok) { setRows([]); setError(result.error); return; }
        setRows(result.rows);
      } catch { setError("Could not search Participants. Try again."); }
      finally { onBusyChange(false); }
    });
  }
  return <div className="grid gap-4" aria-busy={pending}>
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Add Organizer method">
      <Button type="button" className="h-auto min-h-11 whitespace-normal px-2 py-2" variant={mode === "invite" ? "default" : "outline"} disabled={pending} aria-pressed={mode === "invite"} onClick={() => { setMode("invite"); setError(""); }}>Invite New Organizer</Button>
      <Button type="button" className="h-auto min-h-11 whitespace-normal px-2 py-2" variant={mode === "promote" ? "default" : "outline"} disabled={pending} aria-pressed={mode === "promote"} onClick={() => { setMode("promote"); setError(""); }}>Promote Participant</Button>
    </div>
    {mode === "invite" ? <form onSubmit={submit} className="grid gap-3">
      <p className="text-sm text-muted-foreground">For someone without an EventHub account. They choose their own password; Student Onboarding is not required for Organizer access.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5"><Label htmlFor="organizer-first-name">First name</Label><Input id="organizer-first-name" name="firstName" autoComplete="given-name" required maxLength={80} disabled={pending} /></div>
        <div className="grid gap-1.5"><Label htmlFor="organizer-last-name">Last name</Label><Input id="organizer-last-name" name="lastName" autoComplete="family-name" required maxLength={80} disabled={pending} /></div>
      </div>
      <div className="grid gap-1.5"><Label htmlFor="organizer-email">Email address</Label><Input id="organizer-email" name="email" type="email" autoComplete="email" required maxLength={254} disabled={pending} /></div>
      <Button type="submit" disabled={pending}>{pending ? "Sending invitation…" : "Send Invitation"}</Button>
    </form> : <>
      <form onSubmit={search} className="grid gap-2">
        <Label htmlFor="organizer-participant-search">Find a Participant</Label>
        <div className="flex gap-2"><Input id="organizer-participant-search" name="query" placeholder="Name, email or student ID" minLength={2} maxLength={80} required disabled={pending} /><Button type="submit" variant="outline" disabled={pending}>{pending ? "Searching…" : "Search"}</Button></div>
      </form>
      {searched && <fieldset className="grid max-h-52 gap-2 overflow-y-auto rounded-md border p-3">
        <legend className="px-1 text-xs text-muted-foreground">Participants (up to 20 matches)</legend>
        {!rows.length && <p className="text-sm text-muted-foreground">No matching Participants.</p>}
        {rows.map(row => {
          const eligible = row.organizer_status === "none" && row.is_complete;
          return <label key={row.id} className="flex items-start gap-2 rounded-md p-1 text-sm has-disabled:opacity-60">
            <input type="radio" name="participant" value={row.id} checked={selected?.id === row.id} disabled={pending || !eligible} onChange={() => setSelected(row)} className="mt-1" />
            <span className="min-w-0 break-words"><span className="block font-medium">{[row.first_name, row.last_name].filter(Boolean).join(" ") || "Unnamed account"}</span><span className="block break-all text-xs">{row.email}</span><span className="block text-xs text-muted-foreground">{row.student_id || "No student ID"}{!eligible ? ` · ${row.organizer_status !== "none" ? row.organizer_status : "Incomplete profile"}` : ""}</span></span>
          </label>;
        })}
      </fieldset>}
      {selected && <form onSubmit={submit} className="grid gap-3 rounded-md border bg-muted/30 p-3">
        <p className="text-sm">Grant Organizer access to <strong>{[selected.first_name, selected.last_name].filter(Boolean).join(" ")}</strong>?</p>
        <p className="break-all text-xs text-muted-foreground">{selected.email} · {selected.student_id}</p>
        <p className="text-xs text-muted-foreground">Their existing account, password, registrations, and certificates are preserved.</p>
        <Button type="submit" disabled={pending}>{pending ? "Granting access…" : "Confirm Organizer Access"}</Button>
      </form>}
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
