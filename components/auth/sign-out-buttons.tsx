"use client";

import { useTransition } from "react";

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
import { signOutEverywhere } from "@/lib/auth/actions";

/** Signs out this browser (POST, so links cannot trigger it). */
export function SignOutButton({ variant = "outline" }: { variant?: "outline" | "ghost" }) {
  return (
    <form action="/auth/signout" method="post">
      <Button type="submit" variant={variant}>
        Log out
      </Button>
    </form>
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
