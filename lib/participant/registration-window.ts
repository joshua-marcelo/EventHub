import { formatDateTime } from "@/lib/datetime";

/** The same window register_for_event enforces; capacity is checked when registering. */
export function registrationOpen(enabled: boolean | undefined, opens: string | null, closes: string | null, now: number) {
  return Boolean(enabled && opens && closes && now >= Date.parse(opens) && now < Date.parse(closes));
}

export function registrationNote(enabled: boolean | undefined, opens: string | null, closes: string | null, now: number) {
  if (registrationOpen(enabled, opens, closes, now)) return "Registration open";
  if (enabled && opens && now < Date.parse(opens)) return `Registration opens ${formatDateTime(opens)}`;
  return "Registration closed";
}
