/**
 * AssemblyAI universal streaming, model universal-3-6-pro.
 * Partials replace the open turn. `end_of_turn` commits it.
 * A new socket starts `turn_order` over at 0, so text from the previous
 * socket is sealed into `prefix` before reconnecting.
 */

export const ASSEMBLY_SPEECH_MODEL = "universal-3-6-pro" as const;
export const ASSEMBLY_SAMPLE_RATE = 16000;
export const MAX_RECONNECTS = 3;
export const ROTATE_EARLY_SECONDS = 30;

export type AssemblyWord = { text?: string; word_is_final?: boolean };

export type AssemblyTurnMessage = {
  type?: string;
  turn_order?: number;
  end_of_turn?: boolean;
  transcript?: string;
  utterance?: string;
  words?: AssemblyWord[];
};

export type AssemblyTranscriptState = {
  prefix: string;
  turns: string[];
  partial: string;
};

export const EMPTY_ASSEMBLY: AssemblyTranscriptState = { prefix: "", turns: [], partial: "" };

function wordsText(message: AssemblyTurnMessage): string {
  return (message.words ?? [])
    .map((word) => word.text?.trim() ?? "")
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function applyAssemblyTurn(
  state: AssemblyTranscriptState,
  message: AssemblyTurnMessage,
): AssemblyTranscriptState {
  if (message.type && message.type !== "Turn") return state;
  const order = message.turn_order ?? 0;
  if (message.end_of_turn) {
    const text = (message.utterance?.trim() || message.transcript?.trim() || wordsText(message)).trim();
    const turns = state.turns.slice();
    turns[order] = text;
    return { prefix: state.prefix, turns, partial: "" };
  }
  if (state.turns[order]) return state;
  const partial = (wordsText(message) || message.transcript?.trim() || "").trim();
  return { prefix: state.prefix, turns: state.turns, partial };
}

export function renderAssemblyTranscript(state: AssemblyTranscriptState): string {
  return [state.prefix, ...state.turns, state.partial]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sealAssemblyTranscript(state: AssemblyTranscriptState): AssemblyTranscriptState {
  const sealed = renderAssemblyTranscript(state);
  if (!sealed) return EMPTY_ASSEMBLY;
  return { prefix: sealed, turns: [], partial: "" };
}

export function shouldReconnect(input: {
  listening: boolean;
  intentionalClose: boolean;
  attempts: number;
}): boolean {
  if (!input.listening || input.intentionalClose) return false;
  return input.attempts < MAX_RECONNECTS;
}

/** Milliseconds to wait before opening a fresh session, ahead of the server cap. */
export function sessionRotateDelayMs(maxSessionSeconds: number): number {
  const seconds = Math.max(15, maxSessionSeconds - ROTATE_EARLY_SECONDS);
  return seconds * 1000;
}

export function sttLabel(engine: "assemblyai" | "chrome" | null): "AssemblyAI" | "Chrome" | null {
  if (engine === "assemblyai") return "AssemblyAI";
  if (engine === "chrome") return "Chrome";
  return null;
}
