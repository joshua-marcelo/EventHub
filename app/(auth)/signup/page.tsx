import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCardSkeleton } from "@/components/auth/auth-card-skeleton";
import { SignUpForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <SignUpForm />
    </Suspense>
  );
}
