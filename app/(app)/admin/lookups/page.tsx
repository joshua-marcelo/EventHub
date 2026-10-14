import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { LookupManager } from "@/components/lookups/lookup-manager";
import { getLookups } from "@/lib/lookups/queries";
export const metadata = { title: "Reference Data" };
export default function LookupsPage() {
  return <div className="space-y-6"><PageHeader title="Reference Data" description="Colleges, programs and event categories offered in onboarding and event forms. Deactivate entries instead of deleting them so existing records keep their values." /><Suspense fallback={<PageSkeleton />}><Lookups /></Suspense></div>;
}
async function Lookups() { return <LookupManager data={await getLookups()} />; }
