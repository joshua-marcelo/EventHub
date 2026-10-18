export const SEARCH_DEBOUNCE_MS = 400;

/**
 * The next directory URL after a filter change. Changing search or college always returns to page 1
 * and drops the retired `profile` parameter. A one-character search counts as no search (the server
 * ignores it), so results never stay filtered by an older term. `null` means "no navigation needed".
 */
export function nextDirectoryUrl(pathname: string, current: string, changes: { q?: string; college?: string }) {
  const sp = new URLSearchParams(current);
  const before = sp.toString();
  if (changes.q !== undefined) {
    const q = changes.q.trim();
    if (q.length >= 2) sp.set("q", q); else sp.delete("q");
  }
  if (changes.college !== undefined) {
    if (changes.college) sp.set("college", changes.college); else sp.delete("college");
  }
  sp.delete("page");
  sp.delete("profile");
  const after = sp.toString();
  if (after === before) return null;
  return after ? `${pathname}?${after}` : pathname;
}

/** Trailing-edge debounce: only the last call within `ms` runs. `cancel` drops a pending call. */
export function createDebouncer<T extends unknown[]>(fn: (...args: T) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    call(...args: T) { clearTimeout(timer); timer = setTimeout(() => { timer = undefined; fn(...args); }, ms); },
    cancel() { clearTimeout(timer); timer = undefined; },
    get pending() { return timer !== undefined; },
  };
}
