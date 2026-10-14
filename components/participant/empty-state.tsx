import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function ParticipantEmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return <div className="rounded-xl border bg-white px-5 py-8 text-center">
    <Icon className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden="true" />
    <h3 className="font-semibold text-slate-900">{title}</h3>
    <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>;
}
