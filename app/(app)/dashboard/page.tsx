import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { ParticipantDashboard } from "@/components/participant/dashboard";
import { requireUser } from "@/lib/auth/dal";
import { homeFor, roleDashboard } from "@/lib/navigation";
import { getParticipantDashboard } from "@/lib/participant/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <Suspense fallback={<PageSkeleton />}><Dashboard /></Suspense>;
}

async function Dashboard() {
  const user = await requireUser({ allowIncomplete: true, next: "/dashboard" });
  if (roleDashboard(user) !== "participant") redirect(homeFor(user));
  if (!user.isComplete) redirect("/onboarding?next=%2Fdashboard");
  const data = await getParticipantDashboard(user.id);
  return <ParticipantDashboard firstName={user.profile.first_name ?? "there"} data={data} />;
}
