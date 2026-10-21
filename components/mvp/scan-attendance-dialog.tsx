"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ScanLineIcon } from "lucide-react";
import { AttendanceScanner } from "@/components/mvp/attendance-scanner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/**
 * Opens the shared attendance scanner in place, so the participant never leaves the current page.
 * The scanner mounts only while open; closing unmounts it, which stops the camera stream.
 */
export function ScanAttendanceDialog({ expected = null, className, children = "Scan QR Code" }: { expected?: string | null; className?: string; children?: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Re-render server data (registration cards, event status) with the new attendance record.
  const recorded = useCallback(() => router.refresh(), [router]);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<button type="button" className={className} />}><ScanLineIcon aria-hidden="true" />{children}</DialogTrigger>
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Scan Attendance QR</DialogTitle><DialogDescription>Point your camera at the QR code on the organizer’s screen. Attendance records automatically.</DialogDescription></DialogHeader>
      {open && <AttendanceScanner expected={expected} autoStart onRecorded={recorded} />}
      <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
    </DialogContent>
  </Dialog>;
}
