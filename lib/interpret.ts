import { interpretWithJev, type JevCaller } from "./jev";
import { parseOrder } from "./parser";
import type { Drink } from "./types";

export type Interpretation = {
  drinks: Drink[];
  source: "jev" | "parser";
};

/**
 * Jev is the live reading when a server-side key or a test client is present.
 * A missing key, a failed call, or an unusable answer uses the deterministic parser.
 */
export async function interpretTranscript(
  transcript: string,
  options: { apiKey?: string; client?: JevCaller } = {},
): Promise<Interpretation> {
  if (options.client || options.apiKey) {
    try {
      const drinks = await interpretWithJev(transcript, options);
      if (drinks) return { drinks, source: "jev" };
    } catch {
      // The parser keeps the order moving when Jev times out or rejects the call.
    }
  }
  return { drinks: parseOrder(transcript), source: "parser" };
}
