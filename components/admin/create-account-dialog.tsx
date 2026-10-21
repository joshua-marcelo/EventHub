"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";

import { CredentialsPanel } from "@/components/admin/credentials-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrganizerAccount, createParticipantAccount, type AccountRole, type Credentials } from "@/lib/admin/accounts";
import { promoteParticipant, searchParticipants } from "@/lib/organizers/actions";
import type { ParticipantMatch } from "@/lib/organizers/validation";

const copy: Record<AccountRole, { trigger: string; title: string; description: string; submit: string; created: string }> = {
  organizer: {
    trigger: "Add Organizer", title: "Add Organizer", submit: "Create Organizer", created: "Organizer account created",
    description: "Creates an Organizer account with a temporary password. Organizer access is active immediately; no email is sent.",
  },
  participant: {
    trigger: "Create Participant", title: "Create Participant", submit: "Create Participant", created: "Participant account created",
    description: "Creates a Participant account with a temporary password. The student completes their own details after logging in; no email is sent.",
  },
};

/** Admin → Organizers / Participants: create an account and show its one-time credentials. */
export function CreateAccountDialog({ role }: { role: AccountRole }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const text = copy[role];

  function close() {
    setOpen(false);
    setCredentials(null);
    router.refresh();
  }
  // While credentials are shown, only Done closes the dialog, so they are not lost by a stray click.
  return <Dialog open={open} onOpenChange={next => { if (next) setOpen(true); else if (!busy && !credentials) setOpen(false); }}>
    <DialogTrigger render={<Button />}><PlusIcon aria-hidden="true" />{text.trigger}</DialogTrigger>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg" showCloseButton={!credentials}>
      <DialogHeader>
        <DialogTitle>{credentials ? text.created : text.title}</DialogTitle>
        <DialogDescription>{credentials ? "Share these credentials securely." : text.description}</DialogDescription>
      </DialogHeader>
      {credentials ? <CredentialsPanel credentials={credentials} onDone={close} />
        : open && <AccountForm role={role} onCreated={setCredentials} onPromoted={() => { setOpen(false); router.refresh(); }} onBusyChange={setBusy} />}
    </DialogContent>
  </Dialog>;
}

function AccountForm({ role, onCreated, onPromoted, onBusyChange }: { role: AccountRole; onCreated: (c: Credentials) => void; onPromoted: () => void; onBusyChange: (busy: boolean) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"create" | "promote">("create");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setError("");
    onBusyChange(true);
    start(async () => {
      try {
        const result = await (role === "organizer" ? createOrganizerAccount : createParticipantAccount)({ email });
        if (!result.ok) { setError(result.fieldErrors?.email ?? result.error); return; }
        if (result.credentials) onCreated(result.credentials);
      } catch { setError("Could not reach the server. Refresh to check whether the account exists before retrying."); }
      finally { onBusyChange(false); }
    });
  }

  if (mode === "promote") return <PromoteParticipant onDone={onPromoted} onBack={() => setMode("create")} onBusyChange={onBusyChange} />;
  return <div className="grid gap-4">
    <form onSubmit={submit} className="grid gap-3" aria-busy={pending}>
      <div className="grid gap-1.5">
        <Label htmlFor={`${role}-email`}>Email address</Label>
        <Input id={`${role}-email`} name="email" type="email" autoComplete="off" required maxLength={254} disabled={pending} aria-invalid={error ? true : undefined} aria-describedby={error ? `${role}-email-error` : undefined} />
      </div>
      {error && <p id={`${role}-email-error`} role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Creating account…" : copy[role].submit}</Button>
    </form>
    {role === "organizer" && <p className="text-sm text-muted-foreground">Already has a Participant account? <button type="button" className="font-medium text-foreground underline underline-offset-4 disabled:opacity-50" disabled={pending} onClick={() => setMode("promote")}>Grant Organizer access instead</button></p>}
  </div>;
}

/** Existing Participant → Organizer, through the existing promote_participant_to_organizer RPC. */
function PromoteParticipant({ onDone, onBack, onBusyChange }: { onDone: () => void; onBack: () => void; onBusyChange: (busy: boolean) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ParticipantMatch[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<ParticipantMatch | null>(null);

  function run(task: () => Promise<void>) {
    setError("");
    onBusyChange(true);
    start(async () => {
      try { await task(); } catch { setError("Could not complete this operation. Check your connection and try again."); } finally { onBusyChange(false); }
    });
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get("query") ?? "");
    setSelected(null);
    run(async () => {
      const result = await searchParticipants(query);
      setSearched(true);
      if (!result.ok) { setRows([]); setError(result.error); return; }
      setRows(result.rows);
    });
  }
  function promote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    run(async () => {
      const result = await promoteParticipant(selected.id);
      if (!result.ok) { setError(result.error); return; }
      onDone();
    });
  }
  const name = (row: ParticipantMatch) => [row.first_name, row.last_name].filter(Boolean).join(" ") || "Unnamed account";

  return <div className="grid gap-4" aria-busy={pending}>
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
          <span className="min-w-0 break-words"><span className="block font-medium">{name(row)}</span><span className="block break-all text-xs">{row.email}</span><span className="block text-xs text-muted-foreground">{row.student_id || "No student ID"}{!eligible ? ` · ${row.organizer_status !== "none" ? row.organizer_status : "Incomplete profile"}` : ""}</span></span>
        </label>;
      })}
    </fieldset>}
    {selected && <form onSubmit={promote} className="grid gap-3 rounded-md border bg-muted/30 p-3">
      <p className="text-sm">Grant Organizer access to <strong>{name(selected)}</strong>?</p>
      <p className="text-xs text-muted-foreground">Their existing account, password, registrations, and certificates are preserved.</p>
      <Button type="submit" disabled={pending}>{pending ? "Granting access…" : "Confirm Organizer Access"}</Button>
    </form>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="button" variant="ghost" className="justify-self-start" disabled={pending} onClick={onBack}>Back to Create Organizer</Button>
  </div>;
}
