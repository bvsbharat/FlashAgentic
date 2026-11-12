# Voice coffee counter

A full-screen counter where a spoken order becomes drinks while the sentence is still going. Size, shots, milk, and temperature update in place, and drinks can be referred to the way a person would: “one of the lattes”, “the other one”, “the small one”, “that one”.

Speech-to-text prefers AssemblyAI real-time streaming, model `universal-3-6-pro`. The browser captures the microphone (audio only — no camera), downsamples it to 16 kHz mono 16-bit PCM in an AudioWorklet, and sends that PCM to `wss://streaming.assemblyai.com/v3/ws`. The API key stays on the server. `GET /api/assemblyai-token` uses `client.streaming.createTemporaryToken` from the `assemblyai` SDK (`GET https://streaming.assemblyai.com/v3/token`) and returns only a short-lived token. Partial turns show in the pill as you speak and are posted to `/api/interpret`; finalized turns are appended. If the socket drops or the session nears its cap, the page mints a new token and reconnects without dropping the words already heard.

If `ASSEMBLYAI_API_KEY` is missing, the token request fails, or the socket errors, the page falls back to Chrome’s Web Speech API (`webkitSpeechRecognition`, `continuous` and `interimResults`, on-device when Chrome has a language pack). A small label in the pill reads **AssemblyAI** or **Chrome**. The decision label still reads **Jev** or **parser**.

Live transcripts are read by [Jev](https://docs.typesafe.ai), TypeSafe’s System One model (`@typesafeai` on X). The server calls `TypeSafeClient.systemOne` from [`@typesafe-ai/sdk`](https://docs.typesafe.ai/sdk/javascript) against `POST https://api.typesafe.ai/v1/systemone` with model `jev-latest`. One request asks twenty Choice questions (four drink slots, each with type, size, shots, milk, and temperature). Jev answers them in parallel against the transcript. The browser only learns whether a key is configured (`GET /api/interpret` returns `{ "jev": true|false }`). The key never leaves the server.

The TypeSafe docs do not publish a latency guarantee. The SDK’s own default is 10 seconds per attempt and two retries. This app turns retries off and caps each attempt at 700ms, then uses the deterministic parser if Jev does not answer. The page keeps a single request in flight and sends the latest transcript as soon as it returns, so the screen trails speech by about one round trip.

Without `JEV_API_KEY`, and whenever a call fails, the deterministic parser updates the order. Demo playback always uses that parser, so the eight-step script stays exact with or without a key. `npm test` covers the parser and a mock Jev client. It does not call TypeSafe.

## Run

```bash
npm install
npm test
npm run dev -- --port 4317
```

Open [http://127.0.0.1:4317](http://127.0.0.1:4317). A start screen comes up first. **Start** (or Enter / Space) asks for the microphone and opens the counter only after access is allowed. If it is blocked, the same screen explains how to allow it and Start tries again. The round button on the transcript bar reads **Start** until the microphone is allowed, then goes back to the listening dots. **Play demo** stays in the top-left, including on that screen, and the `D` key replays the order without a microphone. Interim words show in the pill as you speak, and each update is posted to `/api/interpret` before the phrase ends. A small label reads **Jev** or **parser** for the decision that painted the cards, and **AssemblyAI** or **Chrome** for the recognizer. The trash icon in the top-right clears the order once a session is underway, then returns to the idle prompt. There is no camera.

### Run it with Jev

Create a key at [console.typesafe.ai/keys](https://console.typesafe.ai/keys). Put it in `.env.local` in this directory (Next.js loads that file on the server and does not expose it to the browser):

```bash
cp .env.example .env.local
```

Edit `.env.local` so the keys have no `NEXT_PUBLIC_` prefix:

```bash
JEV_API_KEY="paste-the-key-from-the-typesafe-console"
```

Restart the dev server after saving the file. `GET /api/interpret` should return `{ "jev": true }`. Speak in Chrome. Each interim transcript is posted to `/api/interpret`, which calls Jev, and the drink cards update from that answer. If the key is missing, the request fails, or Jev returns nothing usable, the same route answers with the parser instead and the response `source` field is `"parser"` rather than `"jev"`.

Do not commit `.env.local`. `.env.example` is the only env file in git, and its keys are empty.

### Run it with AssemblyAI

Create a key in the [AssemblyAI dashboard](https://www.assemblyai.com/dashboard). Add it to `.env.local` next to the Jev key, with no `NEXT_PUBLIC_` prefix:

```bash
ASSEMBLYAI_API_KEY="paste-the-assemblyai-key"
```

Restart the dev server after saving. `GET /api/assemblyai-token?probe=1` returns `{ "assemblyai": true }` and does not include the key. The token itself is minted only when you click the meter. The streaming model is `universal-3-6-pro` at 16 kHz. Without the key, the same click uses Chrome instead and the pill reads **Chrome**.

Frozen frames for comparison:

- `/?at=2400&shot=1` — prompt, “can i get”
- `/?at=4200&shot=1` — hot matcha
- `/?at=7200&shot=1` — iced oat matcha
- `/?at=11500&shot=1` — matcha, cappuccino, latte
- `/?at=15200&shot=1` — a second latte
- `/?at=19000&shot=1` — tall and venti lattes
- `/?at=23400&shot=1` — three shots and oat milk
- `/?at=33000&shot=1` — cappuccino removed, small latte iced

`at` is milliseconds from the start of the demo. `shot=1` hides the demo button.

## Order the parser understands

- Add: “a matcha”, “one cappuccino”, “one more latte”, “an iced latte”
- Change: size (`small`/`tall`, `grande`, `large`/`venti`), shots, milk (`whole`, `oat`, `almond`, `skim`), `iced` / `hot`
- Point at a drink: “it”, “that one”, “one of the lattes”, “the other one”, “the small one”, “the cappuccino”
- Remove: “get rid of the cappuccino”

A changed option flashes gold, then settles back to the muted label color, matching the reference recording.
