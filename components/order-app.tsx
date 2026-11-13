"use client";

import CheckoutModal from "@/components/checkout-modal";
import DrinkCard from "@/components/drink-card";
import OrderConfetti from "@/components/order-confetti";
import StartScreen from "@/components/start-screen";
import TotalCallout from "@/components/total-callout";
import TranscriptBar from "@/components/transcript-bar";
import { useSpeech } from "@/components/use-speech";
import { sttLabel } from "@/lib/assemblyai-transcript";
import {
  CHECKOUT_IDLE,
  applyCheckout,
  celebrationKind,
  orderNumberFrom,
  shouldCelebrate,
  type CheckoutModel,
  type CheckoutPhase,
} from "@/lib/checkout";
import { DEMO_END, GOLD_WINDOW_SECONDS, latencyAt, speakingAt, transcriptAt } from "@/lib/demo";
import { clearInterpret, IDLE_LOOP, noteTranscript, settleInterpret, shouldApplyInterpret, type InterpretLoop } from "@/lib/live-order";
import { meterShowsStart } from "@/lib/mic-permission";
import { totalAskedAt } from "@/lib/checkout-cues";
import { parseOrder, tokenize } from "@/lib/parser";
import { clearControlVisible, startGateVisible } from "@/lib/start-gate";
import type { Drink, OptionField } from "@/lib/types";
import { drinkTitle } from "@/lib/types";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type HistoryEntry = { t: number; drinks: Drink[] };

function fieldsChanged(past: Drink[], current: Drink[]): Record<string, OptionField[]> {
  const previous = new Map(past.map((drink) => [drink.id, drink]));
  const changed: Record<string, OptionField[]> = {};
  for (const drink of current) {
    const before = previous.get(drink.id);
    if (!before) continue;
    const fields: OptionField[] = [];
    (["size", "shots", "milk", "temp"] as const).forEach((field) => {
      if (before[field] !== drink[field]) fields.push(field);
    });
    if (fields.length) changed[drink.id] = fields;
  }
  return changed;
}

function orderAt(history: HistoryEntry[], time: number): Drink[] {
  let found: Drink[] = [];
  for (const entry of history) {
    if (entry.t <= time) found = entry.drinks;
    else break;
  }
  // A drink added inside the window is compared with its first version,
  // so an edit right after it appears still lights up straight away.
  const seen = new Set(found.map((drink) => drink.id));
  const baseline = [...found];
  for (const entry of history) {
    if (entry.t <= time) continue;
    for (const drink of entry.drinks) {
      if (seen.has(drink.id)) continue;
      seen.add(drink.id);
      baseline.push(drink);
    }
  }
  return baseline;
}

function adoptIds(previous: Drink[], next: Drink[]): Drink[] {
  return next.map((drink, index) => {
    const prior = previous[index];
    if (prior && prior.type === drink.type) return { ...drink, id: prior.id };
    return drink;
  });
}

export default function OrderApp() {
  const params = useSearchParams();
  const shot = params.get("shot") === "1";
  const atRaw = params.get("at");
  const [ignoreFreeze, setIgnoreFreeze] = useState(false);
  const frozenSeconds =
    ignoreFreeze || atRaw == null || atRaw === "" || !Number.isFinite(Number(atRaw)) ? null : Number(atRaw) / 1000;
  const autoDemo = !ignoreFreeze && params.get("demo") === "1" && frozenSeconds == null;

  const { error: speechError, listening, speaking: micSpeaking, start: startMic, stop: stopMic, clear: clearMic, transcript: heard, engine, micPermission } = useSpeech();
  const [playing, setPlaying] = useState(autoDemo);
  const [demoNow, setDemoNow] = useState(frozenSeconds ?? 0);
  const [liveDrinks, setLiveDrinks] = useState<Drink[] | null>(null);
  const [liveLatency, setLiveLatency] = useState<number | null>(null);
  const [decisionSource, setDecisionSource] = useState<"jev" | "parser" | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([{ t: 0, drinks: [] }]);
  const [now, setNow] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutModel>(CHECKOUT_IDLE);
  const [placedDrinks, setPlacedDrinks] = useState<Drink[] | null>(null);
  const [burstKey, setBurstKey] = useState<string | null>(null);
  const celebrated = useRef<string | null>(null);
  const phaseRef = useRef<CheckoutPhase>("shopping");
  const [reducedMotion, setReducedMotion] = useState(false);
  const loopRef = useRef<InterpretLoop>(IDLE_LOOP);
  const demoRef = useRef(false);
  const sendRef = useRef<(text: string) => void>(() => {});

  const demoMode = playing || frozenSeconds != null;
  demoRef.current = demoMode;
  const gate = startGateVisible({
    dismissed,
    frozen: frozenSeconds != null,
    autoDemo,
    shot,
  });

  useEffect(() => {
    if (!playing || frozenSeconds != null) return;
    const started = performance.now();
    const timer = window.setInterval(() => {
      const elapsed = (performance.now() - started) / 1000;
      if (elapsed >= DEMO_END) {
        setDemoNow(DEMO_END);
        setPlaying(false);
        return;
      }
      setDemoNow(elapsed);
    }, 50);
    return () => window.clearInterval(timer);
  }, [playing, frozenSeconds]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (shot) return;
      if (event.key.toLowerCase() !== "d" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      event.preventDefault();
      setDismissed(true);
      stopMic();
      setLiveDrinks(null);
      setDecisionSource(null);
      setDemoNow(0);
      setPlaying(true);
      phaseRef.current = "shopping";
      celebrated.current = null;
      setBurstKey(null);
      setPlacedDrinks(null);
      setCheckout(CHECKOUT_IDLE);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shot, stopMic]);

  const transcript = demoMode ? transcriptAt(demoNow) : heard;
  const parsed = useMemo(() => parseOrder(transcript), [transcript]);
  const drinks = useMemo(() => (demoMode ? parsed : (liveDrinks ?? [])), [demoMode, parsed, liveDrinks]);
  // The receipt shows the same drinks as the cards (Jev live, parser in demo mode).
  const view = applyCheckout(checkout, transcript, drinks.length);
  const receiptDrinks = view.phase === "placed" && placedDrinks ? placedDrinks : drinks;

  const resetCheckout = useCallback(() => {
    phaseRef.current = "shopping";
    celebrated.current = null;
    setBurstKey(null);
    setPlacedDrinks(null);
    setCheckout(CHECKOUT_IDLE);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      if (view.phase === "placed" && view.orderNo) celebrated.current = `${view.orderNo}:${view.cursor}`;
      phaseRef.current = view.phase;
      setBurstKey(null);
      return;
    }
    const previous = phaseRef.current;
    phaseRef.current = view.phase;
    if (!shouldCelebrate(previous, view.phase) || !view.orderNo) return;
    const key = `${view.orderNo}:${view.cursor}`;
    if (celebrated.current === key) return;
    celebrated.current = key;
    setBurstKey(key);
  }, [reducedMotion, view.cursor, view.orderNo, view.phase]);

  const sendInterpret = useCallback((text: string) => {
    const started = performance.now();
    const epoch = loopRef.current.epoch;
    const accept = () => shouldApplyInterpret(loopRef.current, epoch, text);
    fetch("/api/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: text }),
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) throw new Error(`interpret ${response.status}`);
        return response.json() as Promise<{ drinks?: Drink[]; source?: string }>;
      })
      .then((body) => {
        if (!accept() || demoRef.current) return;
        if (!Array.isArray(body.drinks)) throw new Error("interpret returned no order");
        setLiveLatency(Math.max(1, Math.round(performance.now() - started)));
        setDecisionSource(body.source === "jev" ? "jev" : "parser");
        setLiveDrinks((current) => adoptIds(current ?? [], body.drinks ?? []));
      })
      .catch(() => {
        if (!accept() || demoRef.current) return;
        setLiveLatency(Math.max(1, Math.round(performance.now() - started)));
        setDecisionSource("parser");
        setLiveDrinks(parseOrder(text));
      })
      .finally(() => {
        if (!accept()) return;
        const next = settleInterpret(loopRef.current);
        loopRef.current = next.loop;
        if (next.send && !demoRef.current) sendRef.current(next.send);
      });
  }, []);

  sendRef.current = sendInterpret;

  useEffect(() => {
    if (demoMode) return;
    const decision = noteTranscript(loopRef.current, transcript);
    loopRef.current = decision.loop;
    if (decision.send) sendRef.current(decision.send);
  }, [transcript, demoMode]);

  useEffect(() => {
    if (demoMode) return;
    setHistory((current) => {
      const last = current[current.length - 1];
      if (last && JSON.stringify(last.drinks) === JSON.stringify(drinks)) return current;
      const next = [...current, { t: performance.now(), drinks }];
      return next.slice(-50);
    });
  }, [drinks, demoMode]);

  useEffect(() => {
    if (demoMode && frozenSeconds != null) return;
    const timer = window.setInterval(() => setNow(performance.now()), 120);
    return () => window.clearInterval(timer);
  }, [demoMode, frozenSeconds]);

  const gold = useMemo(() => {
    if (demoMode) {
      return fieldsChanged(parseOrder(transcriptAt(Math.max(0, demoNow - GOLD_WINDOW_SECONDS))), drinks);
    }
    return fieldsChanged(orderAt(history, now - GOLD_WINDOW_SECONDS * 1000), drinks);
  }, [demoMode, demoNow, drinks, history, now]);

  const playDemo = useCallback(() => {
    setDismissed(true);
    stopMic();
    setLiveDrinks(null);
    setDecisionSource(null);
    setDemoNow(0);
    setPlaying(true);
    resetCheckout();
  }, [resetCheckout, stopMic]);

  const begin = useCallback(() => {
    setStarting(true);
    // startMic calls getUserMedia before it awaits, so this click still owns the prompt.
    const opened = startMic();
    void opened.then((granted) => {
      setStarting(false);
      if (!granted) return;
      setDismissed(true);
      resetCheckout();
      loopRef.current = IDLE_LOOP;
      setPlaying(false);
      setLiveDrinks(null);
      setDecisionSource(null);
      setLiveLatency(null);
    });
  }, [resetCheckout, startMic]);

  useEffect(() => {
    if (!gate) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-demo]") || target?.closest("[data-start]")) return;
      event.preventDefault();
      begin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [begin, gate]);

  const clearOrder = useCallback(() => {
    resetCheckout();
    loopRef.current = clearInterpret(loopRef.current);
    clearMic();
    setIgnoreFreeze(true);
    setPlaying(false);
    setDemoNow(0);
    setLiveDrinks(null);
    setLiveLatency(null);
    setDecisionSource(null);
    setHistory([{ t: performance.now(), drinks: [] }]);
  }, [clearMic, resetCheckout]);

  const dismissCheckout = useCallback(() => {
    if (view.phase === "placed") {
      clearOrder();
      return;
    }
    phaseRef.current = "shopping";
    setPlacedDrinks(null);
    setCheckout({ phase: "shopping", cursor: tokenize(transcript).length, orderNo: null });
  }, [clearOrder, transcript, view.phase]);

  const placeFromClick = useCallback(() => {
    if (view.phase !== "review" || drinks.length === 0) return;
    setPlacedDrinks(drinks);
    setCheckout({
      ...view,
      phase: "placed",
      orderNo: view.orderNo ?? orderNumberFrom(`${transcript}|click`),
    });
  }, [drinks, transcript, view]);

  const toggleMic = useCallback(() => {
    if (listening) {
      stopMic();
      return;
    }
    begin();
  }, [begin, listening, stopMic]);

  if (view !== checkout) setCheckout(view);
  if (view.phase === "placed" && placedDrinks == null) setPlacedDrinks(drinks);
  if (view.phase !== "placed" && placedDrinks != null) setPlacedDrinks(null);

  const totalAsk = totalAskedAt(tokenize(transcript));
  const showTotal = totalAsk >= 0 && view.phase === "shopping" && !gate && drinks.length > 0;

  const latency = demoMode ? latencyAt(demoNow) : heard ? liveLatency : null;
  const speaking = demoMode ? speakingAt(demoNow) : micSpeaking;
  const showClear = clearControlVisible({
    gate,
    shot,
    listening,
    transcript,
    drinkCount: drinks.length,
    demoPlaying: playing,
  });

  return (
    <main className="relative h-dvh overflow-hidden bg-[#1d332c] text-white select-none">
      {!shot && (
        <button
          type="button"
          data-demo
          onClick={playDemo}
          className={`demo-link absolute z-50 ${gate ? "hero-demo" : "top-[22px] left-[26px]"}`}
        >
          {playing ? "Replay demo" : "Play demo"}
        </button>
      )}

      <div inert={gate || view.phase !== "shopping" ? true : undefined} className={`absolute inset-0${gate ? " pointer-events-none" : ""}`}>
      {showClear && (
        <button
          type="button"
          onClick={clearOrder}
          aria-label="Clear"
          title="Clear"
          className="absolute top-[18px] right-[22px] z-40 flex h-10 w-10 items-center justify-center rounded-full text-[#8a9990] transition-colors hover:bg-[#152621] hover:text-white focus-visible:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2fbf6e]"
        >
          <ClearIcon />
        </button>
      )}

      <div className="absolute inset-x-0 top-0 bottom-[14vh] flex items-center justify-center">
        <AnimatePresence>
          {drinks.length === 0 && (
            <motion.h1
              key="prompt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute -translate-y-[18px] px-8 text-center text-[clamp(40px,3vw,64px)] font-medium tracking-[-0.025em] text-white"
            >
              What can I get started for you?
            </motion.h1>
          )}
        </AnimatePresence>
        <LayoutGroup>
          <motion.div layout className="flex max-w-full items-end justify-center gap-[clamp(48px,11vw,240px)] overflow-x-auto px-12 py-[32px]">
            <AnimatePresence mode="popLayout">
              {drinks.map((drink) => (
                <motion.div
                  layout
                  key={drink.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{
                    layout: { type: "spring", stiffness: 380, damping: 34 },
                    opacity: { duration: 0.3 },
                    scale: { duration: 0.3 },
                  }}
                >
                  <DrinkCard drink={drink} gold={gold[drink.id] ?? []} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>
      </div>

      {showTotal && <TotalCallout drinks={drinks} askKey={String(totalAsk)} />}

      <TranscriptBar
        transcript={transcript}
        latency={latency}
        speaking={speaking}
        listening={listening}
        onMic={toggleMic}
        source={demoMode ? null : decisionSource}
        stt={demoMode ? null : sttLabel(engine)}
        notice={speechError}
        meter={meterShowsStart(micPermission) ? "start" : "dots"}
      />
      <p className="sr-only" aria-live="polite">
        {view.phase === "placed"
          ? `Order ${view.orderNo ?? ""} placed.`
          : view.phase === "review"
            ? "Checkout is open. Say place the order to confirm."
            : drinks.length === 0
              ? "Waiting for an order."
              : drinks.map((drink) => `${drinkTitle(drink)}, ${drink.size}, ${drink.shots} shots, ${drink.milk} milk, ${drink.temp}`).join(". ")}
      </p>
      </div>
      <AnimatePresence>
        {gate && <StartScreen key="start" onStart={begin} permission={micPermission} starting={starting} />}
      </AnimatePresence>
      {view.phase !== "shopping" && !gate && (
        <CheckoutModal
          phase={view.phase}
          drinks={receiptDrinks}
          orderNo={view.orderNo}
          calm={celebrationKind(reducedMotion) === "calm"}
          onDismiss={dismissCheckout}
          onPlace={placeFromClick}
        />
      )}
      <OrderConfetti burstKey={burstKey} />
    </main>
  );
}

function ClearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4.5 7h15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9 7V5.6A1.6 1.6 0 0 1 10.6 4h2.8A1.6 1.6 0 0 1 15 5.6V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7 7.5l.7 11.1A1.6 1.6 0 0 0 9.3 20h5.4a1.6 1.6 0 0 0 1.6-1.4L17 7.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M10 11.2v5.2M14 11.2v5.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
