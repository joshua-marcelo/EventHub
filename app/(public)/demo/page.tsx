import type { Metadata } from "next";
import Link from "next/link";

import { BrandLogo } from "@/components/shared/brand-logo";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "EventHub Demo" };

export default function DemoPage() {
  return (
    <main className="landing grid min-h-svh place-items-center bg-[#faf9f6] px-5 py-12 text-slate-900">
      <div className="w-full max-w-md text-center">
        <BrandLogo className="mx-auto w-40" sizes="160px" />
        <h1 className="mt-9 text-3xl font-semibold tracking-tight sm:text-4xl">EventHub Demo</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600">Our video walkthrough is coming soon.</p>
        <Link href="/" className={buttonVariants({ className: "mt-7 min-h-11 px-5" })}>Back to Home</Link>
      </div>
    </main>
  );
}
