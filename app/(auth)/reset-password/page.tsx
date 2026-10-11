import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCardSkeleton } from "@/components/auth/auth-card-skeleton";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <ResetPassword />
    </Suspense>
  );
}

// Reached from the recovery email: /auth/confirm verified the link and created the session.
async function ResetPassword() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reset link no longer valid</CardTitle>
          <CardDescription>The link has expired or was already used. Request a new one.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/forgot-password" className={buttonVariants({ className: "w-full" })}>
            Request a new link
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>For {user.email}. Other devices will be signed out.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  );
}
