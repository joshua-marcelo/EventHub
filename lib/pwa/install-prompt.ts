import { useSyncExternalStore } from "react";

/** Chromium's install prompt event; not in the DOM typings because it is non-standard. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/**
 * - `installed`: running as the installed app, or installed during this visit.
 * - `promptable`: the browser handed us a native install prompt.
 * - `manual`: no native prompt (iOS, Firefox, Safari, or criteria not met yet); show guidance.
 */
export type InstallState = "installed" | "promptable" | "manual";

export type InstallPlatform = "ios" | "safari-mac" | "firefox-android" | "firefox-desktop" | "android" | "desktop";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedThisVisit = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

// Listen as soon as this module loads on the client: `beforeinstallprompt` can fire before the
// hero hydrates, and it is not re-sent to late listeners.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", event => {
    // Defer Chromium's own mini-infobar; the prompt only opens when the user clicks Install App.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installedThisVisit = true;
    emit();
  });
}

const STANDALONE_QUERY = "(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)";

function isStandalone() {
  // `navigator.standalone` is iOS Safari's equivalent of the display-mode media query.
  return window.matchMedia(STANDALONE_QUERY).matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia(STANDALONE_QUERY);
  media.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", listener);
  };
}

function getSnapshot(): InstallState {
  if (installedThisVisit || isStandalone()) return "installed";
  return deferredPrompt ? "promptable" : "manual";
}

// The server cannot know; render the button and let the client hide it after hydration.
const getServerSnapshot = (): InstallState => "manual";

export function useInstallState() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Opens the native install prompt captured from `beforeinstallprompt`. The event is single-use,
 * so it is cleared either way; the browser fires a fresh one if installation is offered again.
 * Resolves to `unavailable` when there is no prompt to show. "accepted" means the user agreed,
 * not that installation finished; `appinstalled` confirms that.
 */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const prompt = deferredPrompt;
  if (!prompt) return "unavailable";
  deferredPrompt = null;
  emit();
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  return outcome;
}

/** Best-effort platform guess, only used to choose which manual instructions to show. */
export function detectInstallPlatform(): InstallPlatform {
  const ua = navigator.userAgent;
  // iPadOS reports a desktop Mac user agent; touch support tells them apart.
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return "ios";
  const android = /Android/.test(ua);
  if (/Firefox\//.test(ua)) return android ? "firefox-android" : "firefox-desktop";
  if (android) return "android";
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\//.test(ua)) return "safari-mac";
  return "desktop";
}
