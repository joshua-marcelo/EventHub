/**
 * The event form's Start date/time and End date/time → the `starts_at` / `ends_at` values the
 * server schema accepts ("YYYY-MM-DDTHH:mm", Philippine time; the server converts to UTC). Dates
 * are separate so overnight and multi-day events need no midnight arithmetic. The 7-day limit mirrors
 * the events table constraint. Only called on submit, so nothing is reported while typing.
 */
export type ScheduleFields = { start_date: string; start_time: string; end_date: string; end_time: string };
export const MAX_EVENT_DAYS = 7;

export function composeSchedule(f: ScheduleFields): { starts_at: string; ends_at: string; errors: Partial<Record<keyof ScheduleFields, string>> } {
  const errors: Partial<Record<keyof ScheduleFields, string>> = {};
  const anyStart = Boolean(f.start_date || f.start_time), anyEnd = Boolean(f.end_date || f.end_time);
  if (anyStart || anyEnd) {
    if (!f.start_date) errors.start_date = "Choose the start date.";
    if (!f.start_time) errors.start_time = "Choose the start time.";
  }
  if (anyEnd) {
    if (!f.end_date) errors.end_date = "Choose the end date.";
    if (!f.end_time) errors.end_time = "Choose the end time.";
  }
  const starts_at = f.start_date && f.start_time ? `${f.start_date}T${f.start_time}` : "";
  const ends_at = f.end_date && f.end_time ? `${f.end_date}T${f.end_time}` : "";
  if (starts_at && ends_at && !errors.end_date && !errors.end_time) {
    // Same-zone local wall times: compare them as if they were UTC.
    const minutes = (Date.parse(`${ends_at}:00Z`) - Date.parse(`${starts_at}:00Z`)) / 60_000;
    if (!(minutes > 0)) errors.end_time = "The end must be after the start.";
    else if (minutes > MAX_EVENT_DAYS * 24 * 60) errors.end_date = `An event can last at most ${MAX_EVENT_DAYS} days.`;
  }
  return { starts_at, ends_at, errors };
}
