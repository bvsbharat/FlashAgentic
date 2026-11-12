export type InterpretLoop = {
  /** Bumped by clear so a response from an older request cannot paint. */
  epoch: number;
  inflight: string | null;
  pending: string | null;
};

export const IDLE_LOOP: InterpretLoop = { epoch: 0, inflight: null, pending: null };

function idleLike(loop: InterpretLoop): InterpretLoop {
  return { epoch: loop.epoch, inflight: null, pending: null };
}

/**
 * One interpret request at a time. A newer interim transcript waits and is
 * sent when the current request settles, so decisions track speech instead
 * of waiting for a final result.
 */
export function noteTranscript(
  loop: InterpretLoop,
  transcript: string,
): { loop: InterpretLoop; send: string | null } {
  const text = transcript.trim();
  if (loop.inflight) {
    if (!text || text === loop.inflight) return { loop: { ...loop, pending: text ? loop.pending : null }, send: null };
    if (text === loop.pending) return { loop, send: null };
    return { loop: { ...loop, pending: text }, send: null };
  }
  if (!text) return { loop: idleLike(loop), send: null };
  return { loop: { epoch: loop.epoch, inflight: text, pending: null }, send: text };
}

export function settleInterpret(loop: InterpretLoop): { loop: InterpretLoop; send: string | null } {
  const pending = loop.pending?.trim() ?? "";
  if (pending && pending !== loop.inflight) {
    return { loop: { epoch: loop.epoch, inflight: pending, pending: null }, send: pending };
  }
  return { loop: idleLike(loop), send: null };
}

/** Drop the in-flight transcript and anything waiting behind it. */
export function clearInterpret(loop: InterpretLoop): InterpretLoop {
  return { epoch: loop.epoch + 1, inflight: null, pending: null };
}

/** A response may paint only if clear has not moved the loop past the request that sent it. */
export function shouldApplyInterpret(loop: InterpretLoop, sentEpoch: number, sentText: string): boolean {
  return loop.epoch === sentEpoch && loop.inflight === sentText;
}
