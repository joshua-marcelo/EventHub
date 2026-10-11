import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SignOutEverywhereButton } from "@/components/auth/sign-out-buttons";
import { FormAlert } from "@/components/forms/form-alert";
import { PageSkeleton } from "@/components/page-skeleton";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { PrivacyConsent } from "@/components/profile/privacy-consent";
import { ProfileForm } from "@/components/profile/profile-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { formatDate } from "@/lib/datetime";
import { initialsOf, toFormDefaults } from "@/lib/profile/form-defaults";
import { getAvatarUrl, getProfileOptions } from "@/lib/profile/queries";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  const user = await requireUser({ allowIncomplete: true, next: "/profile" });
  const p = user.profile;
  const [options, avatarUrl] = await Promise.all([
    getProfileOptions({ collegeId: p.college_id, programId: p.program_id }),
    getAvatarUrl(p.avatar_path),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">Your account and student details.</p>
      </div>

      {!user.isComplete ? (
        <FormAlert tone="info">
          Your profile is not complete yet.{" "}
          <Link href="/onboarding" className="underline underline-offset-4">
            Finish setup
          </Link>{" "}
          to register for events.
        </FormAlert>
      ) : null}
      {p.identity_flagged_at ? (
        <FormAlert>
          An admin flagged your student ID for review. Contact the EventHub administrators to resolve it.
        </FormAlert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            You log in and reset your password with this email. To change it, contact an administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm font-medium">{user.email}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile photo</CardTitle>
          <CardDescription>Required. Organizers see it during event check-in.</CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarUpload userId={user.id} currentUrl={avatarUrl} initials={initialsOf(user)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Student details</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm defaults={toFormDefaults(user)} colleges={options.colleges} programs={options.programs} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {p.privacy_consented_at ? (
            <p>
              You accepted the{" "}
              <Link href="/privacy" className="text-foreground underline underline-offset-4">
                privacy notice
              </Link>{" "}
              on {formatDate(p.privacy_consented_at)}.
            </p>
          ) : (
            <PrivacyConsent />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>
            Left EventHub open on a shared or lost device? Sign out everywhere. To change your password, use{" "}
            <Link href="/forgot-password" className="underline underline-offset-4">
              reset password
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <SignOutEverywhereButton />
          <Link href="/privacy" className={buttonVariants({ variant: "ghost" })}>
            Privacy notice
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
