import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

// Public landing page. The full landing design comes with the Phase 12 polish pass.
export default function Home() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <div className="flex max-w-xl flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">EventHub</h1>
        <p className="text-muted-foreground">
          Council events of Wesleyan University–Philippines: register, check in with a QR code, and get verifiable
          certificates.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/signup" className={buttonVariants({ size: "lg" })}>
          Create an account
        </Link>
        <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Log in
        </Link>
      </div>
      <Link href="/privacy" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        Privacy notice
      </Link>
    </div>
  );
}
