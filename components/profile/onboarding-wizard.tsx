"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { PrivacyConsent } from "@/components/profile/privacy-consent";
import { ProfileForm } from "@/components/profile/profile-form";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { Button } from "@/components/ui/button";
import type { ProfileFormInput } from "@/lib/validation/profile";
import type { CollegeOption, ProgramOption } from "@/lib/profile/queries";
import { cn } from "@/lib/utils";

const steps = ["Privacy Notice", "Student Details", "Profile Photo"];

export function OnboardingWizard({ consented, detailsDone, photoDone, defaults, colleges, programs, userId, avatarUrl, initials, next }: {
  consented: boolean; detailsDone: boolean; photoDone: boolean;
  defaults: ProfileFormInput; colleges: CollegeOption[]; programs: ProgramOption[];
  userId: string; avatarUrl: string | null; initials: string; next: string;
}) {
  const [saved, setSaved] = useState([consented, detailsDone, photoDone]);
  const [step, setStep] = useState(!consented ? 0 : !detailsDone ? 1 : 2);
  const heading = useRef<HTMLHeadingElement>(null);
  // Completion is based on saved server data or a successful existing save action only.
  const done = [consented || saved[0], detailsDone || saved[1], photoDone || saved[2]];
  const complete = (index: number) => setSaved(previous => previous.map((value, i) => i === index || value));
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step]);

  return <div className="mx-auto w-full max-w-2xl space-y-5">
    <ol aria-label="Setup progress" className="grid grid-cols-3 gap-2">
      {steps.map((label, index) => <li key={label}><button type="button" aria-current={step === index ? "step" : undefined} disabled={index > 0 && !done.slice(0, index).every(Boolean)} onClick={() => setStep(index)} className={cn("flex min-h-14 w-full items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs font-medium outline-offset-2 focus-visible:outline-2 focus-visible:outline-orange-600 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-sm", step === index ? "border-orange-200 bg-orange-50 text-orange-900" : "border-transparent text-muted-foreground hover:bg-white")}>
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border", done[index] ? "border-slate-900 bg-slate-900 text-white" : "border-current")} aria-label={done[index] ? "Saved" : undefined}>{done[index] ? <CheckIcon className="size-3.5" aria-hidden="true" /> : index + 1}</span><span>{label}</span>
      </button></li>)}
    </ol>
    <section aria-labelledby="onboarding-step" className="rounded-xl border bg-white p-5 sm:p-6">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-orange-800">Step {step + 1} of 3</p>
      <h2 ref={heading} id="onboarding-step" tabIndex={-1} className="mb-2 text-xl font-semibold text-slate-900 outline-none">{steps[step]}</h2>
      <p className="mb-6 text-sm text-muted-foreground">{["Understand how EventHub uses your information.", "Use the details printed on your school ID.", "Add a clear photo so organizers can recognize you at check-in."][step]}</p>
      {/* Keep form instances mounted when going back, preserving entered and saved information. */}
      <div hidden={step !== 0}>
        {done[0] ? <><p className="text-sm text-muted-foreground">Your privacy consent has been saved. <Link href="/privacy" target="_blank" className="text-orange-800 underline">Read the Privacy Notice</Link>.</p><Button className="mt-5 h-10" onClick={() => setStep(1)}>Continue</Button></> : <PrivacyConsent submitLabel="Continue" onSaved={() => { complete(0); setStep(1); }} />}
      </div>
      <div hidden={step !== 1}>
        <ProfileForm compact defaults={defaults} colleges={colleges} programs={programs} submitLabel="Save and Continue" onSaved={() => { complete(1); setStep(2); }} />
      </div>
      <div hidden={step !== 2}>
        <AvatarUpload userId={userId} currentUrl={avatarUrl} initials={initials} refreshOnSave={false} onSaved={() => complete(2)} />
        <div className="mt-5 border-t pt-5"><p role="status" className="mb-3 text-sm text-muted-foreground">{done[2] ? "Your profile photo is saved. You can finish setup." : "Upload and save your profile photo to finish setup."}</p>
          {done.every(Boolean) ? <Link href={next} className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600">Finish Setup</Link> : <Button className="h-10" disabled>Finish Setup</Button>}
        </div>
      </div>
      {step > 0 && <div className="mt-5 border-t pt-4"><Button type="button" variant="ghost" className="h-10" onClick={() => setStep(step - 1)}>Back</Button></div>}
    </section>
  </div>;
}
