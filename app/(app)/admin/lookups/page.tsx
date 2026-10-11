import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { LookupManager } from "@/components/lookups/lookup-manager";
import { getLookups } from "@/lib/lookups/queries";
export const metadata = { title: "Manage lookups" };
export default function LookupsPage() {
  return <div className="space-y-6"><PageHeader title="Lookups" description="Manage colleges, programs and event categories. Deactivate entries to preserve existing records." /><Suspense fallback={<PageSkeleton />}><Lookups /></Suspense></div>;
}
async function Lookups() { return <LookupManager data={await getLookups()} />; }
