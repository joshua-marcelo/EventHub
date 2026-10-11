import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/30 px-4 py-10">
      <Link href="/" className="mb-6 text-lg font-semibold tracking-tight">
        EventHub
      </Link>
      <main className="w-full max-w-sm">{children}</main>
    </div>
  );
}
