import type { Drink, DrinkType, Milk, Size, Temp } from "./types";
import { choice, TypeSafeClient } from "@typesafe-ai/sdk";

/**
 * One Jev attempt. The published API does not document a latency SLO.
 * The SDK default is 10s per attempt plus 2 retries, which is too slow
 * for a word that should land on screen while the sentence is still going.
 * Retries are off, and a call that exceeds this budget falls back to the parser.
 */
export const JEV_ATTEMPT_MS = 700;

const RULES = `Live coffee-order transcript. Reconstruct the order after every word so far, including corrections.

Drinks are added in the order they are named. A new drink defaults to size grande, 2 shots, whole milk, and hot.
"matcha" means a matcha latte. "latte" means a caffè latte.

Apply changes as they are spoken:
- "it" or "that one" is the drink being discussed.
- "one of the lattes" is the most recently added latte. "the other one" is the other latte.
- "the small one" is the tall drink. "the large one" is the venti drink.
- small means tall, large means venti.
- "get rid of", "remove", or "cancel the drink" deletes that drink. Do not leave an empty slot in the middle.
- Checkout words are not drinks. "let me check out", "I'm ready to check out", and "I want to place this order" do not add a drink. "place the order", "place my order", "place it", and "confirm" do not add a drink either.

Slots are in add-order after removals. Use "none" for unused slots.`;

type ChoiceAnswer = { choice?: string };

/** Narrow surface so tests can stand in for `TypeSafeClient.systemOne`. */
export type JevCaller = {
  systemOne: (request: {
    model: "jev-latest";
    state: { transcript: string; rules: string };
    questions: ReturnType<typeof questions>;
  }) => Promise<{ answers: Record<string, ChoiceAnswer> }>;
};

function questions() {
  const out: Record<string, ReturnType<typeof choice>> = {};
  for (let slot = 1; slot <= 4; slot += 1) {
    const which = `Using \`transcript\` and \`rules\`, slot ${slot} of the finished order (slot 1 was added first).`;
    out[`d${slot}_type`] = choice(`${which} Which drink is in this slot?`, {
      none: "This slot is empty.",
      matcha: "A matcha latte.",
      cappuccino: "A cappuccino.",
      latte: "A caffè latte.",
    });
    out[`d${slot}_size`] = choice(`${which} What size is this drink? If the slot is empty, choose grande.`, {
      tall: "Tall, which is also called small.",
      grande: "Grande, the default size, also called medium.",
      venti: "Venti, which is also called large.",
    });
    out[`d${slot}_shots`] = choice(`${which} How many espresso shots? If the slot is empty or it was not changed, choose 2.`, {
      "1": "One shot.",
      "2": "Two shots, the default.",
      "3": "Three shots.",
      "4": "Four or more shots.",
    });
    out[`d${slot}_milk`] = choice(`${which} Which milk? If the slot is empty or it was not changed, choose whole.`, {
      whole: "Whole milk, the default.",
      oat: "Oat milk.",
      almond: "Almond milk.",
      skim: "Skim, nonfat, or skinny milk.",
    });
    out[`d${slot}_temp`] = choice(`${which} Hot or iced? If the slot is empty or it was not changed, choose hot.`, {
      hot: "Hot.",
      iced: "Iced.",
    });
  }
  return out;
}

const TYPES = new Set<DrinkType>(["matcha", "cappuccino", "latte"]);
const SIZES: Record<string, Size> = { tall: "Tall", grande: "Grande", venti: "Venti" };
const MILKS: Record<string, Milk> = { whole: "Whole", oat: "Oat", almond: "Almond", skim: "Skim" };

export function drinksFromAnswers(answers: Record<string, ChoiceAnswer>, transcript: string): Drink[] | null {
  const drinks: Drink[] = [];
  for (let slot = 1; slot <= 4; slot += 1) {
    const type = answers[`d${slot}_type`]?.choice;
    if (!type || type === "none" || !TYPES.has(type as DrinkType)) break;
    const size = SIZES[answers[`d${slot}_size`]?.choice ?? ""] ?? "Grande";
    const shotsRaw = Number(answers[`d${slot}_shots`]?.choice ?? "2");
    const shots = Number.isFinite(shotsRaw) ? Math.min(6, Math.max(1, shotsRaw)) : 2;
    const milk = MILKS[answers[`d${slot}_milk`]?.choice ?? ""] ?? "Whole";
    const temp: Temp = answers[`d${slot}_temp`]?.choice === "iced" ? "Iced" : "Hot";
    drinks.push({
      id: `${type}-jev-${slot}`,
      type: type as DrinkType,
      size,
      shots,
      milk,
      temp,
    });
  }
  if (transcript.trim() && drinks.length === 0) return null;
  return drinks;
}

let cached: { key: string; client: TypeSafeClient } | null = null;

function clientFor(apiKey: string): TypeSafeClient {
  if (cached?.key === apiKey) return cached.client;
  const client = new TypeSafeClient({
    apiKey,
    defaultModel: "jev-latest",
    timeout: JEV_ATTEMPT_MS,
    retry: { maxRetries: 0 },
    compression: false,
    logLevel: "warn",
  });
  cached = { key: apiKey, client };
  return client;
}

/**
 * Ask Jev (`POST /v1/systemone`, model `jev-latest`) to read the transcript
 * into four drink slots. All twenty Choice questions go in one request;
 * Jev evaluates them against the same state in parallel.
 * Returns null when the answer is unusable. Throws when the call fails.
 */
export async function interpretWithJev(
  transcript: string,
  options: { apiKey?: string; client?: JevCaller },
): Promise<Drink[] | null> {
  const caller: JevCaller =
    options.client ??
    ({
      systemOne: (request) => clientFor(options.apiKey ?? "").systemOne(request),
    } satisfies JevCaller);
  const response = await caller.systemOne({
    model: "jev-latest",
    state: {
      transcript: transcript.trim() || "(no words yet)",
      rules: RULES,
    },
    questions: questions(),
  });
  return drinksFromAnswers(response.answers ?? {}, transcript);
}
