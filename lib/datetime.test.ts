import { afterEach, describe, expect, it } from "vitest"

import {
  combineManilaDateTime,
  formatDate,
  formatDateTime,
  formatTime,
  toManilaDateInput,
  toManilaTimeInput,
} from "./datetime"

const originalTz = process.env.TZ

afterEach(() => {
  process.env.TZ = originalTz
})

describe.each(["UTC", "America/Los_Angeles", "Asia/Manila"])(
  "with server time zone %s",
  (serverTz) => {
    it("formats instants in Manila time", () => {
      process.env.TZ = serverTz
      // 01:00 UTC is 09:00 in Manila (UTC+8).
      const instant = new Date("2026-10-10T01:00:00Z")
      expect(formatDate(instant)).toBe("October 10, 2026")
      expect(formatTime(instant)).toBe("9:00 AM")
      expect(formatDateTime(instant)).toBe("Oct 10, 2026, 9:00 AM")
    })

    it("uses the Manila calendar day near midnight UTC", () => {
      process.env.TZ = serverTz
      // 20:30 UTC on Oct 9 is already 04:30 on Oct 10 in Manila.
      const instant = new Date("2026-10-09T20:30:00Z")
      expect(toManilaDateInput(instant)).toBe("2026-10-10")
      expect(toManilaTimeInput(instant)).toBe("04:30")
    })

    it("combines Manila wall-clock input into the right instant", () => {
      process.env.TZ = serverTz
      const instant = combineManilaDateTime("2026-10-10", "09:00")
      expect(instant.toISOString()).toBe("2026-10-10T01:00:00.000Z")
    })
  },
)

describe("combineManilaDateTime", () => {
  it("round-trips through the input helpers", () => {
    const instant = combineManilaDateTime("2026-12-31", "23:45")
    expect(toManilaDateInput(instant)).toBe("2026-12-31")
    expect(toManilaTimeInput(instant)).toBe("23:45")
  })

  it.each([
    ["2026-02-31", "10:00"],
    ["2026-13-01", "10:00"],
    ["2026-10-10", "24:00"],
    ["10/10/2026", "10:00"],
    ["2026-10-10", "9:00"],
  ])("rejects invalid input %s %s", (date, time) => {
    expect(() => combineManilaDateTime(date, time)).toThrow(RangeError)
  })
})

describe("formatters", () => {
  it("accept ISO strings from the database", () => {
    expect(formatDate("2026-10-10T01:00:00+00:00")).toBe("October 10, 2026")
  })

  it("throw on invalid values", () => {
    expect(() => formatDate("not a date")).toThrow(RangeError)
  })
})

import { formatEventSchedule } from "./datetime";
describe("event schedule display", () => {
  it("shows only the end time on the same Manila day, and the full end otherwise", () => {
    expect(formatEventSchedule("2026-11-10T01:00:00Z", "2026-11-10T04:30:00Z")).toBe("Nov 10, 2026, 9:00 AM – 12:30 PM");
    // 15:30Z is 11:30 PM Manila; 16:30Z is 12:30 AM the next Manila day.
    expect(formatEventSchedule("2026-11-10T15:30:00Z", "2026-11-10T16:30:00Z")).toBe("Nov 10, 2026, 11:30 PM – Nov 11, 2026, 12:30 AM");
    expect(formatEventSchedule("2026-11-10T01:00:00Z", null)).toBe("Nov 10, 2026, 9:00 AM");
  });
});
