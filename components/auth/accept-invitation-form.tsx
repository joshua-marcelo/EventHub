"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PasswordField } from "./password-field";
import { FormAlert } from "@/components/forms/form-alert";
import { acceptOrganizerInvitation } from "@/lib/organizers/accept-invitation";

export function AcceptInvitationForm({ hasProof }: { hasProof: boolean }) {
  const router = useRouter();
  const token = useRef<string | undefined>(undefined);
  const initialized = useRef(false);
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    const read = () => {
      const url = new URL(window.location.href);
      const fragment = new URLSearchParams(url.hash.slice(1));
      token.current = fragment.get("type") === "invite" ? fragment.get("token_hash") || undefined : undefined;
      const present = Boolean(url.hash || url.search);
      setValid(token.current ? true : !present && hasProof);
      if (present) window.history.replaceState(window.history.state, "", url.pathname);
      setReady(true);
    };
    if (!initialized.current) { initialized.current = true; read(); }
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [hasProof]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setError("");
    start(async () => {
      try {
        const result = await acceptOrganizerInvitation({ password: values.get("password"), confirmPassword: values.get("confirmPassword") }, token.current);
        if (result.invitationVerified) token.current = undefined;
        if (!result.ok) { setError(result.fieldErrors ? Object.values(result.fieldErrors).join(" ") : result.error); if (result.code === "invitation_invalid") setValid(false); return; }
        router.replace("/organizer"); router.refresh();
      } catch { setError("Could not complete setup. Check your connection and try again. If the link was already verified, refresh this page to resume securely."); }
    });
  }
  if (!ready) return <p role="status" className="text-sm text-muted-foreground">Checking invitation…</p>;
  if (!valid) return <FormAlert>{error || "This invitation link is missing, invalid, or expired. Ask an administrator for a new invitation."}</FormAlert>;
  return <form onSubmit={submit} className="grid gap-4" aria-busy={pending}>
    {error && <FormAlert>{error}</FormAlert>}
    <PasswordField name="password" label="Password" autoComplete="new-password" required minLength={8} maxLength={72} disabled={pending} description="At least 8 characters with letters and numbers." />
    <PasswordField name="confirmPassword" label="Confirm password" autoComplete="new-password" required minLength={8} maxLength={72} disabled={pending} />
    <Button type="submit" disabled={pending}>{pending ? "Setting up account…" : "Set Password & Accept Invitation"}</Button>
  </form>;
}
