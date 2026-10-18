/**
 * State for the typed-confirmation dialog used by high-impact admin actions. Kept pure so the
 * rules (exact phrase, required reason, one submission at a time, no closing mid-request) are
 * unit-tested without a DOM. The server action remains the authority; this only guards the UI.
 */
export const CONFIRM_PHRASE = "CONFIRM";

export type ConfirmState = { open: boolean; typed: string; reason: string; pending: boolean; error: string };
export type ConfirmEvent =
  | { type: "open" }
  | { type: "close" }
  | { type: "typed"; value: string }
  | { type: "reason"; value: string }
  | { type: "submit" }
  | { type: "failed"; error: string }
  | { type: "succeeded" };

export const initialConfirmState: ConfirmState = { open: false, typed: "", reason: "", pending: false, error: "" };

/** Exact, case-sensitive match: no trimming, so "confirm" or " CONFIRM" never pass. */
export function matchesPhrase(typed: string, phrase: string = CONFIRM_PHRASE) {
  return phrase.length > 0 && typed === phrase;
}

export function canSubmit(state: ConfirmState, { phrase = CONFIRM_PHRASE, reasonRequired = false }: { phrase?: string; reasonRequired?: boolean } = {}) {
  return state.open && !state.pending && matchesPhrase(state.typed, phrase) && (!reasonRequired || state.reason.trim().length > 0);
}

export function confirmReducer(state: ConfirmState, event: ConfirmEvent, options?: { phrase?: string; reasonRequired?: boolean }): ConfirmState {
  switch (event.type) {
    case "open": return { ...initialConfirmState, open: true };
    // A request in flight cannot be abandoned from the dialog; the result decides what happens next.
    case "close": return state.pending ? state : initialConfirmState;
    case "typed": return state.pending ? state : { ...state, typed: event.value, error: "" };
    case "reason": return state.pending ? state : { ...state, reason: event.value, error: "" };
    case "submit": return canSubmit(state, options) ? { ...state, pending: true, error: "" } : state;
    case "failed": return { ...state, pending: false, error: event.error };
    case "succeeded": return initialConfirmState;
  }
}
