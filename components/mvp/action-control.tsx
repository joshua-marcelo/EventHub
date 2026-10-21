"use client";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter, unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, type Confirmation } from "@/components/shared/confirm-dialog";
import type { ActionResult } from "@/lib/action-result";

export function ActionControl({ label, runAction, reason = false, confirmation, variant = "outline" }: { label: string; runAction: (reason: string) => Promise<ActionResult>; reason?: boolean; confirmation?: Confirmation; variant?: "default" | "outline" }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const inFlight = useRef(false);
  const submittedReason = useRef("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  async function execute(): Promise<boolean> {
    if (inFlight.current) return false;
    inFlight.current = true;
    setMessage("");
    setError("");
    let succeeded = false;
    // The returned promise covers the action; the transition also tracks router updates.
    await new Promise<void>(resolve => {
      start(async () => {
        try {
          const result = await runAction(submittedReason.current);
          if (!result.ok) { setError(result.error); return; }
          setMessage(result.message ?? "Saved.");
          router.refresh();
          succeeded = true;
        } catch (error) {
          unstable_rethrow(error);
          setError("Could not complete this action. Refresh and try again.");
        } finally {
          inFlight.current = false;
          resolve();
        }
      });
    });
    return succeeded;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || inFlight.current || open) return;
    submittedReason.current = String(new FormData(event.currentTarget).get("reason") ?? "");
    setError("");
    if (confirmation) setOpen(true);
    else void execute();
  }

  return <form className="space-y-2" onSubmit={submit}>
    {reason && <Input name="reason" required maxLength={1000} placeholder="Reason" disabled={pending} aria-label={`Reason to ${label.toLowerCase()}`} />}
    <Button ref={triggerRef} type="submit" variant={confirmation?.tone === "destructive" ? "destructive" : variant} disabled={pending} aria-busy={pending || undefined}>{pending ? "Saving…" : label}</Button>
    {confirmation && <ConfirmDialog {...confirmation} confirmLabel={label} open={open} onOpenChange={setOpen} onConfirm={execute} pending={pending} error={error} finalFocus={triggerRef} />}
    {message && <p role="status" className="text-sm">{message}</p>}
    {error && !open && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </form>;
}
