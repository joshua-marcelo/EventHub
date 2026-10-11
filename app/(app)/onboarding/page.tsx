import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { type ReactNode, Suspense } from "react";

import { PageSkeleton } from "@/components/page-skeleton";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { PrivacyConsent } from "@/components/profile/privacy-consent";
import { ProfileForm } from "@/components/profile/profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/auth/redirect";
import { initialsOf, toFormDefaults } from "@/lib/profile/form-defaults";
import { getAvatarUrl, getProfileOptions } from "@/lib/profile/queries";

export const metadata: Metadata = { title: "Complete your profile" };

export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Onboarding searchParams={searchParams} />
    </Suspense>
  );
}

async function Onboarding({ searchParams }: Pick<PageProps<"/onboarding">, "searchParams">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : undefined, DEFAULT_AFTER_LOGIN);
  const user = await requireUser({ allowIncomplete: true, next: `/onboarding?next=${encodeURIComponent(next)}` });
  if (user.isComplete) redirect(next);

  const p = user.profile;
  const [options, avatarUrl] = await Promise.all([
    getProfileOptions({ collegeId: p.college_id, programId: p.program_id }),
    getAvatarUrl(p.avatar_path),
  ]);
  const consented = Boolean(p.privacy_consented_at);
  const detailsDone = Boolean(
    p.first_name && p.last_name && p.student_id && p.college_id && p.program_id && p.year_level,
  );
  const photoDone = Boolean(p.avatar_path);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Complete your profile</h1>
        <p className="text-sm text-muted-foreground">
          Your email is confirmed. Finish these three steps to register for events.
        </p>
        {user.isAdmin ? (
          <p className="text-sm">
            Admin accounts can skip this.{" "}
            <Link href="/admin" className="underline underline-offset-4">
              Go to the Admin Dashboard
            </Link>
          </p>
        ) : null}
      </div>

      <Step number={1} title="Privacy notice" done={consented} description="How EventHub uses your personal data.">
        {consented ? <p className="text-sm text-muted-foreground">Accepted.</p> : <PrivacyConsent />}
      </Step>

      <Step
        number={2}
        title="Student details"
        done={detailsDone}
        description="Use the details printed on your school ID."
      >
        <ProfileForm
          defaults={toFormDefaults(user)}
          colleges={options.colleges}
          programs={options.programs}
          submitLabel={detailsDone ? "Update details" : "Save details"}
        />
      </Step>

      <Step number={3} title="Profile photo" done={photoDone} description="Required so organizers can recognize you at check-in.">
        <AvatarUpload userId={user.id} currentUrl={avatarUrl} initials={initialsOf(user)} />
      </Step>
    </div>
  );
}

function Step({
  number,
  title,
  description,
  done,
  children,
}: {
  number: number;
  title: string;
  description: string;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {done ? (
            <CheckCircle2Icon className="size-5 text-emerald-600" aria-label="Done" />
          ) : (
            <CircleIcon className="size-5 text-muted-foreground" aria-label="To do" />
          )}
          {number}. {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
