import { describe, expect, it } from "vitest";
import { composeSchedule } from "./event-schedule";
import { eventSchema } from "@/lib/validation/mvp";

const base = { title: "QA schedule test", description: "", venue: "", category_id: "", host_college_id: "", starts_at: "", ends_at: "", registration_opens_at: "", registration_closes_at: "", capacity: "", approval_mode: "automatic", visibility: "public" };

describe("event schedule (start and end date/time)", () => {
  it("accepts a same-day event", () => {
    expect(composeSchedule({ start_date: "2026-11-10", start_time: "09:00", end_date: "2026-11-10", end_time: "12:30" })).toEqual({ starts_at: "2026-11-10T09:00", ends_at: "2026-11-10T12:30", errors: {} });
  });
  it("accepts an overnight event across midnight", () => {
    expect(composeSchedule({ start_date: "2026-11-10", start_time: "20:00", end_date: "2026-11-11", end_time: "02:00" }).errors).toEqual({});
  });
  it("accepts a multi-day event up to seven days, and refuses longer", () => {
    expect(composeSchedule({ start_date: "2026-11-10", start_time: "08:00", end_date: "2026-11-17", end_time: "08:00" }).errors).toEqual({});
    expect(composeSchedule({ start_date: "2026-11-10", start_time: "08:00", end_date: "2026-11-17", end_time: "08:01" }).errors).toEqual({ end_date: "An event can last at most 7 days." });
  });
  it("refuses an end before or equal to the start", () => {
    expect(composeSchedule({ start_date: "2026-11-10", start_time: "09:00", end_date: "2026-11-10", end_time: "08:59" }).errors).toEqual({ end_time: "The end must be after the start." });
    expect(composeSchedule({ start_date: "2026-11-10", start_time: "09:00", end_date: "2026-11-09", end_time: "23:00" }).errors).toEqual({ end_time: "The end must be after the start." });
    expect(composeSchedule({ start_date: "2026-11-10", start_time: "09:00", end_date: "2026-11-10", end_time: "09:00" }).errors.end_time).toBeDefined();
  });
  it("needs complete pairs but lets a draft leave the schedule empty or end-less", () => {
    expect(composeSchedule({ start_date: "", start_time: "", end_date: "", end_time: "" })).toEqual({ starts_at: "", ends_at: "", errors: {} });
    expect(composeSchedule({ start_date: "2026-11-10", start_time: "09:00", end_date: "", end_time: "" }).errors).toEqual({});
    expect(composeSchedule({ start_date: "2026-11-10", start_time: "", end_date: "", end_time: "" }).errors).toEqual({ start_time: "Choose the start time." });
    expect(composeSchedule({ start_date: "", start_time: "", end_date: "2026-11-10", end_time: "" }).errors).toEqual({ start_date: "Choose the start date.", start_time: "Choose the start time.", end_time: "Choose the end time." });
  });
  it("converts to the right instant in Philippine time through the server schema", () => {
    const { starts_at, ends_at } = composeSchedule({ start_date: "2026-11-10", start_time: "23:30", end_date: "2026-11-11", end_time: "00:30" });
    const v = eventSchema.parse({ ...base, starts_at, ends_at });
    expect(v.starts_at).toBe("2026-11-10T15:30:00.000Z");
    expect(v.ends_at).toBe("2026-11-10T16:30:00.000Z");
  });
});

describe("event description", () => {
  it("accepts a short non-empty description and treats blank as empty", () => {
    expect(eventSchema.parse({ ...base, description: "Quiz bee" }).description).toBe("Quiz bee");
    expect(eventSchema.parse({ ...base, description: "   " }).description).toBeNull();
  });
  it("keeps the 5000-character maximum", () => {
    expect(eventSchema.safeParse({ ...base, description: "x".repeat(5001) }).success).toBe(false);
  });
});
