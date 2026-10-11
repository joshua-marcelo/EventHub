import { Suspense, type ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/dal";
import { PageSkeleton } from "@/components/page-skeleton";
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}><Guard>{children}</Guard></Suspense>;
}
async function Guard({ children }: { children: ReactNode }) { await requireAdmin(); return children; }
