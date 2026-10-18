"use client";

import { useId, useReducer, useRef, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PauseCircleIcon, ShieldCheckIcon, ShieldXIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { canSubmit, confirmReducer, initialConfirmState, matchesPhrase, type ConfirmState } from "@/lib/admin/confirmation";
import type { ConfirmConfig, ConfirmSeverity } from "@/lib/admin/organizer-actions";
import { cn } from "@/lib/utils";

const severityStyles: Record<ConfirmSeverity, { icon: typeof PauseCircleIcon; media: string; indicator: string; button: "default" | "destructive"; buttonClass?: string; trigger: "outline" | "destructive" }> = {
  warning: { icon: PauseCircleIcon, media: "bg-amber-50 text-amber-700", indicator: "border-amber-200 bg-amber-50 text-amber-900", button: "default", buttonClass: "bg-amber-100 text-amber-900 hover:bg-amber-200 focus-visible:border-amber-500 focus-visible:ring-amber-500/30", trigger: "outline" },
  destructive: { icon: ShieldXIcon, media: "bg-destructive/10 text-destructive", indicator: "border-destructive/30 bg-destructive/5 text-destructive", button: "destructive", trigger: "destructive" },
  positive: { icon: ShieldCheckIcon, media: "bg-emerald-50 text-emerald-700", indicator: "border-emerald-200 bg-emerald-50 text-emerald-800", button: "default", trigger: "outline" },
};

/**
 * Typed confirmation for high-impact admin actions, styled by `config.severity`. The admin must give
 * a reason and type the action's keyword exactly before the action button enables; one request runs
 * at a time and the dialog cannot be dismissed mid-request. The server action still re-checks
 * authorization and rules.
 *
 * Renders its own trigger button when `trigger` is given; otherwise open it with `open`/`onOpenChange`
 * (e.g. from a dropdown menu item).
 */
export function ConfirmActionDialog({ config, subject, runAction, successMessage, trigger, open: controlledOpen, onOpenChange }: {
  config: ConfirmConfig;
  subject: string;
  runAction: (reason: string) => Promise<ActionResult>;
  successMessage?: string;
  trigger?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const options = { phrase: config.phrase, reasonRequired: true };
  const [state, dispatch] = useReducer((s: ConfirmState, e: Parameters<typeof confirmReducer>[1]) => confirmReducer(s, e, options), initialConfirmState);
  const [, startTransition] = useTransition();
  const inFlight = useRef(false);
  const router = useRouter();
  const id = useId();
  const style = severityStyles[config.severity];
  const Icon = style.icon;
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : state.open;
  const ready = canSubmit({ ...state, open }, options);
  const wrongPhrase = state.typed.length > 0 && !matchesPhrase(state.typed, config.phrase);

  function setOpen(next: boolean) {
    if (!next && (state.pending || inFlight.current)) return;
    dispatch(next ? { type: "open" } : { type: "close" });
    onOpenChange?.(next);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !ready) return;
    inFlight.current = true;
    const value = state.reason.trim();
    dispatch({ type: "submit" });
    startTransition(async () => {
      try {
        const result = await runAction(value);
        if (!result.ok) { dispatch({ type: "failed", error: result.error }); return; }
        dispatch({ type: "succeeded" });
        onOpenChange?.(false);
        toast.success(successMessage ?? (result.message && result.message !== "Saved." ? result.message : `${config.confirmLabel} completed.`));
        router.refresh();
      } catch {
        dispatch({ type: "failed", error: "Could not complete this action. Refresh and try again." });
      } finally {
        inFlight.current = false;
      }
    });
  }

  return <AlertDialog open={open} onOpenChange={setOpen}>
    {trigger && <AlertDialogTrigger render={<Button variant={style.trigger} size="sm" />}>{trigger}</AlertDialogTrigger>}
    <AlertDialogContent className="sm:max-w-md">
      <form onSubmit={submit} className="grid gap-4">
        <AlertDialogHeader>
          <AlertDialogMedia className={style.media}><Icon aria-hidden="true" /></AlertDialogMedia>
          <AlertDialogTitle>{config.title}</AlertDialogTitle>
          <AlertDialogDescription>{config.description}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-2 rounded-md border bg-muted/40 px-3 py-2.5 text-left text-sm">
          <span className={cn("w-fit rounded-full border px-2 py-0.5 text-xs font-medium", style.indicator)}>{config.indicator}</span>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Account</dt><dd className="break-words font-medium">{subject}</dd>
            <dt className="text-muted-foreground">Current status</dt><dd>{config.current}</dd>
          </dl>
        </div>

        {config.warning && <div role="note" className="flex gap-2.5 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-left text-sm">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <p>{config.warning}</p>
        </div>}

        <div className="grid gap-2 text-left">
          <Label htmlFor={`${id}-reason`}>{config.reasonLabel}</Label>
          <Textarea id={`${id}-reason`} name="reason" required maxLength={1000} rows={3} value={state.reason} onChange={e => dispatch({ type: "reason", value: e.target.value })} disabled={state.pending} placeholder={config.reasonPlaceholder} />
        </div>
        <div className="grid gap-2 text-left">
          <Label htmlFor={`${id}-phrase`}>Type <span className="font-mono font-semibold">{config.phrase}</span> to confirm</Label>
          <Input id={`${id}-phrase`} name="confirmation" autoComplete="off" autoCapitalize="off" spellCheck={false} value={state.typed} onChange={e => dispatch({ type: "typed", value: e.target.value })} disabled={state.pending} aria-invalid={wrongPhrase || undefined} aria-describedby={`${id}-phrase-hint${state.error ? ` ${id}-error` : ""}`} />
          <p id={`${id}-phrase-hint`} className="text-xs text-muted-foreground">Must match exactly, in capitals.</p>
        </div>
        {state.error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{state.error}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={state.pending}>Cancel</AlertDialogCancel>
          <Button type="submit" variant={style.button} className={style.buttonClass} disabled={!ready} aria-busy={state.pending || undefined}>{state.pending ? "Working…" : config.confirmLabel}</Button>
        </AlertDialogFooter>
      </form>
    </AlertDialogContent>
  </AlertDialog>;
}
