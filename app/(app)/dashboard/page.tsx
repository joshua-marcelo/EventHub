import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/page-skeleton";
import { EventDiscovery, type DiscoveryParams } from "@/components/participant/event-discovery";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/dal";
import { defaultDashboard } from "@/lib/navigation";

export const metadata: Metadata = { title: "Dashboard" };

// Preserve Phase 3 entry guards; stage 1 adds discovery and registration links.
export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: DiscoveryParams }) {
  const user = await requireUser({ allowIncomplete: true, next: "/dashboard" });
  if (defaultDashboard(user) === "/admin") redirect("/admin");
  if (!user.isComplete) redirect("/onboarding?next=%2Fdashboard");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Welcome back, ${user.profile.first_name}`} description="Find events and keep track of your participation." />
      <EventDiscovery searchParams={searchParams} basePath="/dashboard" />
    </div>
  );
}
