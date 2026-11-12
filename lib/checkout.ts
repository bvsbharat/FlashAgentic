import { checkoutCuesFromTokens, type CheckoutCue, type CheckoutIntent } from "./checkout-cues";
import { tokenize } from "./parser";
import { drinkTitle, milkLabel, shotsLabel, type Drink, type DrinkType, type Size } from "./types";

export type { CheckoutCue, CheckoutIntent };

export type CheckoutPhase = "shopping" | "review" | "placed";
export type CheckoutAction = "open" | "confirm" | "cancel";

export type CheckoutModel = {
  phase: CheckoutPhase;
  /** Cues that start before this token index have already been applied. */
  cursor: number;
  orderNo: string | null;
};

export const CHECKOUT_IDLE: CheckoutModel = { phase: "shopping", cursor: 0, orderNo: null };

const BASE_CENTS: Record<DrinkType, Record<Size, number>> = {
  matcha: { Tall: 495, Grande: 545, Venti: 595 },
  cappuccino: { Tall: 415, Grande: 465, Venti: 515 },
  latte: { Tall: 445, Grande: 495, Venti: 545 },
};

const EXTRA_SHOT_CENTS = 80;
const ALT_MILK_CENTS = 70;
/** 8.5% of the subtotal, rounded to the nearest cent. */
const TAX_NUMERATOR = 85;
const TAX_DENOMINATOR = 1000;

export const TAX_LABEL = "8.5%";

export type ReceiptLine = {
  id: string;
  title: string;
  details: string;
  cents: number;
};

export type Receipt = {
  lines: ReceiptLine[];
  subtotal: number;
  tax: number;
  total: number;
};

export function checkoutCues(transcript: string): CheckoutCue[] {
  return checkoutCuesFromTokens(tokenize(transcript));
}

export function linePriceCents(drink: Drink): number {
  const extraShots = Math.max(0, drink.shots - 2) * EXTRA_SHOT_CENTS;
  const milk = drink.milk === "Whole" ? 0 : ALT_MILK_CENTS;
  return BASE_CENTS[drink.type][drink.size] + extraShots + milk;
}

export function buildReceipt(drinks: Drink[]): Receipt {
  const lines = drinks.map((drink) => ({
    id: drink.id,
    title: drinkTitle(drink),
    details: `${drink.size} · ${shotsLabel(drink.shots)} · ${milkLabel(drink.milk)} · ${drink.temp}`,
    cents: linePriceCents(drink),
  }));
  const subtotal = lines.reduce((sum, line) => sum + line.cents, 0);
  const tax = Math.round((subtotal * TAX_NUMERATOR) / TAX_DENOMINATOR);
  return { lines, subtotal, tax, total: subtotal + tax };
}

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Stable four-digit ticket number. The same seed always prints the same id. */
export function orderNumberFrom(seed: string | number): string {
  const text = String(seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const n = (hash >>> 0) % 10000;
  return `VC-${String(n).padStart(4, "0")}`;
}

export type CheckoutTrace = CheckoutModel & { actions: CheckoutAction[] };

/**
 * Walk checkout cues that start at or after `start.cursor`.
 * Confirm places only while the review modal is open and the ticket has a drink.
 * A cue is consumed even when it does not change phase, so leftover words
 * cannot open or place the order again.
 */
export function traceCheckout(transcript: string, drinkCount: number, start: CheckoutModel = CHECKOUT_IDLE): CheckoutTrace {
  let phase = start.phase;
  let orderNo = start.orderNo;
  let cursor = start.cursor;
  const actions: CheckoutAction[] = [];
  for (const cue of checkoutCues(transcript)) {
    if (cue.start < cursor) continue;
    cursor = cue.end;
    if (cue.intent === "open") {
      if (phase === "shopping") {
        phase = "review";
        actions.push("open");
      }
      continue;
    }
    if (cue.intent === "confirm") {
      if (phase === "review" && drinkCount > 0) {
        phase = "placed";
        actions.push("confirm");
        if (!orderNo) orderNo = orderNumberFrom(transcript);
      }
      continue;
    }
    if (phase === "review" || phase === "placed") {
      phase = "shopping";
      orderNo = null;
      actions.push("cancel");
    }
  }
  return { phase, cursor, orderNo, actions };
}

/** Same transition as `traceCheckout`, keeping the previous object when nothing moved. */
export function applyCheckout(model: CheckoutModel, transcript: string, drinkCount: number): CheckoutModel {
  if (model.cursor > tokenize(transcript).length) return applyCheckout(CHECKOUT_IDLE, transcript, drinkCount);
  const traced = traceCheckout(transcript, drinkCount, model);
  if (traced.phase === model.phase && traced.cursor === model.cursor && traced.orderNo === model.orderNo) return model;
  return { phase: traced.phase, cursor: traced.cursor, orderNo: traced.orderNo };
}

/** True only on the transition into a placed order, so the celebration runs once. */
export function shouldCelebrate(previous: CheckoutPhase, next: CheckoutPhase): boolean {
  return previous !== "placed" && next === "placed";
}

export function celebrationKind(reducedMotion: boolean): "confetti" | "calm" {
  return reducedMotion ? "calm" : "confetti";
}
