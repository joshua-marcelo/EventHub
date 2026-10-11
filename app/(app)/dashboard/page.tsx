import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/dal";
import { defaultDashboard } from "@/lib/navigation";

export const metadata: Metadata = { title: "Dashboard" };

// Phase 3 dashboard scaffold; data widgets arrive in Phase 11.
export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const user = await requireUser({ allowIncomplete: true, next: "/dashboard" });
  if (defaultDashboard(user) === "/admin") redirect("/admin");
  if (!user.isComplete) redirect("/onboarding?next=%2Fdashboard");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Welcome, ${user.profile.first_name}`} description="Stay connected to your campus. Find events, track attendance and collect certificates." action={<Link href="/profile" className={buttonVariants({ variant: "outline" })}>View profile</Link>} />
      <EmptyState title="Your campus calendar starts here" description="Your upcoming events will appear here once event registration opens." action={<Link href="/events" className={buttonVariants()}>Explore events</Link>} />
    </div>
  );
}
