import Link from "next/link";
import { Suspense } from "react";
import { requireOrganizer } from "@/lib/auth/dal";
import { PageSkeleton } from "@/components/page-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";
export const metadata = { title: "Attendance display" };
export default function Page() { return <Suspense fallback={<PageSkeleton />}><Display /></Suspense>; }
async function Display() {
  await requireOrganizer();
  return <div className="flex min-h-svh items-center justify-center p-6"><EmptyState title="Attendance display" description="Live attendance and rotating QR codes will be available here." action={<Link href="/organizer/events" className={buttonVariants({ variant: "outline" })}>Exit display</Link>} /></div>;
}
