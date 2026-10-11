import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { PageSkeleton } from "@/components/page-skeleton";
import { getCurrentUser } from "@/lib/auth/dal";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="mx-auto max-w-6xl p-6"><PageSkeleton /></div>}><SessionShell>{children}</SessionShell></Suspense>;
}
async function SessionShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return <AppShell user={user ? { name: user.profile.first_name || "Account", email: user.email, isAdmin: user.isAdmin, isComplete: user.isComplete, organizerStatus: user.organizerStatus } : null}>{children}</AppShell>;
}
