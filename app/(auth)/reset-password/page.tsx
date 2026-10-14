import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCardSkeleton } from "@/components/auth/auth-card-skeleton";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false }, referrer: "no-referrer" };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <ResetPassword />
    </Suspense>
  );
}

// Email credentials live in the browser fragment; the server cannot see them on a GET.
async function ResetPassword() {
  const user = await getCurrentUser();

  return (
    <Card>
      <CardHeader>
        <CardTitle><h1>Set a new password</h1></CardTitle>
        <CardDescription>Choose a strong password. Other devices will be signed out.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm hasSession={Boolean(user)} />
      </CardContent>
    </Card>
  );
}
