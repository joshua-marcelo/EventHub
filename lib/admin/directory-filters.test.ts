import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SEARCH_DEBOUNCE_MS, createDebouncer, nextDirectoryUrl } from "./directory-filters";

describe("directory URL synchronization", () => {
  const path = "/admin/users";
  it("resets to page 1 and drops the retired profile filter on any change", () => {
    expect(nextDirectoryUrl(path, "?q=ann&college=4&profile=complete&page=3", { q: "anna" })).toBe("/admin/users?q=anna&college=4");
    expect(nextDirectoryUrl(path, "?q=ann&page=2", { college: "7" })).toBe("/admin/users?q=ann&college=7");
  });
  it("clears search and college back to the plain directory", () => {
    expect(nextDirectoryUrl(path, "?q=ann&college=4&page=2", { q: "", college: "" })).toBe("/admin/users");
  });
  it("treats a one-character search as no search so old results never linger", () => {
    expect(nextDirectoryUrl(path, "?q=an", { q: "a" })).toBe("/admin/users");
  });
  it("skips navigation when nothing changes (no extra request or history entry)", () => {
    expect(nextDirectoryUrl(path, "?q=ann", { q: " ann " })).toBeNull();
    expect(nextDirectoryUrl(path, "", { q: "" })).toBeNull();
  });
});

describe("search debounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("waits 400ms after the last keystroke and sends only the latest value", () => {
    const fn = vi.fn();
    const d = createDebouncer(fn, SEARCH_DEBOUNCE_MS);
    d.call("a"); vi.advanceTimersByTime(200);
    d.call("an"); vi.advanceTimersByTime(399);
    expect(fn).not.toHaveBeenCalled();
    expect(d.pending).toBe(true);
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledExactlyOnceWith("an");
    expect(d.pending).toBe(false);
    expect(SEARCH_DEBOUNCE_MS).toBe(400);
  });

  it("cancel drops a pending search (college change or clear applies immediately instead)", () => {
    const fn = vi.fn();
    const d = createDebouncer(fn, SEARCH_DEBOUNCE_MS);
    d.call("ann"); d.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });
});
