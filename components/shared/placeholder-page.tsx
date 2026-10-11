import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageSkeleton } from "@/components/page-skeleton";
import { requireUser, requireAdmin, requireOrganizer } from "@/lib/auth/dal";

type Props = { title: string; description: string; access?: "participant" | "organizer" | "admin" };
export function PlaceholderPage(props: Props) {
  return <Suspense fallback={<PageSkeleton />}><Content {...props} /></Suspense>;
}
async function Content({ title, description, access = "participant" }: Props) {
  if (access === "admin") await requireAdmin();
  else if (access === "organizer") await requireOrganizer({ allowInactive: true });
  else await requireUser();
  return <div className="space-y-6"><PageHeader title={title} /><EmptyState title="Coming soon" description={description} /></div>;
}
