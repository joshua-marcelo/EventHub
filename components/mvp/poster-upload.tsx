"use client";
import { useState,useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { savePoster } from "@/lib/mvp/actions";
export function PosterUpload({eventId,currentPath}:{eventId:string;currentPath:string|null}) {
  const [pending,start] = useTransition(); const [message,setMessage] = useState(""); const router = useRouter();
  return <form className="max-w-xl space-y-3 rounded-lg border p-4" action={form => start(async () => {
    const file = form.get("poster"); if (!(file instanceof File) || !file.size || file.size > 5242880 || !["image/jpeg","image/png","image/webp"].includes(file.type)) {setMessage("Use a JPG, PNG or WEBP under 5 MB.");return;}
    const ext = file.type.split("/")[1]; const path = `${eventId}/${crypto.randomUUID()}.${ext}`; const client = createClient();
    const {error} = await client.storage.from("event-banners").upload(path,file,{contentType:file.type,upsert:false}); if(error){setMessage("Poster upload failed.");return;}
    const r = await savePoster(eventId,path); setMessage(r.ok ? "Poster saved." : r.error);
    if(r.ok){if(currentPath) await client.storage.from("event-banners").remove([currentPath]);router.refresh();} else await client.storage.from("event-banners").remove([path]);
  })}><label className="block space-y-2"><span className="font-medium">Event poster</span><span className="block text-sm text-muted-foreground">Public image, visible on the campus calendar. Landscape images work best.</span><Input name="poster" type="file" accept="image/jpeg,image/png,image/webp" required /></label><Button type="submit" variant="outline" disabled={pending}>{pending ? "Uploading…" : "Save poster"}</Button>{message && <p role="status" className="text-sm">{message}</p>}</form>;
}
