import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Dashboard" };

// Placeholder Participant Dashboard. Phase 3 adds the shell and switcher; Phase 11 the widgets.
export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const user = await requireUser({ next: "/dashboard" });
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.profile.first_name}</h1>
        <p className="text-sm text-muted-foreground">Your profile is complete. You can register for events once they are published.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Your account</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/profile" className={buttonVariants({ variant: "outline" })}>
            View profile
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
