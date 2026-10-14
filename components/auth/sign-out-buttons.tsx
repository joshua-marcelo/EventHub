"use client";

import { useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { signOut, signOutEverywhere } from "@/lib/auth/actions";

/**
 * Signs out this browser through a Server Action (so links cannot trigger it); success redirects
 * to `/`. Only a real failure is reported: the action's own error, or no connection at all.
 */
export function useSignOut() {
  const [pending, startTransition] = useTransition();
  const signOutNow = () => startTransition(async () => {
    try {
      const result = await signOut();
      if (!result.ok) toast.error(result.error);
    } catch (error) {
      // The successful redirect arrives as a Next.js navigation error; let the router handle it.
      unstable_rethrow(error);
      toast.error("We couldn’t reach EventHub to log you out. Check your connection and try again.");
    }
  });
  return [pending, signOutNow] as const;
}

export function SignOutButton({ variant = "outline" }: { variant?: "outline" | "ghost" }) {
  const [pending, signOutNow] = useSignOut();
  return (
    <Button type="button" variant={variant} disabled={pending} aria-busy={pending} onClick={signOutNow}>
      {pending ? "Logging out…" : "Log out"}
    </Button>
  );
}

/** P-29: revoke every session of the account, e.g. after leaving a laptop signed in. */
export function SignOutEverywhereButton() {
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" disabled={pending} />}>
        Sign out of all devices
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out of all devices?</AlertDialogTitle>
          <AlertDialogDescription>
            Every browser where you are signed in, including this one, will be signed out. A device that was
            signed in may keep working for up to 1 hour until its current session expires.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => startTransition(() => signOutEverywhere())}>
            Sign out everywhere
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
