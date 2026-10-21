"use client";

import { useState } from "react";
import { QrCodeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** The event's static registration QR and link: both open the same event registration page. */
export function RegistrationQrDialog({ url, qr, title }: { url: string; qr: string; title: string }) {
  const [message, setMessage] = useState("");
  return <Dialog onOpenChange={() => setMessage("")}>
    <DialogTrigger render={<Button variant="outline" />}><QrCodeIcon aria-hidden="true" />Registration QR</DialogTrigger>
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Registration QR</DialogTitle>
        <DialogDescription>Participants scan this to open the event and register with their EventHub account.</DialogDescription>
      </DialogHeader>
      {/* A generated data URL needs no image optimization. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt={`Registration QR for ${title}`} width={256} height={256} className="mx-auto size-64 rounded-md border bg-white" />
      <input aria-label="Event registration link" className="w-full rounded-md border bg-muted/40 px-2.5 py-2 text-sm" readOnly value={url} onFocus={e => e.target.select()} />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(url); setMessage("Link copied."); } catch { setMessage("Select and copy the link above."); } }}>Copy link</Button>
        <a href={qr} download={`EventHub-Registration-${title.replace(/[^\w-]+/g, "-").slice(0, 60)}.png`} className="inline-flex h-8 items-center rounded-lg border px-2.5 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">Download PNG</a>
      </div>
      <p role="status" className="min-h-5 text-sm text-muted-foreground">{message}</p>
    </DialogContent>
  </Dialog>;
}
