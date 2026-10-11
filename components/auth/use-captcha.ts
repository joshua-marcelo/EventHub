"use client";

import { useState } from "react";

import { captchaEnabled } from "./turnstile";

/**
 * Turnstile token state for a form. Pass `widgetProps` to <Turnstile />. `ready` is false while
 * a required token is missing. Tokens are single-use, so call `reset()` after every submission.
 */
export function useCaptcha() {
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  return {
    token: token ?? undefined,
    ready: !captchaEnabled || token !== null,
    reset: () => {
      setToken(null);
      setResetKey((k) => k + 1);
    },
    widgetProps: { onToken: setToken, resetKey },
  };
}
