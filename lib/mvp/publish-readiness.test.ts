import { describe, expect, it } from "vitest";
import { publishReadiness } from "./publish-readiness";

const now = Date.parse("2026-10-16T00:00:00Z");
const complete = { description: "About", category_id: 1, venue: "Hall", starts_at: "2026-11-01T01:00:00Z", registration_opens_at: "2026-10-16T00:00:00Z", registration_closes_at: "2026-10-31T00:00:00Z", host_college_id: null };
const categories = [{ id: 1, is_active: true }, { id: 2, is_active: false }];

describe("publishReadiness", () => {
  it("is complete for an event publish_event would accept", () => expect(publishReadiness(complete, categories, [], now).every(i => i.done)).toBe(true));
  it("flags each publish_event requirement", () => {
    const missing = publishReadiness({ ...complete, description: " ", category_id: 2, venue: null, starts_at: "2026-10-15T00:00:00Z", registration_opens_at: null, registration_closes_at: null, host_college_id: 9 }, categories, [{ id: 9, is_active: false }], now);
    expect(missing.filter(i => !i.done).map(i => i.label)).toEqual(["Description", "Active category", "Venue", "Start date in the future", "Registration opening date", "Registration deadline", "Active host college"]);
  });
});
