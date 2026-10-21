"use client";

import { createContext, use, useEffect, useState, type ReactNode } from "react";

export type CurrentEvent = { id: string; title: string };
const CurrentEventContext = createContext<{ event: CurrentEvent | null; setEvent: (event: CurrentEvent | null) => void }>({ event: null, setEvent: () => {} });

/** Lets the event workspace tell the shell sidebar which event is open, without a second data fetch. */
export function CurrentEventProvider({ children }: { children: ReactNode }) {
  const [event, setEvent] = useState<CurrentEvent | null>(null);
  return <CurrentEventContext value={{ event, setEvent }}>{children}</CurrentEventContext>;
}

export function useCurrentEvent() { return use(CurrentEventContext).event; }

/**
 * Rendered by the event workspace layout only after getOwnedEvent() has confirmed ownership on the
 * server, so the sidebar's My Events only ever adds an authorized event.
 */
export function CurrentEventRegistrar({ id, title }: CurrentEvent) {
  const { setEvent } = use(CurrentEventContext);
  useEffect(() => { setEvent({ id, title }); return () => setEvent(null); }, [id, title, setEvent]);
  return null;
}
