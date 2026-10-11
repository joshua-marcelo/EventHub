import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCardSkeleton } from "@/components/auth/auth-card-skeleton";
import { ResendConfirmation } from "@/components/auth/resend-confirmation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { maskEmail, readPendingEmail } from "@/lib/auth/pending-email";
import { safeNextPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage({ searchParams }: PageProps<"/signup/check-email">) {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <CheckEmail searchParams={searchParams} />
    </Suspense>
  );
}

async function CheckEmail({ searchParams }: Pick<PageProps<"/signup/check-email">, "searchParams">) {
  const [email, params] = await Promise.all([readPendingEmail(), searchParams]);
  const rawNext = typeof params.next === "string" ? params.next : undefined;
  const next = rawNext ? safeNextPath(rawNext, "") || undefined : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          We sent a confirmation link to <strong className="text-foreground">{email ? maskEmail(email) : "your email address"}</strong>.
          Open it to activate your account. The link is valid for 1 hour.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
        <p>Not there? Check your spam folder, or send a new link.</p>
        {email ? <ResendConfirmation next={next} /> : <ResendConfirmation askEmail next={next} />}
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-1 text-sm">
        <Link href="/signup" className="underline-offset-4 hover:underline">
          Wrong address? Sign up again
        </Link>
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="underline-offset-4 hover:underline">
          Already confirmed? Log in
        </Link>
      </CardFooter>
    </Card>
  );
}
