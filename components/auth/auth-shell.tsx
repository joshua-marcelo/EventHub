import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { BrandLogo } from "@/components/shared/brand-logo";
import "./auth.css";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell flex min-h-svh flex-col items-center justify-center bg-[#faf9f6] px-4 py-8 text-slate-900 sm:py-10">
      <header className="mb-6 flex flex-col items-center gap-5">
        <Link href="/" aria-label="EventHub home"><BrandLogo className="w-40" sizes="160px" /></Link>
      </header>
      <main className="w-full max-w-[480px]">{children}</main>
      <Link href="/" className="mt-6 inline-flex min-h-9 items-center gap-2 rounded-sm text-sm text-slate-600 transition-colors hover:text-orange-900 motion-reduce:transition-none"><ArrowLeft className="size-4" aria-hidden="true" />Back to Home</Link>
    </div>
  );
}
