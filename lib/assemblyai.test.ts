import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/assemblyai-token/route";
import {
  applyAssemblyTurn,
  EMPTY_ASSEMBLY,
  renderAssemblyTranscript,
  sealAssemblyTranscript,
  sessionRotateDelayMs,
  shouldReconnect,
  sttLabel,
} from "./assemblyai-transcript";
import { assemblyaiTokenResponse, mintStreamingToken } from "./assemblyai-token";
import {
  downmix,
  floatToPcm16,
  LinearResampler,
  microphoneConstraints,
  pcm16ToLittleEndian,
  PcmChunker,
  requestsCamera,
} from "./pcm";

const API_KEY = "assembly-secret-key-should-not-leak";

test("probe reports configuration and does not mint a token", async () => {
  let minted = false;
  const result = await assemblyaiTokenResponse({
    apiKey: API_KEY,
    probe: true,
    mint: async () => {
      minted = true;
      return { token: API_KEY, expires_in_seconds: 60, max_session_duration_seconds: 480 };
    },
  });
  assert.equal(minted, false);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { assemblyai: true });
  assert.equal(JSON.stringify(result.body).includes(API_KEY), false);
});

test("a missing key does not mint and does not echo the key", async () => {
  const result = await assemblyaiTokenResponse({
    apiKey: "   ",
    probe: false,
    mint: async () => {
      throw new Error("should not mint");
    },
  });
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { assemblyai: false });
});

test("the token response contains the token and never the api key", async () => {
  const result = await assemblyaiTokenResponse({
    apiKey: API_KEY,
    probe: false,
    mint: async (apiKey) => {
      assert.equal(apiKey, API_KEY);
      return { token: "temp-token-xyz", expires_in_seconds: 60, max_session_duration_seconds: 480 };
    },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    token: "temp-token-xyz",
    expires_in_seconds: 60,
    max_session_duration_seconds: 480,
  });
  const encoded = JSON.stringify(result.body);
  assert.equal(encoded.includes(API_KEY), false);
  assert.equal(encoded.includes("temp-token-xyz"), true);
});

test("a token failure is a generic unconfigured response", async () => {
  const result = await assemblyaiTokenResponse({
    apiKey: API_KEY,
    probe: false,
    mint: async () => {
      throw new Error(`Authorization ${API_KEY} was rejected`);
    },
  });
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { assemblyai: false });
  assert.equal(JSON.stringify(result.body).includes(API_KEY), false);
});

test("the route mints through the SDK token endpoint and hides the key", { concurrency: false }, async () => {
  const original = globalThis.fetch;
  const calls: { url: string; authorization: string | null }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    calls.push({ url: String(input), authorization: headers.get("authorization") });
    return new Response(JSON.stringify({ token: "temp-token-xyz" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  const previous = process.env.ASSEMBLYAI_API_KEY;
  process.env.ASSEMBLYAI_API_KEY = API_KEY;
  try {
    const minted = await mintStreamingToken(API_KEY);
    assert.equal(minted.token, "temp-token-xyz");
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /^https:\/\/streaming\.assemblyai\.com\/v3\/token\?/);
    assert.match(calls[0].url, /expires_in_seconds=60/);
    assert.match(calls[0].url, /max_session_duration_seconds=480/);
    assert.equal(calls[0].url.includes(API_KEY), false);
    assert.equal(calls[0].authorization, API_KEY);

    const response = await GET(new Request("http://counter.local/api/assemblyai-token"));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.token, "temp-token-xyz");
    assert.equal(JSON.stringify(body).includes(API_KEY), false);

    const probe = await GET(new Request("http://counter.local/api/assemblyai-token?probe=1"));
    const probeBody = await probe.json();
    assert.equal(probe.status, 200);
    assert.deepEqual(probeBody, { assemblyai: true });
    assert.equal(JSON.stringify(probeBody).includes(API_KEY), false);
  } finally {
    globalThis.fetch = original;
    if (previous === undefined) delete process.env.ASSEMBLYAI_API_KEY;
    else process.env.ASSEMBLYAI_API_KEY = previous;
  }
});

test("the route reports unconfigured when the key is absent", { concurrency: false }, async () => {
  const previous = process.env.ASSEMBLYAI_API_KEY;
  delete process.env.ASSEMBLYAI_API_KEY;
  try {
    const response = await GET(new Request("http://counter.local/api/assemblyai-token"));
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.deepEqual(body, { assemblyai: false });
    const probe = await GET(new Request("http://counter.local/api/assemblyai-token?probe=1"));
    assert.deepEqual(await probe.json(), { assemblyai: false });
  } finally {
    if (previous === undefined) delete process.env.ASSEMBLYAI_API_KEY;
    else process.env.ASSEMBLYAI_API_KEY = previous;
  }
});

test("48 kHz audio becomes 16 kHz little-endian PCM", () => {
  const resampler = new LinearResampler(48000, 16000);
  const input = new Float32Array(48000);
  for (let index = 0; index < input.length; index += 1) input[index] = Math.sin(index / 20);
  const down = resampler.process(input);
  assert.ok(Math.abs(down.length - 16000) <= 2);

  const pcm = floatToPcm16(Float32Array.from([0, 1, -1, 0.5]));
  assert.equal(pcm[0], 0);
  assert.equal(pcm[1], 32767);
  assert.equal(pcm[2], -32768);
  assert.equal(pcm[3], 16383);
  const bytes = pcm16ToLittleEndian(pcm);
  assert.deepEqual(Array.from(bytes.slice(0, 6)), [0x00, 0x00, 0xff, 0x7f, 0x00, 0x80]);
});

test("resampling two chunks matches resampling them together", () => {
  const input = new Float32Array(4800);
  for (let index = 0; index < input.length; index += 1) input[index] = Math.sin(index / 10);
  const whole = new LinearResampler(48000, 16000).process(input);
  const split = new LinearResampler(48000, 16000);
  const head = split.process(input.subarray(0, 2400));
  const tail = split.process(input.subarray(2400));
  const joined = new Float32Array(head.length + tail.length);
  joined.set(head, 0);
  joined.set(tail, head.length);
  assert.equal(joined.length, whole.length);
  for (let index = 0; index < whole.length; index += 1) {
    assert.ok(Math.abs(joined[index] - whole[index]) < 1e-5);
  }
});

test("pcm chunks wait until 50 ms and stay under 200 ms", () => {
  const chunker = new PcmChunker();
  assert.equal(chunker.push(new Int16Array(400)).length, 0);
  const ready = chunker.push(new Int16Array(400));
  assert.equal(ready.length, 1);
  assert.equal(ready[0].length, 800);
  const burst = chunker.push(new Int16Array(5000));
  assert.ok(burst.every((chunk) => chunk.length >= 800 && chunk.length <= 3200));
  assert.equal(burst.reduce((sum, chunk) => sum + chunk.length, 0), 5000);
  assert.equal(chunker.flush(), null);
});

test("capture mixes to mono and never asks for a camera", () => {
  const left = Float32Array.from([0, 1]);
  const right = Float32Array.from([1, 1]);
  const mixed = downmix([left, right]);
  assert.deepEqual(Array.from(mixed), [0.5, 1]);
  const constraints = microphoneConstraints();
  assert.equal("video" in constraints, false);
  assert.equal(requestsCamera(constraints), false);
  assert.equal(requestsCamera({ audio: true, video: true }), true);
});

test("partial turns show live and finals are kept across a reconnect", () => {
  let state = EMPTY_ASSEMBLY;
  state = applyAssemblyTurn(state, {
    type: "Turn",
    turn_order: 0,
    end_of_turn: false,
    transcript: "can i",
    words: [
      { text: "can", word_is_final: true },
      { text: "i", word_is_final: true },
      { text: "get", word_is_final: false },
    ],
  });
  assert.equal(renderAssemblyTranscript(state), "can i get");

  state = applyAssemblyTurn(state, {
    type: "Turn",
    turn_order: 0,
    end_of_turn: true,
    transcript: "can i get a matcha",
    utterance: "can i get a matcha",
    words: [{ text: "can" }, { text: "i" }, { text: "get" }, { text: "a" }, { text: "matcha" }],
  });
  assert.equal(renderAssemblyTranscript(state), "can i get a matcha");

  state = applyAssemblyTurn(state, {
    type: "Turn",
    turn_order: 1,
    end_of_turn: false,
    words: [{ text: "iced", word_is_final: false }],
  });
  assert.equal(renderAssemblyTranscript(state), "can i get a matcha iced");

  state = applyAssemblyTurn(state, { type: "Begin", turn_order: 0, transcript: "ignore me" });
  assert.equal(renderAssemblyTranscript(state), "can i get a matcha iced");

  const sealed = sealAssemblyTranscript(state);
  const next = applyAssemblyTurn(sealed, {
    type: "Turn",
    turn_order: 0,
    end_of_turn: false,
    words: [{ text: "with" }, { text: "oat" }],
  });
  assert.equal(renderAssemblyTranscript(next), "can i get a matcha iced with oat");

  const formatted = applyAssemblyTurn(next, {
    type: "Turn",
    turn_order: 0,
    end_of_turn: true,
    transcript: "with oat milk",
  });
  assert.equal(renderAssemblyTranscript(formatted), "can i get a matcha iced with oat milk");
  const repeated = applyAssemblyTurn(formatted, {
    type: "Turn",
    turn_order: 0,
    end_of_turn: false,
    words: [{ text: "with" }],
  });
  assert.equal(renderAssemblyTranscript(repeated), "can i get a matcha iced with oat milk");
});

test("reconnects stop after three drops and a deliberate close", () => {
  assert.equal(shouldReconnect({ listening: true, intentionalClose: false, attempts: 0 }), true);
  assert.equal(shouldReconnect({ listening: true, intentionalClose: false, attempts: 2 }), true);
  assert.equal(shouldReconnect({ listening: true, intentionalClose: false, attempts: 3 }), false);
  assert.equal(shouldReconnect({ listening: false, intentionalClose: false, attempts: 0 }), false);
  assert.equal(shouldReconnect({ listening: true, intentionalClose: true, attempts: 0 }), false);
  assert.equal(sessionRotateDelayMs(480), 450_000);
  assert.equal(sttLabel("assemblyai"), "AssemblyAI");
  assert.equal(sttLabel("chrome"), "Chrome");
  assert.equal(sttLabel(null), null);
});
