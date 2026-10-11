import { CalendarDaysIcon } from "lucide-react";
import type { ReactNode } from "react";
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center rounded-lg border border-dashed px-4 py-12 text-center"><CalendarDaysIcon className="mb-4 size-7 text-muted-foreground" aria-hidden="true" /><h2 className="font-medium">{title}</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>{action && <div className="mt-5">{action}</div>}</div>;
}
