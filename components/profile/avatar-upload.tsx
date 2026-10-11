"use client";

import { CameraIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { FormAlert } from "@/components/forms/form-alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { setAvatar } from "@/lib/profile/actions";
import {
  AVATAR_INPUT_TYPES,
  AVATAR_MAX_BYTES,
  AVATAR_MAX_INPUT_BYTES,
  resizeAvatar,
} from "@/lib/profile/resize-image";
import { createClient } from "@/lib/supabase/client";

export function AvatarUpload({
  userId,
  currentUrl,
  initials,
}: {
  userId: string;
  currentUrl: string | null;
  initials: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const onFile = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!AVATAR_INPUT_TYPES.includes(file.type)) {
      setError("Use a JPG, PNG or WEBP photo.");
      return;
    }
    if (file.size > AVATAR_MAX_INPUT_BYTES) {
      setError("This photo is too large. Use one under 15 MB.");
      return;
    }

    startTransition(async () => {
      try {
        const { blob, extension } = await resizeAvatar(file);
        if (blob.size > AVATAR_MAX_BYTES) {
          setError("This photo is still too large after resizing. Try another one.");
          return;
        }
        const path = `${userId}/${crypto.randomUUID()}.${extension}`;
        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, blob, { contentType: blob.type, upsert: false });
        if (uploadError) {
          setError("The photo could not be uploaded. Try again.");
          return;
        }
        const result = await setAvatar(path);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setPreview(URL.createObjectURL(blob));
        toast.success("Photo saved.");
        router.refresh();
      } catch {
        setError("The photo could not be processed. Try a different file.");
      } finally {
        if (input.current) input.current.value = "";
      }
    });
  };

  const src = preview ?? currentUrl ?? undefined;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <Avatar className="size-20">
          {src ? <AvatarImage src={src} alt="Your profile photo" /> : null}
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={pending}>
            <CameraIcon data-icon="inline-start" />
            {pending ? "Uploading…" : src ? "Change photo" : "Add photo"}
          </Button>
          <p className="text-xs text-muted-foreground">
            A clear photo of your face. Organizers use it to recognize you at events.
          </p>
        </div>
        <input
          ref={input}
          type="file"
          accept={AVATAR_INPUT_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
      {error ? <FormAlert>{error}</FormAlert> : null}
    </div>
  );
}
