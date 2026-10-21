import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { FormAlert } from "@/components/forms/form-alert";
import { AccountProfileForm } from "@/components/profile/account-profile-form";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { StudentDetailsForm } from "@/components/profile/student-details-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { dashboards, roleDashboard } from "@/lib/navigation";
import { initialsOf, toFormDefaults } from "@/lib/profile/form-defaults";
import { getAvatarUrl, getProfileOptions } from "@/lib/profile/queries";

export const metadata = { title: "Account Profile" };
export default function Page({ searchParams }: PageProps<"/account/profile">) {
  return <Suspense fallback={<PageSkeleton />}><Profile searchParams={searchParams} /></Suspense>;
}

/**
 * Everything about the signed-in account on one page: account details, optional student details
 * (Participants still need them, through onboarding, before registering), the profile photo and
 * where to get help. Each section keeps its existing save action.
 */
async function Profile({ searchParams }: Pick<PageProps<"/account/profile">, "searchParams">) {
  const user = await requireUser({ allowIncomplete: true, next: "/account/profile" });
  // The legacy ?workspace= parameter is ignored: each account has one home.
  const home = dashboards[roleDashboard(user)];
  const participant = roleDashboard(user) === "participant";
  const passwordChanged = (await searchParams).password === "changed";
  const p = user.profile;
  const [avatarUrl, options] = await Promise.all([getAvatarUrl(p.avatar_path), getProfileOptions({ collegeId: p.college_id, programId: p.program_id })]);
  const student = toFormDefaults(user);

  return <div className="flex max-w-3xl flex-col gap-6">
    <Link href={home.href} className="inline-flex w-fit min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" aria-hidden="true" />Back to {home.label === "Participant" ? "Dashboard" : home.label}</Link>
    <PageHeader title="Account Profile" description="Your account, student details and photo." />
    {passwordChanged && <FormAlert tone="success">Your password was changed. Other devices were signed out.</FormAlert>}

    <Card><CardHeader><CardTitle>Account details</CardTitle></CardHeader><CardContent className="grid gap-4">
      <p className="break-all text-sm"><span className="text-muted-foreground">Email: </span><span className="font-medium">{user.email}</span></p>
      <AccountProfileForm defaults={{ firstName: p.first_name ?? "", middleName: p.middle_name ?? "", lastName: p.last_name ?? "", suffix: p.suffix ?? "" }} />
    </CardContent></Card>

    <Card id="student-details" className="scroll-mt-6"><CardHeader><CardTitle>Student details {!participant && <span className="text-sm font-normal text-muted-foreground">(optional)</span>}</CardTitle>
      <CardDescription>{participant ? "Used when you register for events and shown to organizers." : "Optional for your role. Needed only to join events as a participant."}</CardDescription></CardHeader>
      <CardContent className="grid gap-4">
        {participant && !user.isComplete && <FormAlert tone="info">To register for events, <Link href="/onboarding" className="underline underline-offset-4">finish Student Onboarding</Link>, including your photo and privacy consent.</FormAlert>}
        {p.identity_flagged_at && <FormAlert>An admin flagged your student ID for review. Contact the EventHub administrators to resolve it.</FormAlert>}
        <StudentDetailsForm defaults={{ studentId: student.studentId, collegeId: student.collegeId, programId: student.programId, yearLevel: student.yearLevel }} colleges={options.colleges} programs={options.programs} />
      </CardContent>
    </Card>

    <Card><CardHeader><CardTitle>Profile photo</CardTitle><CardDescription>Shown on your account and, for participants, on the attendance screen when you check in.</CardDescription></CardHeader>
      <CardContent><AvatarUpload userId={user.id} currentUrl={avatarUrl} initials={initialsOf(user)} /></CardContent>
    </Card>

    <Card size="sm"><CardHeader><CardTitle>Account assistance</CardTitle><CardDescription>For account or password assistance, please contact your administrator.</CardDescription></CardHeader></Card>
  </div>;
}
