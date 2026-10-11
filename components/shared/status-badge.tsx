import { Badge } from "@/components/ui/badge";
import type { Database } from "@/lib/database.types";
type Status = Database["public"]["Enums"]["organizer_status" | "application_status" | "event_status" | "registration_status" | "attendance_status"] | "inactive";
const labels: Record<Status, string> = {
  none: "Participant", active: "Active", inactive: "Inactive", suspended: "Suspended", revoked: "Revoked",
  pending: "Pending", approved: "Approved", rejected: "Rejected", withdrawn: "Withdrawn",
  draft: "Draft", published: "Published", completed: "Completed", cancelled: "Cancelled", present: "Present",
};
export function StatusBadge({ status }: { status: Status }) {
  const positive = ["active", "approved", "published", "completed", "present"].includes(status);
  const negative = ["suspended", "revoked", "rejected", "cancelled"].includes(status);
  return <Badge variant="outline" className={positive ? "border-emerald-200 bg-emerald-50 text-emerald-800" : negative ? "border-amber-200 bg-amber-50 text-amber-900" : "text-muted-foreground"}>{labels[status]}</Badge>;
}
