"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { acceptPrivacyNotice } from "@/lib/profile/actions";

export function PrivacyConsent({ onSaved, submitLabel = "I agree" }: { onSaved?: () => void; submitLabel?: string }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const accept = () => {
    setError(null);
    startTransition(async () => {
      const result = await acceptPrivacyNotice();
      if (result.ok) { onSaved?.(); router.refresh(); }
      else setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        EventHub stores your name, student ID, college, program, year level and photo to manage event
        registration, attendance and certificates. During check-in, your photo, name and college appear on the
        organizer&apos;s attendance screen. Read the full{" "}
        <Link href="/privacy" target="_blank" className="text-foreground underline underline-offset-4">
          privacy notice
        </Link>
        .
      </p>
      {error ? <FormAlert>{error}</FormAlert> : null}
      <Field orientation="horizontal">
        <Checkbox id="privacy-consent" checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
        <FieldLabel htmlFor="privacy-consent" className="font-normal">
          I have read the privacy notice and agree to the processing of my personal data for EventHub.
        </FieldLabel>
      </Field>
      <Button type="button" onClick={accept} disabled={!checked || pending} className="self-start">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </div>
  );
}
