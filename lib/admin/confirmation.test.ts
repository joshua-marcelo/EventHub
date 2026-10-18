import { describe, expect, it } from "vitest";

import { CONFIRM_PHRASE, canSubmit, confirmReducer, initialConfirmState, matchesPhrase, type ConfirmEvent, type ConfirmState } from "./confirmation";

const options = { reasonRequired: true };
const run = (...events: ConfirmEvent[]) => events.reduce<ConfirmState>((s, e) => confirmReducer(s, e, options), initialConfirmState);

describe("typed confirmation", () => {
  it("accepts only the exact, case-sensitive phrase", () => {
    expect(matchesPhrase("CONFIRM")).toBe(true);
    for (const typed of ["", "confirm", "Confirm", " CONFIRM", "CONFIRM ", "CONFIRMED", "CONFIR"]) expect(matchesPhrase(typed)).toBe(false);
    expect(matchesPhrase("jane@example.test", "jane@example.test")).toBe(true);
    expect(matchesPhrase("", "")).toBe(false);
  });

  it("accepts each action's keyword only for that action", () => {
    const keywords = ["SUSPEND", "REVOKE", "REINSTATE"];
    for (const phrase of keywords) {
      const ready = (typed: string) => canSubmit(run({ type: "open" }, { type: "reason", value: "Reason" }, { type: "typed", value: typed }), { phrase, reasonRequired: true });
      expect(ready(phrase)).toBe(true);
      for (const other of [...keywords.filter(k => k !== phrase), CONFIRM_PHRASE, phrase.toLowerCase(), `${phrase} `]) expect(ready(other)).toBe(false);
    }
  });

  it("keeps the action disabled until the phrase and a required reason are both present", () => {
    expect(canSubmit(run({ type: "open" }), options)).toBe(false);
    expect(canSubmit(run({ type: "open" }, { type: "typed", value: CONFIRM_PHRASE }), options)).toBe(false);
    expect(canSubmit(run({ type: "open" }, { type: "typed", value: CONFIRM_PHRASE }, { type: "reason", value: "   " }), options)).toBe(false);
    expect(canSubmit(run({ type: "open" }, { type: "reason", value: "Policy breach" }, { type: "typed", value: "confirm" }), options)).toBe(false);
    expect(canSubmit(run({ type: "open" }, { type: "reason", value: "Policy breach" }, { type: "typed", value: CONFIRM_PHRASE }), options)).toBe(true);
    expect(canSubmit({ ...initialConfirmState, typed: CONFIRM_PHRASE, reason: "x" }, options)).toBe(false);
  });

  it("ignores a submit that does not satisfy the confirmation", () => {
    const state = run({ type: "open" }, { type: "typed", value: "CONFIRM " }, { type: "reason", value: "Reason" }, { type: "submit" });
    expect(state.pending).toBe(false);
  });

  it("prevents double submission and edits while a request is in flight", () => {
    const pending = run({ type: "open" }, { type: "reason", value: "Reason" }, { type: "typed", value: CONFIRM_PHRASE }, { type: "submit" });
    expect(pending.pending).toBe(true);
    expect(canSubmit(pending, options)).toBe(false);
    expect(confirmReducer(pending, { type: "submit" }, options)).toBe(pending);
    expect(confirmReducer(pending, { type: "typed", value: "" }, options)).toBe(pending);
    expect(confirmReducer(pending, { type: "close" }, options)).toBe(pending);
  });

  it("cancel clears the typed phrase, reason and error so a reopened dialog starts locked", () => {
    const failed = run({ type: "open" }, { type: "reason", value: "Reason" }, { type: "typed", value: CONFIRM_PHRASE }, { type: "submit" }, { type: "failed", error: "Not permitted" });
    expect(failed).toMatchObject({ open: true, pending: false, error: "Not permitted", typed: CONFIRM_PHRASE });
    const cancelled = confirmReducer(failed, { type: "close" }, options);
    expect(cancelled).toEqual(initialConfirmState);
    expect(canSubmit(confirmReducer(cancelled, { type: "open" }, options), options)).toBe(false);
  });

  it("re-enables retry after a server refusal and resets after success", () => {
    const failed = run({ type: "open" }, { type: "reason", value: "Reason" }, { type: "typed", value: CONFIRM_PHRASE }, { type: "submit" }, { type: "failed", error: "Try again" });
    expect(canSubmit(failed, options)).toBe(true);
    expect(confirmReducer(failed, { type: "succeeded" }, options)).toEqual(initialConfirmState);
  });
});
