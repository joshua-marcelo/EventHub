"use client";
import type { ReactNode } from "react";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
export function ConfirmDialog({ trigger, title, description, confirmLabel = "Confirm", onConfirm, pending = false }: { trigger: ReactNode; title: string; description: string; confirmLabel?: string; onConfirm: () => void; pending?: boolean }) {
  return <AlertDialog><AlertDialogTrigger render={<Button variant="outline" size="sm" disabled={pending} />}>{trigger}</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={onConfirm} disabled={pending}>{confirmLabel}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
