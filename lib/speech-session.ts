import { normalizeTranscript } from "./parser";

export type SpeechPiece = { transcript: string; isFinal: boolean };

export function sessionParts(results: SpeechPiece[]): { finalText: string; interim: string } {
  let finalText = "";
  let interim = "";
  for (const result of results) {
    const piece = result.transcript.trim();
    if (!piece) continue;
    if (result.isFinal) finalText += `${piece} `;
    else interim += `${piece} `;
  }
  return { finalText: finalText.trim(), interim: interim.trim() };
}

/** Drop a leading run of words the committed transcript already ends with. */
export function stripOverlap(committed: string, addition: string): string {
  const base = committed.trim();
  const extra = addition.trim();
  if (!extra) return "";
  if (!base) return extra;
  if (base === extra || base.endsWith(extra)) return "";
  const baseWords = base.split(" ");
  const extraWords = extra.split(" ");
  let overlap = 0;
  const max = Math.min(baseWords.length, extraWords.length);
  for (let size = max; size > 0; size -= 1) {
    if (baseWords.slice(-size).join(" ") === extraWords.slice(0, size).join(" ")) {
      overlap = size;
      break;
    }
  }
  return extraWords.slice(overlap).join(" ");
}

/** Committed words from earlier Chrome sessions, plus this session's finals and interim. */
export function liveTranscript(committed: string, results: SpeechPiece[]): string {
  const { finalText, interim } = sessionParts(results);
  const addition = stripOverlap(committed, [finalText, interim].filter(Boolean).join(" "));
  return normalizeTranscript([committed, addition].filter(Boolean).join(" "));
}

/**
 * Chrome ends a continuous session on its own, and the next session's
 * `results` list starts empty. Keep finals and any interim that never
 * became final, or those words disappear before the next result.
 */
export function commitSession(committed: string, results: SpeechPiece[]): string {
  return liveTranscript(committed, results);
}
