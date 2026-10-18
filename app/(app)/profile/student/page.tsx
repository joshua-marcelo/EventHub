import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { FormAlert } from "@/components/forms/form-alert";
import { StudentDetailsForm } from "@/components/profile/student-details-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { getProfileOptions } from "@/lib/profile/queries";
import { toFormDefaults } from "@/lib/profile/form-defaults";
import { accountProfileHref } from "@/lib/navigation";

export const metadata = { title: "Student details" };
export default function Page() { return <Suspense fallback={<PageSkeleton />}><StudentDetails /></Suspense>; }
async function StudentDetails() {
  const user = await requireUser({ allowIncomplete: true, next: "/profile/student" });
  const p = user.profile;
  const options = await getProfileOptions({ collegeId: p.college_id, programId: p.program_id });
  const defaults = toFormDefaults(user);
  return <div className="flex max-w-3xl flex-col gap-6">
    <Link href={accountProfileHref("participant")} className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground">Back to Account Profile</Link>
    <PageHeader title="Student details" description="Your Participant information for university events." />
    {!user.isComplete && <FormAlert tone="info">To register for events, <Link href="/onboarding" className="underline underline-offset-4">finish Student Onboarding</Link>, including your photo and privacy consent.</FormAlert>}
    {p.identity_flagged_at && <FormAlert>An admin flagged your student ID for review. Contact the EventHub administrators to resolve it.</FormAlert>}
    <Card><CardHeader><CardTitle>Student details</CardTitle></CardHeader><CardContent><StudentDetailsForm defaults={{ studentId: defaults.studentId, collegeId: defaults.collegeId, programId: defaults.programId, yearLevel: defaults.yearLevel }} colleges={options.colleges} programs={options.programs} /></CardContent></Card>
  </div>;
}
