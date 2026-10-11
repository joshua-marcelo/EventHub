import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Form-level message (errors from the server, confirmations). */
export function FormAlert({
  tone = "error",
  children,
  className,
}: {
  tone?: "error" | "success" | "info";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        tone === "error" && "border-destructive/30 bg-destructive/5 text-destructive",
        tone === "success" && "border-emerald-600/30 bg-emerald-600/5 text-emerald-800 dark:text-emerald-300",
        tone === "info" && "border-border bg-muted/50 text-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
