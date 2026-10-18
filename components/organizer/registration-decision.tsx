"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { decideRegistration } from "@/lib/mvp/actions";

/** Approve, or reject with a reason, using the existing decideRegistration action. */
export function RegistrationDecision({ id, name }: { id: string; name: string }) {
  const router = useRouter(); const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false); const [reason, setReason] = useState(""); const [message, setMessage] = useState("");
  const run = (decision: "approved" | "rejected") => start(async () => {
    setMessage("");
    try { const r = await decideRegistration(id, decision, reason.trim()); if (r.ok) { setRejecting(false); router.refresh(); } else setMessage(r.error); }
    catch { setMessage("Could not save. Try again."); }
  });
  return <div className="space-y-2">
    {rejecting
      ? <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); run("rejected"); }}>
          <Input value={reason} onChange={e => setReason(e.target.value)} required maxLength={1000} placeholder="Reason for rejection" aria-label={`Reason for rejecting ${name}`} className="h-8 min-w-0 flex-1 basis-40" disabled={pending} autoFocus />
          <Button type="submit" size="sm" variant="destructive" disabled={pending || !reason.trim()}>{pending ? "Saving…" : "Reject"}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setRejecting(false); setMessage(""); }} disabled={pending}>Cancel</Button>
        </form>
      : <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => run("approved")} disabled={pending} aria-label={`Approve ${name}`}>{pending ? "Saving…" : "Approve"}</Button>
          <Button size="sm" variant="outline" onClick={() => setRejecting(true)} disabled={pending} aria-label={`Reject ${name}`}>Reject</Button>
        </div>}
    {message && <p role="alert" className="text-xs text-destructive">{message}</p>}
  </div>;
}
