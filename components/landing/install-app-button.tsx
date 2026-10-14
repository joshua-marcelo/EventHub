"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Download, EllipsisVertical, Share, SquarePlus } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { detectInstallPlatform, promptInstall, useInstallState, type InstallPlatform } from "@/lib/pwa/install-prompt";
import { cn } from "@/lib/utils";

const guides: Record<InstallPlatform, { title: string; steps: ReactNode[]; note?: string }> = {
  ios: {
    title: "Add EventHub to your Home Screen",
    steps: [
      <>Tap the <strong>Share</strong> button <Share className="inline size-4 align-[-2px]" aria-label="Share icon" />.</>,
      <>Scroll down and tap <strong>Add to Home Screen</strong> <SquarePlus className="inline size-4 align-[-2px]" aria-label="Add icon" />.</>,
      <>Tap <strong>Add</strong>.</>,
    ],
    note: "In Safari the Share button is in the toolbar; in other browsers it may be in the address bar or menu.",
  },
  "safari-mac": {
    title: "Add EventHub to your Dock",
    steps: [<>In the menu bar, choose <strong>File</strong> → <strong>Add to Dock</strong>.</>, <>Click <strong>Add</strong>.</>],
    note: "Requires Safari 17 or later on macOS Sonoma.",
  },
  android: {
    title: "Install EventHub",
    steps: [
      <>Open the browser menu <EllipsisVertical className="inline size-4 align-[-2px]" aria-label="Menu icon" />.</>,
      <>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</>,
    ],
  },
  "firefox-android": {
    title: "Install EventHub",
    steps: [
      <>Open the Firefox menu <EllipsisVertical className="inline size-4 align-[-2px]" aria-label="Menu icon" />.</>,
      <>Tap <strong>Add app to Home screen</strong> or <strong>Install</strong>.</>,
    ],
  },
  "firefox-desktop": {
    title: "Install EventHub",
    steps: [<>Firefox on desktop doesn’t support installing web apps.</>, <>Open EventHub in <strong>Chrome</strong> or <strong>Edge</strong>, then select <strong>Install App</strong>.</>],
  },
  desktop: {
    title: "Install EventHub",
    steps: [
      <>Select the install icon at the right end of the address bar, if shown.</>,
      <>Or open the browser menu and choose <strong>Install EventHub</strong> (Chrome: <strong>Cast, save, and share</strong>; Edge: <strong>Apps</strong>).</>,
    ],
    note: "If neither option appears, EventHub may already be installed, or this browser doesn’t support installing web apps.",
  },
};

/**
 * Secondary hero CTA. Uses the browser's native install prompt where one was offered
 * (Chromium), otherwise shows platform-specific instructions. Hidden once running installed.
 */
export function InstallAppButton({ className }: { className?: string }) {
  const state = useInstallState();
  const [platform, setPlatform] = useState<InstallPlatform>("desktop");
  const [guideOpen, setGuideOpen] = useState(false);
  const accepted = useRef(false);

  // Only `appinstalled` confirms installation; accepting the prompt alone does not.
  useEffect(() => {
    if (state === "installed" && accepted.current) {
      accepted.current = false;
      toast.success("EventHub is installed. Open it from your home screen or app list.");
    }
  }, [state]);

  if (state === "installed") return null;

  async function install() {
    if (state === "promptable") {
      const outcome = await promptInstall();
      if (outcome === "accepted") accepted.current = true;
      if (outcome !== "unavailable") return;
    }
    setPlatform(detectInstallPlatform());
    setGuideOpen(true);
  }

  const content = guides[platform];

  return (
    <>
      {/* The CSS media query hides the button before hydration when already running installed. */}
      <button type="button" onClick={install} className={cn("[@media(display-mode:standalone)]:hidden", className)}>
        <Download className="size-[18px]" aria-hidden="true" />
        Install App
      </button>
      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="gap-5 p-5 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold tracking-tight">{content.title}</DialogTitle>
            <DialogDescription>Use EventHub like an app, right from your device.</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm leading-relaxed text-slate-700">
            {content.steps.map((step, index) => (
              <li key={index} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-stone-300 text-xs font-semibold tabular-nums text-orange-800">{index + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          {content.note && <p className="text-xs leading-relaxed text-slate-500">{content.note}</p>}
          <DialogFooter className="-mx-5 -mb-5 p-4" showCloseButton />
        </DialogContent>
      </Dialog>
    </>
  );
}
