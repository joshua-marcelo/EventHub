"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";

/**
 * Confirmation dialog for an admin action. The reason is collected inside the dialog; the server
 * action stays the authority (it re-checks the admin and the business rules). The dialog stays
 * open with the server's message if the action is refused, and refreshes the page on success.
 */
export function ReviewAction({ label, title, description, confirmLabel = label, runAction, reason = "none", tone = "default", size = "default" }: {
  label: string;
  title: string;
  description: string;
  confirmLabel?: string;
  runAction: (reason: string) => Promise<ActionResult>;
  reason?: "none" | "optional" | "required";
  tone?: "default" | "outline" | "destructive";
  size?: "default" | "sm";
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const fieldId = useId();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    if (reason === "required" && !value) { setError("Enter a reason."); return; }
    setError("");
    startTransition(async () => {
      try {
        const result = await runAction(value);
        if (!result.ok) { setError(result.error); return; }
        setOpen(false);
        toast.success(result.message && result.message !== "Saved." ? result.message : `${label} completed.`);
        router.refresh();
      } catch {
        setError("Could not complete this action. Refresh and try again.");
      }
    });
  }

  return <AlertDialog open={open} onOpenChange={next => { if (!pending) { setOpen(next); setError(""); } }}>
    <AlertDialogTrigger render={<Button variant={tone} size={size} />}>{label}</AlertDialogTrigger>
    <AlertDialogContent>
      <form onSubmit={submit} className="grid gap-4">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {reason !== "none" && <div className="grid gap-2 text-left">
          <Label htmlFor={fieldId}>{reason === "required" ? "Reason" : "Note (optional)"}</Label>
          <Textarea id={fieldId} name="reason" maxLength={1000} rows={3} disabled={pending} aria-invalid={error ? true : undefined} aria-describedby={error ? `${fieldId}-error` : undefined} placeholder={reason === "required" ? "Explain the decision." : undefined} />
        </div>}
        {error && <p id={`${fieldId}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction type="submit" variant={tone === "destructive" ? "destructive" : "default"} disabled={pending}>{pending ? "Saving…" : confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </form>
    </AlertDialogContent>
  </AlertDialog>;
}
