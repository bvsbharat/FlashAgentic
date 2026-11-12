/** 16 kHz mono PCM for AssemblyAI streaming. */

export const TARGET_SAMPLE_RATE = 16000;
/** AssemblyAI rejects PCM messages shorter than 50 ms. */
export const MIN_PCM_SAMPLES = 800;
/** AssemblyAI rejects PCM messages longer than about 1000 ms; stay well under. */
export const MAX_PCM_SAMPLES = 3200;

/**
 * Audio-only capture. There is no `video` key, so the browser is not asked
 * for a camera.
 */
export function microphoneConstraints(): MediaStreamConstraints {
  return {
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  };
}

export function requestsCamera(constraints: MediaStreamConstraints): boolean {
  return "video" in constraints && Boolean(constraints.video);
}

/**
 * Linear resampler that keeps its phase across chunks, so a stream split
 * into worklet buffers matches one continuous buffer.
 */
export class LinearResampler {
  private readonly ratio: number;
  private lastSample = 0;
  private fractional = 0;

  constructor(
    readonly sourceRate: number,
    readonly targetRate: number,
  ) {
    if (sourceRate <= 0 || targetRate <= 0) {
      throw new Error("sample rates must be positive");
    }
    this.ratio = sourceRate / targetRate;
  }

  process(input: Float32Array): Float32Array {
    if (input.length === 0) return new Float32Array(0);
    if (this.sourceRate === this.targetRate) {
      this.lastSample = input[input.length - 1] ?? 0;
      return input;
    }
    const out = new Float32Array(Math.ceil(input.length / this.ratio) + 1);
    let outIdx = 0;
    let pos = this.fractional;
    while (pos < input.length) {
      const index = Math.floor(pos);
      const frac = pos - index;
      const previous = index === 0 ? this.lastSample : input[index - 1];
      const next = input[index];
      out[outIdx] = previous + (next - previous) * frac;
      outIdx += 1;
      pos += this.ratio;
    }
    this.lastSample = input[input.length - 1] ?? this.lastSample;
    this.fractional = pos - input.length;
    return out.subarray(0, outIdx);
  }

  reset(): void {
    this.lastSample = 0;
    this.fractional = 0;
  }
}

/** Float32 samples in -1..1 to little-endian signed 16-bit PCM. */
export function floatToPcm16(input: Float32Array): Int16Array {
  const pcm = new Int16Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, input[index]));
    pcm[index] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return pcm;
}

export function pcm16ToLittleEndian(pcm: Int16Array): Uint8Array {
  const bytes = new Uint8Array(pcm.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < pcm.length; index += 1) {
    view.setInt16(index * 2, pcm[index], true);
  }
  return bytes;
}

/** Average channels down to one. A single channel is returned as-is. */
export function downmix(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0];
  const length = channels[0].length;
  const mixed = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    let sum = 0;
    for (const channel of channels) sum += channel[index] ?? 0;
    mixed[index] = sum / channels.length;
  }
  return mixed;
}

/**
 * Group PCM into chunks the streaming API will accept (50–200 ms).
 * Short tails stay buffered until `flush`.
 */
export class PcmChunker {
  private pending = new Int16Array(0);

  push(samples: Int16Array): Int16Array[] {
    if (samples.length === 0) return [];
    const merged = new Int16Array(this.pending.length + samples.length);
    merged.set(this.pending, 0);
    merged.set(samples, this.pending.length);
    this.pending = merged;
    const ready: Int16Array[] = [];
    while (this.pending.length >= MIN_PCM_SAMPLES) {
      const size = Math.min(MAX_PCM_SAMPLES, this.pending.length);
      ready.push(this.pending.subarray(0, size).slice());
      this.pending = this.pending.subarray(size).slice();
    }
    return ready;
  }

  flush(): Int16Array | null {
    if (this.pending.length === 0) return null;
    const tail = this.pending;
    this.pending = new Int16Array(0);
    return tail;
  }
}
