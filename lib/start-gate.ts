import type { DrinkType, Milk, Size, Temp } from "./types";

/** Menu values the counter can actually draw and the parser can apply. */
export const MENU_TYPES = ["matcha", "cappuccino", "latte"] as const satisfies readonly DrinkType[];
export const MENU_SIZES = ["Tall", "Grande", "Venti"] as const satisfies readonly Size[];
export const MENU_MILKS = ["Whole", "Oat", "Almond", "Skim"] as const satisfies readonly Milk[];
export const MENU_TEMPS = ["Hot", "Iced"] as const satisfies readonly Temp[];
export const MENU_SHOTS = [1, 2, 3] as const;

export type OrderHint = {
  type: (typeof MENU_TYPES)[number];
  size?: (typeof MENU_SIZES)[number];
  shots?: (typeof MENU_SHOTS)[number];
  milk?: (typeof MENU_MILKS)[number];
  temp?: (typeof MENU_TEMPS)[number];
};

/** Spoken examples built only from the menu above. */
export const ORDER_HINTS: readonly OrderHint[] = [
  { size: "Grande", temp: "Iced", type: "matcha", milk: "Oat" },
  { shots: 2, temp: "Hot", type: "latte", milk: "Whole" },
  { size: "Tall", type: "cappuccino", milk: "Almond" },
];

const SHOT_WORDS = ["one", "two", "three"] as const;

export function hintLine(hint: OrderHint): string {
  const temp = hint.temp === "Iced" ? "iced " : hint.temp === "Hot" ? "hot " : "";
  const milk = hint.milk ? ` with ${hint.milk.toLowerCase()} milk` : "";
  if (hint.shots) {
    return `${SHOT_WORDS[hint.shots - 1]} shots, ${temp}${hint.type}${milk}`;
  }
  const size = hint.size ? `${hint.size.toLowerCase()} ` : "";
  return `a ${size}${temp}${hint.type}${milk}`;
}

export function startGateVisible(input: {
  dismissed: boolean;
  frozen: boolean;
  autoDemo: boolean;
  shot: boolean;
}): boolean {
  if (input.dismissed || input.frozen || input.autoDemo || input.shot) return false;
  return true;
}

/**
 * Clear is absent on the opening screen and on the idle counter.
 * It shows once a session is underway: the mic is live, words or drinks
 * are on screen, or the demo is playing.
 */
export function clearControlVisible(input: {
  gate: boolean;
  shot: boolean;
  listening: boolean;
  transcript: string;
  drinkCount: number;
  demoPlaying: boolean;
}): boolean {
  if (input.gate || input.shot) return false;
  return input.listening || input.transcript.trim().length > 0 || input.drinkCount > 0 || input.demoPlaying;
}
