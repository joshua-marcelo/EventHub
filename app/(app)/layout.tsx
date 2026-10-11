import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-buttons";

// Minimal authenticated frame for Phase 2. Phase 3 replaces it with the full shell
// (sidebar, dashboard switcher). It reads no session, so it stays in the static shell.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between gap-4 px-4">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            EventHub
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/profile" className="rounded-md px-2 py-1 hover:bg-muted">
              Profile
            </Link>
            <SignOutButton variant="ghost" />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
