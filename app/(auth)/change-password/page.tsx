import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCardSkeleton } from "@/components/auth/auth-card-skeleton";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { SignOutButton } from "@/components/auth/sign-out-buttons";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { homeFor } from "@/lib/navigation";

export const metadata: Metadata = { title: "Change password", robots: { index: false }, referrer: "no-referrer" };

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <ChangePassword />
    </Suspense>
  );
}

async function ChangePassword() {
  // The one page an account on a temporary password may open. Student details are not needed here.
  const user = await requireUser({ allowIncomplete: true, allowTemporaryPassword: true });
  const temporary = user.mustChangePassword;

  return (
    <Card>
      <CardHeader>
        <CardTitle><h1>{temporary ? "Set your own password" : "Change password"}</h1></CardTitle>
        <CardDescription>
          {temporary
            ? "Your account was set up with a temporary password. Replace it with a password only you know before you continue."
            : "Enter your current password, then choose a new one. Other devices will be signed out."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="break-all text-sm text-muted-foreground">Signed in as <span className="font-medium text-foreground">{user.email}</span></p>
        <ChangePasswordForm temporary={temporary} />
      </CardContent>
      <CardFooter className="justify-center">
        {temporary
          ? <SignOutButton variant="ghost" />
          : <Link href={homeFor(user)} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Cancel</Link>}
      </CardFooter>
    </Card>
  );
}
