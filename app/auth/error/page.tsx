import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCardSkeleton } from "@/components/auth/auth-card-skeleton";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResendConfirmation } from "@/components/auth/resend-confirmation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Link problem", robots: { index: false } };

export default function AuthErrorPage({ searchParams }: PageProps<"/auth/error">) {
  return (
    <AuthShell>
        <Suspense fallback={<AuthCardSkeleton />}>
          <AuthError searchParams={searchParams} />
        </Suspense>
    </AuthShell>
  );
}

async function AuthError({ searchParams }: Pick<PageProps<"/auth/error">, "searchParams">) {
  const params = await searchParams;
  const kind = params.type === "recovery" ? "recovery" : "signup";
  const expired = params.reason === "link_expired";

  const title = expired ? "This link has expired or was already used" : "This link is not valid";
  const description =
    kind === "recovery"
      ? "Password reset links work once and expire after 1 hour. Enter your email to get a new one."
      : "Confirmation links work once and expire after 1 hour. If you already confirmed, log in. Otherwise enter your email to get a new link.";

  return (
    <Card>
      <CardHeader>
        <CardTitle><h1>{title}</h1></CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResendConfirmation kind={kind} askEmail />
      </CardContent>
      <CardFooter className="text-sm">
        <Link href="/login" className="underline-offset-4 hover:underline">
          Go to log in
        </Link>
      </CardFooter>
    </Card>
  );
}
