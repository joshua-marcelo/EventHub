import { describe, expect, it } from "vitest";
import { registrationNote, registrationOpen } from "./registration-window";

// Wednesday Night regression: opens 3:10 PM PHT Oct 22, deadline 7:00 PM PHT Oct 23 (stored as UTC).
const opens = "2026-10-22T07:10:00+00:00";
const closes = "2026-10-23T11:00:00+00:00";
const at = (manila: string) => Date.parse(`${manila}+08:00`);

describe("participant registration window", () => {
  it("is open before a future deadline", () => {
    expect(registrationOpen(true, opens, closes, at("2026-10-22T15:25:00"))).toBe(true);
    expect(registrationNote(true, opens, closes, at("2026-10-22T15:25:00"))).toBe("Registration open");
  });

  it("closes once the deadline passes", () => {
    expect(registrationOpen(true, opens, closes, at("2026-10-23T19:01:00"))).toBe(false);
    expect(registrationNote(true, opens, closes, at("2026-10-23T19:01:00"))).toBe("Registration closed");
  });

  it("uses Philippine time boundaries: open until 6:59:59 PM, closed at 7:00 PM", () => {
    expect(registrationOpen(true, opens, closes, at("2026-10-23T18:59:59"))).toBe(true);
    expect(registrationOpen(true, opens, closes, at("2026-10-23T19:00:00"))).toBe(false);
    // 7:00 PM UTC on Oct 23 is already Oct 24 in Manila, so it must not count as before the deadline.
    expect(registrationOpen(true, opens, closes, Date.parse("2026-10-23T19:00:00Z"))).toBe(false);
  });

  it("is not open before the opening time and says when it opens", () => {
    expect(registrationOpen(true, opens, closes, at("2026-10-22T15:09:59"))).toBe(false);
    expect(registrationNote(true, opens, closes, at("2026-10-22T15:09:59"))).toBe("Registration opens Oct 22, 2026, 3:10 PM");
  });

  it("stays closed when registration is disabled, as when attendance starts", () => {
    expect(registrationOpen(false, opens, closes, at("2026-10-22T15:25:00"))).toBe(false);
    expect(registrationNote(false, opens, closes, at("2026-10-22T15:25:00"))).toBe("Registration closed");
  });

  it("fails closed when the lifecycle column is missing or dates are unset", () => {
    expect(registrationOpen(undefined, opens, closes, at("2026-10-22T15:25:00"))).toBe(false);
    expect(registrationOpen(true, null, closes, at("2026-10-22T15:25:00"))).toBe(false);
    expect(registrationOpen(true, opens, null, at("2026-10-22T15:25:00"))).toBe(false);
  });
});
