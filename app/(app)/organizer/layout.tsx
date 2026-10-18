import { Suspense, type ReactNode } from "react";
import { requireOrganizer } from "@/lib/auth/dal";
import { PageSkeleton } from "@/components/page-skeleton";
import { canUseOrganizerTools } from "@/lib/navigation";
export default function OrganizerLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}><Guard>{children}</Guard></Suspense>;
}
async function Guard({ children }: { children: ReactNode }) {
  const user = await requireOrganizer({ allowInactive: true });
  return <>{!canUseOrganizerTools(user) && <div role="status" className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Your organizer access is {user.organizerStatus}. This workspace is read-only. Contact an administrator for help.</div>}{children}</>;
}
