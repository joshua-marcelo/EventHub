"use client";

import { useEffect } from "react";

// Imported for its side effect: start listening for `beforeinstallprompt` on every page.
import "@/lib/pwa/install-prompt";

/** Registers /sw.js in production builds. Development keeps plain network behavior for HMR. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    // `updateViaCache: "none"` makes the browser check for a new worker on every navigation.
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(error => {
      console.warn("Service worker registration failed.", error);
    });
  }, []);

  return null;
}
