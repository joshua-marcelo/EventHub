"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";

export function ActionControl({ label, runAction, reason = false, confirm = false, variant = "outline" }: { label: string; runAction: (reason: string) => Promise<ActionResult>; reason?: boolean; confirm?: boolean; variant?: "default" | "outline" }) {
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return <form className="space-y-2" action={form => {
    if (confirm && !window.confirm(`${label}?`)) return;
    start(async () => {
      setMessage("");
      try { const r = await runAction(String(form.get("reason") ?? "")); setMessage(r.ok ? r.message ?? "Saved." : r.error); if (r.ok) router.refresh(); }
      catch { setMessage("Could not complete this action. Refresh and try again."); }
    });
  }}>
    {reason && <Input name="reason" required maxLength={1000} placeholder="Reason" aria-label={`Reason to ${label.toLowerCase()}`} />}
    <Button type="submit" variant={variant} disabled={pending}>{pending ? "Saving…" : label}</Button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </form>;
}
