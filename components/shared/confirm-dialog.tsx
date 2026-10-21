"use client";
import { useRef, useState, type ReactNode, type RefObject } from "react";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
export type Confirmation = {
  title: string;
  description: string;
  subject?: string;
  tone?: "normal" | "destructive" | "warning";
};

/** Return false to keep the dialog open after a rejected action. */
export function ConfirmDialog({ trigger, title, description, subject, tone = "normal", confirmLabel = "Confirm", onConfirm, pending = false, open: controlledOpen, onOpenChange, error, finalFocus }: Confirmation & {
  trigger?: ReactNode;
  confirmLabel?: string;
  onConfirm: () => boolean | void | Promise<boolean | void>;
  pending?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  error?: string;
  finalFocus?: RefObject<HTMLButtonElement | null>;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState("");
  const inFlight = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const busy = pending || working;
  const open = controlledOpen ?? localOpen;

  function setOpen(next: boolean) {
    if (busy || inFlight.current) return;
    setFailure("");
    setLocalOpen(next);
    onOpenChange?.(next);
  }

  async function submit() {
    if (busy || inFlight.current) return;
    inFlight.current = true;
    setWorking(true);
    setFailure("");
    try {
      if (await onConfirm() !== false) {
        setLocalOpen(false);
        onOpenChange?.(false);
      }
    } catch {
      setFailure("Could not complete this action. Refresh and try again.");
    } finally {
      inFlight.current = false;
      setWorking(false);
    }
  }

  return <AlertDialog open={open} onOpenChange={setOpen}>
    {trigger && <AlertDialogTrigger render={<Button type="button" variant="outline" size="sm" disabled={busy} />}>{trigger}</AlertDialogTrigger>}
    <AlertDialogContent initialFocus={cancelRef} finalFocus={finalFocus} className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto">
      <AlertDialogHeader>
        <AlertDialogTitle className="break-words">{title}</AlertDialogTitle>
        <AlertDialogDescription className="min-w-0 break-words">
          {subject && <span className="mb-2 block font-medium text-foreground">{subject}</span>}
          {description}
        </AlertDialogDescription>
      </AlertDialogHeader>
      {(error || failure) && <p role="alert" className="text-sm text-destructive">{error || failure}</p>}
      <AlertDialogFooter>
        <AlertDialogCancel ref={cancelRef} type="button" disabled={busy}>Cancel</AlertDialogCancel>
        <AlertDialogAction type="button" variant={tone === "destructive" ? "destructive" : "default"}
          className={tone === "warning" ? "bg-amber-100 text-amber-900 hover:bg-amber-200 focus-visible:border-amber-500 focus-visible:ring-amber-500/30" : undefined}
          onClick={submit} disabled={busy} aria-busy={busy || undefined}>
          {busy ? "Working…" : confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
