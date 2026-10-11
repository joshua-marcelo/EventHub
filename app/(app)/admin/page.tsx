import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/dal";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";
export const metadata = { title: "Admin dashboard" };
export default function Page() { return <Suspense fallback={<PageSkeleton />}><Dashboard /></Suspense>; }
async function Dashboard() {
  await requireAdmin();
  return <div className="space-y-6"><PageHeader title="Admin dashboard" description="Keep campus accounts and event information organized." action={<Link href="/admin/lookups" className={buttonVariants()}>Manage lookups</Link>} /><EmptyState title="Ready to set up campus data" description="Add colleges, programs and event categories through Lookups. Applications and account management will be available here soon." /></div>;
}
