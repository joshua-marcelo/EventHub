import { TZDate, tz } from "@date-fns/tz"
import { format } from "date-fns"

/**
 * EventHub always displays and interprets wall-clock times in Philippine time,
 * regardless of the server (Vercel runs in UTC) or the viewer's device zone.
 */
export const APP_TIME_ZONE = "Asia/Manila"

const inManila = tz(APP_TIME_ZONE)

type DateInput = Date | string | number

function toDate(value: DateInput): Date {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid date value: ${String(value)}`)
  }
  return date
}

/** Format any instant in Asia/Manila using a date-fns pattern. */
export function formatInManila(value: DateInput, pattern: string): string {
  return format(toDate(value), pattern, { in: inManila })
}

/** "October 10, 2026" */
export function formatDate(value: DateInput): string {
  return formatInManila(value, "MMMM d, yyyy")
}

/** "9:00 AM" */
export function formatTime(value: DateInput): string {
  return formatInManila(value, "h:mm a")
}

/** "Oct 10, 2026, 9:00 AM" */
export function formatDateTime(value: DateInput): string {
  return formatInManila(value, "MMM d, yyyy, h:mm a")
}

/** Value for an `<input type="date">` showing the Manila calendar date. */
export function toManilaDateInput(value: DateInput): string {
  return formatInManila(value, "yyyy-MM-dd")
}

/** Value for an `<input type="time">` showing the Manila wall-clock time. */
export function toManilaTimeInput(value: DateInput): string {
  return formatInManila(value, "HH:mm")
}

const DATE_INPUT = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_INPUT = /^([01]\d|2[0-3]):([0-5]\d)$/

/**
 * Combine a date ("yyyy-MM-dd") and time ("HH:mm") entered by a user as
 * Manila wall-clock time into an absolute instant.
 */
export function combineManilaDateTime(date: string, time: string): Date {
  const d = DATE_INPUT.exec(date)
  const t = TIME_INPUT.exec(time)
  if (!d || !t) {
    throw new RangeError(`Invalid date/time input: ${date} ${time}`)
  }
  const [year, month, day] = [Number(d[1]), Number(d[2]), Number(d[3])]
  const result = new TZDate(year, month - 1, day, Number(t[1]), Number(t[2]), APP_TIME_ZONE)
  // Reject overflow such as 2026-02-31 silently rolling into March.
  if (toManilaDateInput(result) !== date) {
    throw new RangeError(`Invalid calendar date: ${date}`)
  }
  return new Date(result.getTime())
}
