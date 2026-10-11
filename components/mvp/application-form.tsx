"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitApplication } from "@/lib/mvp/actions";
import { createClient } from "@/lib/supabase/client";
import { documentTypes, documentMaxBytes } from "@/lib/validation/mvp";

export function ApplicationForm({ userId }: { userId: string }) {
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return <form className="max-w-xl space-y-4" onSubmit={e => {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    start(async () => {
      setMessage("");
      try {
        const client = createClient(); const paths: Record<string,string> = {};
        for (const key of ["proof", "supporting"]) {
          const file = form.get(key);
          if (!(file instanceof File) || file.size === 0) { if (key === "proof") throw new Error("Proof of authorization is required."); continue; }
          if (!documentTypes.includes(file.type) || file.size > documentMaxBytes) throw new Error("Use PDF, JPG or PNG files under 5 MB.");
          const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
          const path = `${userId}/${crypto.randomUUID()}.${ext}`;
          const { error } = await client.storage.from("organizer-requirements").upload(path, file, { upsert: false, contentType: file.type });
          if (error) throw new Error("Document upload failed. Try again."); paths[key] = path;
        }
        const r = await submitApplication({ organization_name: form.get("organization_name"),position_title: form.get("position_title"),contact_number: form.get("contact_number"),reason: form.get("reason"),proof_document_path: paths.proof,supporting_document_path: paths.supporting,consent: form.get("consent") === "on" });
        setMessage(r.ok ? "Application submitted. An administrator will review it." : r.error + (r.fieldErrors ? ` ${Object.values(r.fieldErrors).join(" ")}` : ""));
        if (r.ok) router.refresh();
      } catch (error) { setMessage(error instanceof Error ? error.message : "Could not submit application."); }
    });
  }}>
    <label className="block space-y-1"><span>Organization / council</span><Input name="organization_name" required minLength={3} maxLength={150} /></label>
    <label className="block space-y-1"><span>Your position</span><Input name="position_title" required minLength={2} maxLength={100} /></label>
    <label className="block space-y-1"><span>Contact number</span><Input name="contact_number" type="tel" required placeholder="09xxxxxxxxx" /></label>
    <label className="block space-y-1"><span>Reason for applying</span><Textarea name="reason" required minLength={50} maxLength={1000} /></label>
    <p className="text-sm text-muted-foreground">Upload proof of appointment or authorization. PDF, JPG or PNG; maximum 5 MB each. Only you and administrators can read these documents.</p>
    <label className="block space-y-1"><span>Proof of authorization</span><Input name="proof" type="file" accept="application/pdf,image/jpeg,image/png" required /></label>
    <label className="block space-y-1"><span>Supporting document (optional)</span><Input name="supporting" type="file" accept="application/pdf,image/jpeg,image/png" /></label>
    <label className="flex items-start gap-2"><input name="consent" type="checkbox" required /><span>I consent to application review under the <Link href="/privacy" className="underline">privacy notice</Link>.</span></label>
    <Button type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit application"}</Button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </form>;
}
