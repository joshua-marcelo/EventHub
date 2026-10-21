import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Organizer invitation", robots: { index: false }, referrer: "no-referrer" as const };

/** Email invitations are retired: Admins create accounts and hand over a temporary password in person. */
export default function Page() {
  return <Card><CardHeader><CardTitle><h1>Invitations are no longer used</h1></CardTitle><CardDescription>EventHub administrators now create Organizer accounts directly. Log in with the email and temporary password your administrator gave you, then choose your own password.</CardDescription></CardHeader><CardContent><Link href="/login" data-slot="button" className={buttonVariants({ className: "w-full" })}>Go to Log in</Link></CardContent></Card>;
}
