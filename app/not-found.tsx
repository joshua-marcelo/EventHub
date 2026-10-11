import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
export default function NotFound() {
  return <div className="mx-auto max-w-lg space-y-4 px-4 py-16"><p className="text-sm text-muted-foreground">404</p><h1 className="text-2xl font-semibold">Page not found</h1><p className="text-sm text-muted-foreground">This page may be unavailable, or you may not have access.</p><Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>Go to dashboard</Link></div>;
}
