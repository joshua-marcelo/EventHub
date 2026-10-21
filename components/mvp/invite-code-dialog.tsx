"use client";

import { useState } from "react";
import { TicketIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function InviteCodeDialog({ code }: { code: string }) {
  const [message, setMessage] = useState("");
  return <Dialog onOpenChange={() => setMessage("")}>
    <DialogTrigger render={<Button variant="outline" />}><TicketIcon aria-hidden="true" />Invite Code</DialogTrigger>
    <DialogContent className="sm:max-w-sm">
      <DialogHeader><DialogTitle>Invite Code</DialogTitle><DialogDescription>Participants enter this code to find the event, then register while registration is open.</DialogDescription></DialogHeader>
      <Input aria-label="Event invite code" readOnly value={code} onFocus={e => e.target.select()} />
      <Button onClick={async () => { try { await navigator.clipboard.writeText(code); setMessage("Code copied."); } catch { setMessage("Select and copy the code above."); } }}>Copy Code</Button>
      <p role="status" className="min-h-5 text-sm text-muted-foreground">{message}</p>
    </DialogContent>
  </Dialog>;
}
