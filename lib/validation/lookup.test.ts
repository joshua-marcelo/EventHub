import { describe, expect, it } from "vitest";
import { lookupSchema } from "./lookup";
const college = { kind: "colleges", id: null, name: "College of Computing", code: "CCS", is_active: true };
describe("lookup input", () => {
  it("trims names and codes", () => expect(lookupSchema.parse({ ...college, name: "  Computing  " }).name).toBe("Computing"));
  it.each(["bad", "A", "HAS SPACE", "A".repeat(16)])("rejects college code %s", code => expect(lookupSchema.safeParse({ ...college, code }).success).toBe(false));
  it("requires a persisted college for programs", () => expect(lookupSchema.safeParse({ kind: "programs", id: null, name: "Computer Science", college_id: 0, is_active: true }).success).toBe(false));
  it.each(["Uppercase", "double--dash", "-leading", "with space"])("rejects category slug %s", slug => expect(lookupSchema.safeParse({ kind: "event_categories", id: null, name: "Seminar", slug, sort_order: 0, is_active: true }).success).toBe(false));
  it("limits sort order to smallint and requires boolean active", () => {
    expect(lookupSchema.safeParse({ kind: "event_categories", id: null, name: "Seminar", slug: "seminar", sort_order: 32768, is_active: true }).success).toBe(false);
    expect(lookupSchema.safeParse({ ...college, is_active: "true" }).success).toBe(false);
  });
  it("ignores extra role fields and refuses unknown kinds", () => {
    expect(lookupSchema.parse({ ...college, is_admin: true })).not.toHaveProperty("is_admin");
    expect(lookupSchema.safeParse({ ...college, kind: "profiles" }).success).toBe(false);
  });
});
