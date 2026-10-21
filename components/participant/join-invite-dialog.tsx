"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { TicketIcon } from "lucide-react";
import { resolveInviteCode } from "@/lib/participant/invite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const messages = { unavailable: "This event isn’t available. Check the code.", retry: "Could not load invite. Try again." };

/** Invite-code entry in place. `?join=1` (the old /events/join link) opens it on load, then is removed from the URL. */
export function JoinInviteDialog({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    const url = new URL(location.href);
    if (url.searchParams.get("join") !== "1") return;
    url.searchParams.delete("join");
    history.replaceState(null, "", url.pathname + url.search);
    const timer = setTimeout(() => setOpen(true), 0);
    return () => clearTimeout(timer);
  }, []);

  // onSubmit, not a form action: a failed code stays in the field for correction.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    start(async () => {
      try {
        const r = await resolveInviteCode(String(form.get("code") ?? ""));
        if ("eventId" in r) { setOpen(false); router.push(`/events/${r.eventId}`); }
        else setError(messages[r.error]);
      } catch { setError(messages.retry); }
    });
  }

  return <Dialog open={open} onOpenChange={next => { setOpen(next); if (!next) setError(""); }}>
    <DialogTrigger render={<button type="button" className={className} />}><TicketIcon aria-hidden="true" />Join by Invite Code</DialogTrigger>
    <DialogContent className="sm:max-w-sm">
      <DialogHeader><DialogTitle>Join by Invite Code</DialogTitle><DialogDescription>Enter the 8-character code from the organizer to open the event.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1.5"><span className="text-sm font-medium">Event Invite Code</span>
          <Input name="code" required minLength={8} maxLength={8} autoFocus autoCapitalize="characters" autoComplete="off" spellCheck={false} className="uppercase tracking-widest" aria-invalid={error ? true : undefined} aria-describedby={error ? "invite-error" : undefined} onChange={() => error && setError("")} />
        </label>
        {error && <p id="invite-error" role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="submit" disabled={pending}>{pending ? "Opening…" : "Open Event"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
