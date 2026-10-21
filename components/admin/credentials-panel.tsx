"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Credentials } from "@/lib/admin/accounts";

/**
 * Shows Admin-issued credentials exactly once. They live only in this component's memory: nothing
 * is written to storage, logs or the URL, and closing the dialog discards them.
 */
export function CredentialsPanel({ credentials, onDone, doneLabel = "Done" }: { credentials: Credentials; onDone: () => void; doneLabel?: string }) {
  const [copied, setCopied] = useState<"ok" | "failed" | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`EventHub login\nEmail: ${credentials.email}\nTemporary password: ${credentials.password}`);
      setCopied("ok");
    } catch {
      setCopied("failed");
    }
  }

  return <div className="grid gap-4">
    <div role="note" className="flex gap-2.5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>This temporary password will not be shown again. Give it to the account holder in person. They must replace it when they first log in.</p>
    </div>
    <dl className="grid gap-3 rounded-md border bg-muted/40 p-3 text-sm">
      <div className="grid gap-1"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</dt><dd className="break-all font-medium">{credentials.email}</dd></div>
      <div className="grid gap-1"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Temporary password</dt><dd className="select-all break-all font-mono text-base tracking-wide">{credentials.password}</dd></div>
    </dl>
    <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">{copied === "ok" ? "Credentials copied to the clipboard." : copied === "failed" ? "Copying is blocked in this browser. Select the password and copy it manually." : ""}</p>
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={copy}>{copied === "ok" ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}Copy Credentials</Button>
      <Button type="button" onClick={onDone} autoFocus>{doneLabel}</Button>
    </div>
  </div>;
}
