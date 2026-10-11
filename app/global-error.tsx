"use client";
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body><main style={{ maxWidth: 640, margin: "4rem auto", padding: 24, fontFamily: "system-ui" }}><h1>Something went wrong</h1><p>EventHub couldn’t load. Try again in a moment.</p><button onClick={reset}>Try again</button></main></body></html>;
}
