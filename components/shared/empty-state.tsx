import { CalendarDaysIcon, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
export function EmptyState({ title, description, action, icon: Icon = CalendarDaysIcon, headingLevel: Heading = "h2" }: { title: string; description: string; action?: ReactNode; icon?: LucideIcon; headingLevel?: "h2" | "h3" }) {
  return <div className="flex flex-col items-center rounded-lg border border-dashed px-4 py-12 text-center"><Icon className="mb-4 size-7 text-muted-foreground" aria-hidden="true" /><Heading className="font-medium">{title}</Heading><p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>{action && <div className="mt-5">{action}</div>}</div>;
}
