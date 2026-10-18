import { Suspense } from "react";
import { AuthCardSkeleton } from "@/components/auth/auth-card-skeleton";
import { AcceptInvitationForm } from "@/components/auth/accept-invitation-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { readProof } from "@/lib/organizers/acceptance-proof";

export const metadata = { title: "Accept Organizer invitation", robots: { index: false }, referrer: "no-referrer" as const };
export default function Page() { return <Suspense fallback={<AuthCardSkeleton />}><Invitation /></Suspense>; }
async function Invitation() {
  return <Card><CardHeader><CardTitle><h1>Welcome to EventHub</h1></CardTitle><CardDescription>You&apos;ve been invited to manage university events as an Organizer. Choose your password to activate your access.</CardDescription></CardHeader><CardContent><AcceptInvitationForm hasProof={Boolean(await readProof())} /></CardContent></Card>;
}
