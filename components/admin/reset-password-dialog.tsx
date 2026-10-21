"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRoundIcon } from "lucide-react";

import { CredentialsPanel } from "@/components/admin/credentials-panel";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Credentials, CredentialsResult } from "@/lib/admin/accounts";
import { matchesPhrase } from "@/lib/admin/confirmation";

const PHRASE = "RESET";

/**
 * Admin-controlled recovery: typed confirmation, then the new one-time temporary password. Opened by
 * its own button (`trigger`) or from a menu (`open`/`onOpenChange`). The server re-checks everything.
 */
export function ResetPasswordDialog({ subject, runAction, trigger, open: controlledOpen, onOpenChange }: {
  subject: string;
  runAction: () => Promise<CredentialsResult>;
  trigger?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const id = useId();
  const [ownOpen, setOwnOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [pending, start] = useTransition();
  const inFlight = useRef(false);
  const open = controlledOpen ?? ownOpen;

  function setOpen(next: boolean) {
    // Never dismissed mid-request, and only Done closes it once credentials are shown.
    if (!next && (pending || inFlight.current || credentials)) return;
    setTyped("");
    setError("");
    setOwnOpen(next);
    onOpenChange?.(next);
  }
  function done() {
    setCredentials(null);
    setOwnOpen(false);
    onOpenChange?.(false);
    router.refresh();
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !matchesPhrase(typed, PHRASE)) return;
    inFlight.current = true;
    setError("");
    start(async () => {
      try {
        const result = await runAction();
        if (!result.ok) { setError(result.error); return; }
        if (result.credentials) setCredentials(result.credentials);
      } catch {
        setError("Could not complete this action. Refresh and try again.");
      } finally {
        inFlight.current = false;
      }
    });
  }

  return <AlertDialog open={open} onOpenChange={setOpen}>
    {trigger && <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>{trigger}</AlertDialogTrigger>}
    <AlertDialogContent className="sm:max-w-md">
      {credentials ? <div className="grid gap-4">
        <AlertDialogHeader>
          <AlertDialogTitle>Temporary password issued</AlertDialogTitle>
          <AlertDialogDescription>{subject} must set a new password at their next login.</AlertDialogDescription>
        </AlertDialogHeader>
        <CredentialsPanel credentials={credentials} onDone={done} />
      </div> : <form onSubmit={submit} className="grid gap-4">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-amber-50 text-amber-700"><KeyRoundIcon aria-hidden="true" /></AlertDialogMedia>
          <AlertDialogTitle>Reset this password?</AlertDialogTitle>
          <AlertDialogDescription>The current password stops working immediately. A new temporary password is shown once, and {subject} must change it at their next login.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2 text-left">
          <Label htmlFor={`${id}-phrase`}>Type <span className="font-mono font-semibold">{PHRASE}</span> to confirm</Label>
          <Input id={`${id}-phrase`} autoComplete="off" autoCapitalize="off" spellCheck={false} value={typed} onChange={e => { setTyped(e.target.value); setError(""); }} disabled={pending} aria-describedby={error ? `${id}-error` : undefined} />
          <p className="text-xs text-muted-foreground">Must match exactly, in capitals.</p>
        </div>
        {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button type="submit" disabled={pending || !matchesPhrase(typed, PHRASE)} aria-busy={pending || undefined}>{pending ? "Resetting…" : "Reset password"}</Button>
        </AlertDialogFooter>
      </form>}
    </AlertDialogContent>
  </AlertDialog>;
}
