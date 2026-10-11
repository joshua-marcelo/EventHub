"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div role="alert" className="mx-auto max-w-lg space-y-4 p-6"><h1 className="text-2xl font-semibold">Something went wrong</h1><p className="text-sm text-muted-foreground">We couldn’t load this page. Try again in a moment.</p><Button onClick={reset}>Try again</Button></div>;
}
