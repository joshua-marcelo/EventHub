import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/page-skeleton";
import { OnboardingWizard } from "@/components/profile/onboarding-wizard";
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
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

      <OnboardingWizard consented={consented} detailsDone={detailsDone} photoDone={photoDone}
        defaults={toFormDefaults(user)} colleges={options.colleges} programs={options.programs}
        userId={user.id} avatarUrl={avatarUrl} initials={initialsOf(user)} next={next} />
    </div>
  );
}
