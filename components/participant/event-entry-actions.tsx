import { JoinInviteDialog } from "@/components/participant/join-invite-dialog";
import { ScanAttendanceDialog } from "@/components/mvp/scan-attendance-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EventEntryActions({ prominent = false }: { prominent?: boolean }) {
  const style = prominent
    // Dashboard header: 40px tall, roomier padding, icon and label centered.
    ? cn(buttonVariants({ variant: "default" }), "h-10 items-center gap-2 px-4 py-2.5 has-data-[icon=inline-start]:pl-4")
    : buttonVariants({ variant: "outline" });
  return <div className="flex flex-col gap-2 sm:flex-row">
    <JoinInviteDialog className={style} />
    <ScanAttendanceDialog className={style}>Scan QR Code</ScanAttendanceDialog>
  </div>;
}
