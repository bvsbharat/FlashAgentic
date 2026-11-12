export type DemoWord = {
  /** Seconds from the start of the demo. */
  t: number;
  text: string;
  latency: number;
};

const LATENCIES = [144, 151, 138, 166, 148, 177, 159, 203, 152, 149, 169, 182, 145, 126, 228, 161, 174, 155, 163, 141];

const PHRASES: { t: number; step: number; text: string }[] = [
  { t: 1.65, step: 0.32, text: "can i get a matcha" },
  { t: 3.55, step: 0.26, text: "let's make it iced" },
  { t: 5.35, step: 0.3, text: "with oat milk" },
  { t: 6.7, step: 0.26, text: "and can we add one cappuccino" },
  { t: 10.05, step: 0.26, text: "and one latte" },
  { t: 12.2, step: 0.26, text: "actually can we add one more latte" },
  { t: 14.55, step: 0.2, text: "for one of the lattes can we make it large" },
  { t: 16.55, step: 0.2, text: "and then the other one small" },
  { t: 18.7, step: 0.22, text: "and then for the small one can we do three shots" },
  { t: 21.9, step: 0.28, text: "with oat milk" },
  { t: 26.1, step: 0.26, text: "and let's make that one iced actually" },
  { t: 29.8, step: 0.24, text: "awesome actually let's get rid of the cappuccino" },
  { t: 35.4, step: 0.34, text: "let me check out" },
  { t: 40.8, step: 0.36, text: "place the order" },
];

export const DEMO_WORDS: DemoWord[] = (() => {
  let n = 0;
  return PHRASES.flatMap((phrase) =>
    phrase.text.split(" ").map((text, index) => {
      const latency = LATENCIES[n % LATENCIES.length];
      n += 1;
      return { t: Number((phrase.t + index * phrase.step).toFixed(3)), text, latency };
    }),
  );
})();

export const DEMO_END = (DEMO_WORDS[DEMO_WORDS.length - 1]?.t ?? 0) + 4.2;

export function transcriptAt(seconds: number): string {
  return DEMO_WORDS.filter((word) => word.t <= seconds)
    .map((word) => word.text)
    .join(" ");
}

export function latencyAt(seconds: number): number | null {
  let latest: DemoWord | null = null;
  for (const word of DEMO_WORDS) {
    if (word.t <= seconds) latest = word;
    else break;
  }
  return latest ? latest.latency : null;
}

export function speakingAt(seconds: number): boolean {
  let latest = -1;
  for (const word of DEMO_WORDS) {
    if (word.t <= seconds) latest = word.t;
    else break;
  }
  return latest >= 0 && seconds - latest < 0.32;
}

/** How long a changed option stays gold before it settles. Tuned to the frames. */
export const GOLD_WINDOW_SECONDS = 1.35;
