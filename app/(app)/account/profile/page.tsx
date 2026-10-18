import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { AccountProfileForm } from "@/components/profile/account-profile-form";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { PrivacyConsent } from "@/components/profile/privacy-consent";
import { SignOutEverywhereButton } from "@/components/auth/sign-out-buttons";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { accountProfileHref, dashboards, resolveWorkspaceContext } from "@/lib/navigation";
import { initialsOf } from "@/lib/profile/form-defaults";
import { getAvatarUrl } from "@/lib/profile/queries";
import { formatDate } from "@/lib/datetime";

export const metadata = { title: "Account Profile" };
export default function Page({ searchParams }: PageProps<"/account/profile">) {
  return <Suspense fallback={<PageSkeleton />}><Profile searchParams={searchParams} /></Suspense>;
}
async function Profile({ searchParams }: Pick<PageProps<"/account/profile">, "searchParams">) {
  const user = await requireUser({ allowIncomplete: true, next: "/account/profile" });
  const requested = (await searchParams).workspace;
  const workspace = resolveWorkspaceContext(user, requested);
  if (requested !== workspace) redirect(accountProfileHref(workspace));
  const p = user.profile;
  const avatarUrl = await getAvatarUrl(p.avatar_path);
  return <div className="flex max-w-3xl flex-col gap-6">
    <Link href={dashboards[workspace].href} className="inline-flex w-fit min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" aria-hidden="true" />Back to {dashboards[workspace].label}</Link>
    <PageHeader title="Account Profile" description="Your account details are shared across your authorized workspaces." />
    <Card><CardHeader><CardTitle>Account details</CardTitle><CardDescription>You log in and reset your password with this email. To change it, contact an administrator.</CardDescription></CardHeader><CardContent className="grid gap-4">
      <p className="break-all text-sm"><span className="text-muted-foreground">Email: </span><span className="font-medium">{user.email}</span></p>
      <AccountProfileForm defaults={{ firstName: p.first_name ?? "", middleName: p.middle_name ?? "", lastName: p.last_name ?? "", suffix: p.suffix ?? "" }} />
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Profile photo</CardTitle><CardDescription>Your shared account photo. Existing event-related photo locks still apply.</CardDescription></CardHeader><CardContent><AvatarUpload userId={user.id} currentUrl={avatarUrl} initials={initialsOf(user)} /></CardContent></Card>
    <Card><CardHeader><CardTitle>Privacy</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{p.privacy_consented_at ? <p>You accepted the <Link href="/privacy" className="text-foreground underline underline-offset-4">privacy notice</Link> on {formatDate(p.privacy_consented_at)}.</p> : <PrivacyConsent />}</CardContent></Card>
    <Card><CardHeader><CardTitle>Security</CardTitle><CardDescription>Use <Link href="/forgot-password" className="underline underline-offset-4">reset password</Link> to change your password. Sign out everywhere if you left EventHub open on a shared or lost device.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2"><SignOutEverywhereButton /><Link href="/privacy" className={buttonVariants({ variant: "ghost" })}>Privacy notice</Link></CardContent></Card>
    <div className="border-t pt-4"><p className="text-sm text-muted-foreground">Student ID, college, program, and year level belong to your Participant details. They are not required to edit this account profile.</p><Link href="/profile/student" className="mt-2 inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">Manage student details</Link></div>
  </div>;
}
