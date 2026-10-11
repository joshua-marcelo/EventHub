"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SharePanel({ url, qr, inviteCode }: { url: string; qr: string; inviteCode: string }) {
  const [message, setMessage] = useState("");
  return <section className="space-y-3 rounded-lg border p-4" aria-label="Registration sharing">
    <h2 className="text-lg font-semibold">Share registration</h2>
    <p className="text-sm">This static QR opens event registration. Participants must sign in and register.</p>
    {/* A generated data URL needs no image optimization. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={qr} alt="Registration QR for this event" width={256} height={256} className="max-w-full" />
    <label className="block space-y-1"><span className="text-sm">Direct event link</span><input className="w-full rounded border p-2 text-sm" readOnly value={url} onFocus={e => e.target.select()} /></label>
    <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(url); setMessage("Link copied."); } catch { setMessage("Select and copy the link above."); } }}>Copy link</Button><a href={qr} download={`EventHub-Registration-${inviteCode}.png`} className="inline-flex items-center rounded-md border px-3 py-2 text-sm">Download QR PNG</a></div>
    <p className="text-sm">Invite code: <strong>{inviteCode}</strong></p>
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
