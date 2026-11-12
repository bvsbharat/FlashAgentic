export type CheckoutIntent = "open" | "confirm" | "cancel";

export type CheckoutCue = {
  intent: CheckoutIntent;
  /** Index of the first token in the phrase. */
  start: number;
  /** Index just past the last token in the phrase. */
  end: number;
};

/**
 * Open the checkout modal. Longer phrases are listed first so
 * "I want to place this order" is one open cue, not a confirm.
 * "place the order" is intentionally absent: that phrase completes.
 */
const OPEN_PHRASES: readonly (readonly string[])[] = [
  ["i", "am", "ready", "to", "place", "this", "order"],
  ["im", "ready", "to", "place", "this", "order"],
  ["i", "want", "to", "place", "this", "order"],
  ["id", "like", "to", "place", "this", "order"],
  ["let", "me", "place", "this", "order"],
  ["i", "am", "ready", "to", "check", "out"],
  ["i", "am", "ready", "to", "checkout"],
  ["im", "ready", "to", "check", "out"],
  ["im", "ready", "to", "checkout"],
  ["id", "like", "to", "check", "out"],
  ["id", "like", "to", "checkout"],
  ["i", "want", "to", "check", "out"],
  ["i", "want", "to", "checkout"],
  ["let", "me", "check", "out"],
  ["let", "me", "checkout"],
  ["lets", "check", "out"],
  ["lets", "checkout"],
  ["ready", "to", "check", "out"],
  ["ready", "to", "checkout"],
];

/** Complete an open checkout. Bare "place the order" is confirm, not open. */
const CONFIRM_PHRASES: readonly (readonly string[])[] = [
  ["yes", "place", "it"],
  ["place", "the", "order"],
  ["place", "my", "order"],
  ["confirm", "the", "order"],
  ["confirm", "my", "order"],
  ["yes", "confirm"],
  ["place", "it"],
  ["confirm", "it"],
  ["confirm", "order"],
];

const CANCEL_PHRASES: readonly (readonly string[])[] = [
  ["cancel", "check", "out"],
  ["cancel", "checkout"],
  ["close", "check", "out"],
  ["close", "checkout"],
  ["never", "mind"],
  ["go", "back"],
  ["nevermind"],
  ["close", "it"],
  ["close", "this"],
];

const OPEN_SORTED = [...OPEN_PHRASES].sort((a, b) => b.length - a.length);
const CONFIRM_SORTED = [...CONFIRM_PHRASES].sort((a, b) => b.length - a.length);
const CANCEL_SORTED = [...CANCEL_PHRASES].sort((a, b) => b.length - a.length);

/** Words that mean "cancel" is removing a drink, not leaving checkout. */
const REMOVE_FOLLOW = new Set([
  "the",
  "that",
  "this",
  "my",
  "a",
  "an",
  "it",
  "one",
  "ones",
  "those",
  "these",
  "other",
  "latte",
  "lattes",
  "matcha",
  "matchas",
  "cappuccino",
  "cappuccinos",
  "small",
  "tall",
  "medium",
  "grande",
  "large",
  "big",
  "venti",
  "iced",
  "ice",
  "hot",
  "cold",
]);

function startsWithPhrase(tokens: string[], index: number, phrase: readonly string[]): boolean {
  for (let offset = 0; offset < phrase.length; offset += 1) {
    if (tokens[index + offset] !== phrase[offset]) return false;
  }
  return true;
}

function phraseSpan(tokens: string[], index: number, phrases: readonly (readonly string[])[]): number {
  for (const phrase of phrases) {
    if (startsWithPhrase(tokens, index, phrase)) return phrase.length;
  }
  return 0;
}

function confirmSpan(tokens: string[], index: number): number {
  const longer = phraseSpan(tokens, index, CONFIRM_SORTED);
  if (longer > 0) return longer;
  if (tokens[index] !== "confirm") return 0;
  const next = tokens[index + 1];
  if (next === "the" || next === "that" || next === "this" || next === "my" || next === "a" || next === "an") return 0;
  return 1;
}

function cancelSpan(tokens: string[], index: number): number {
  const phrase = phraseSpan(tokens, index, CANCEL_SORTED);
  if (phrase > 0) return phrase;
  if (tokens[index] === "cancel") {
    const next = tokens[index + 1];
    if (next && REMOVE_FOLLOW.has(next)) return 0;
    return 1;
  }
  if (tokens[index] === "close") {
    const next = tokens[index + 1];
    if (!next || next === "please") return 1;
  }
  return 0;
}

/** Tokens that are checkout controls, so the drink parser does not read them as items. */
export function orderControlSpan(tokens: string[], index: number): number {
  const open = phraseSpan(tokens, index, OPEN_SORTED);
  if (open > 0) return open;
  return confirmSpan(tokens, index);
}

export function checkoutCuesFromTokens(tokens: string[]): CheckoutCue[] {
  const cues: CheckoutCue[] = [];
  let index = 0;
  while (index < tokens.length) {
    const open = phraseSpan(tokens, index, OPEN_SORTED);
    if (open > 0) {
      cues.push({ intent: "open", start: index, end: index + open });
      index += open;
      continue;
    }
    const confirm = confirmSpan(tokens, index);
    if (confirm > 0) {
      cues.push({ intent: "confirm", start: index, end: index + confirm });
      index += confirm;
      continue;
    }
    const cancel = cancelSpan(tokens, index);
    if (cancel > 0) {
      cues.push({ intent: "cancel", start: index, end: index + cancel });
      index += cancel;
      continue;
    }
    index += 1;
  }
  return cues;
}
