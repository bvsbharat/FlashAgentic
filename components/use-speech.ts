"use client";

import {
  applyAssemblyTurn,
  ASSEMBLY_SAMPLE_RATE,
  ASSEMBLY_SPEECH_MODEL,
  EMPTY_ASSEMBLY,
  renderAssemblyTranscript,
  sealAssemblyTranscript,
  sessionRotateDelayMs,
  shouldReconnect,
  type AssemblyTranscriptState,
} from "@/lib/assemblyai-transcript";
import {
  micBlockMessage,
  permissionFromCaptureError,
  permissionFromQuery,
  type MicPermission,
} from "@/lib/mic-permission";
import { floatToPcm16, LinearResampler, microphoneConstraints, PcmChunker, TARGET_SAMPLE_RATE } from "@/lib/pcm";
import { commitSession, liveTranscript, type SpeechPiece } from "@/lib/speech-session";
import { useCallback, useEffect, useRef, useState } from "react";

type SpeechResult = SpeechPiece & {
  0?: { transcript?: string };
  isFinal: boolean;
};

type SpeechEvent = {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
};

type SpeechErrorEvent = { error?: string };

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  processLocally?: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechCtor = {
  new (): SpeechRec;
  available?: (options: { langs: string[]; processLocally: boolean }) => Promise<string>;
  install?: (options: { langs: string[]; processLocally: boolean }) => Promise<boolean>;
};

type Transcriber = {
  on(event: "turn", listener: (event: { type?: string; turn_order?: number; end_of_turn?: boolean; transcript?: string; utterance?: string; words?: { text?: string }[] }) => void): void;
  on(event: "speechStarted", listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;
  on(event: "close", listener: (code: number, reason: string) => void): void;
  connect(): Promise<unknown>;
  sendAudio(audio: ArrayBufferLike): void;
  close(waitForSessionTermination?: boolean, terminationTimeout?: number): Promise<void>;
};

export type SttEngine = "assemblyai" | "chrome";

function recognitionCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const host = window as unknown as {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

function piecesFrom(event: SpeechEvent): SpeechPiece[] {
  const pieces: SpeechPiece[] = [];
  for (let index = 0; index < event.results.length; index += 1) {
    const result = event.results[index];
    pieces.push({
      transcript: result?.[0]?.transcript ?? result?.transcript ?? "",
      isFinal: Boolean(result?.isFinal),
    });
  }
  return pieces;
}

function preferOnDevice(Ctor: SpeechCtor, recognition: SpeechRec) {
  if (typeof Ctor.available !== "function") return;
  void (async () => {
    try {
      let status = await Ctor.available?.({ langs: ["en-US"], processLocally: true });
      if ((status === "downloadable" || status === "downloading") && typeof Ctor.install === "function") {
        const installed = await Ctor.install({ langs: ["en-US"], processLocally: true });
        if (installed) status = "available";
      }
      if (status === "available") recognition.processLocally = true;
    } catch {
      // Chrome's default recognizer still works with processLocally left off.
    }
  })();
}

export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<SttEngine | null>(null);
  const [micPermission, setMicPermission] = useState<MicPermission>("prompt");
  const recognitionRef = useRef<SpeechRec | null>(null);
  const shouldListen = useRef(false);
  const generation = useRef(0);
  const committedRef = useRef("");
  const sessionRef = useRef<SpeechPiece[]>([]);
  const speakTimer = useRef<number | null>(null);
  const assemblyReady = useRef<boolean | null>(null);
  const assemblyState = useRef<AssemblyTranscriptState>(EMPTY_ASSEMBLY);
  const engineRef = useRef<SttEngine | null>(null);
  const transcriberRef = useRef<Transcriber | null>(null);
  const senderRef = useRef<((pcm: Int16Array) => void) | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const rotateTimer = useRef<number | null>(null);
  const reconnects = useRef(0);
  const replacing = useRef(false);
  const replaceRef = useRef<(gen: number, reason: "rotate" | "drop") => Promise<void>>(async () => {});
  const chunkerRef = useRef(new PcmChunker());
  const resamplerRef = useRef<LinearResampler | null>(null);
  const inflight = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    const hasMic = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
    setSupported(recognitionCtor() !== null || hasMic);
  }, []);

  useEffect(() => {
    const permissions = navigator.permissions;
    if (!permissions?.query) return;
    let status: PermissionStatus | null = null;
    let cancelled = false;
    permissions
      .query({ name: "microphone" as PermissionName })
      .then((result) => {
        if (cancelled) return;
        status = result;
        setMicPermission((current) => (current === "granted" ? current : permissionFromQuery(result.state)));
        result.onchange = () => setMicPermission(permissionFromQuery(result.state));
      })
      .catch(() => {
        // Some browsers reject a microphone query. The next getUserMedia call still reports the real result.
      });
    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/assemblyai-token?probe=1", { cache: "no-store" })
      .then((response) => response.json())
      .then((body: { assemblyai?: boolean }) => {
        if (cancelled) return;
        assemblyReady.current = Boolean(body.assemblyai);
      })
      .catch(() => {
        if (!cancelled) assemblyReady.current = false;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const publish = useCallback((committed: string, session: SpeechPiece[]) => {
    committedRef.current = committed;
    sessionRef.current = session;
    setTranscript(liveTranscript(committed, session));
  }, []);

  const publishAssembly = useCallback((state: AssemblyTranscriptState) => {
    assemblyState.current = state;
    setTranscript(renderAssemblyTranscript(state));
  }, []);

  const markSpeaking = useCallback(() => {
    setSpeaking(true);
    if (speakTimer.current) window.clearTimeout(speakTimer.current);
    speakTimer.current = window.setTimeout(() => setSpeaking(false), 500);
  }, []);

  const teardownAudio = useCallback(() => {
    senderRef.current = null;
    const transcriber = transcriberRef.current;
    transcriberRef.current = null;
    if (rotateTimer.current != null) {
      window.clearTimeout(rotateTimer.current);
      rotateTimer.current = null;
    }
    try {
      workletRef.current?.disconnect();
    } catch {
      /* already disconnected */
    }
    try {
      sourceRef.current?.disconnect();
    } catch {
      /* already disconnected */
    }
    try {
      gainRef.current?.disconnect();
    } catch {
      /* already disconnected */
    }
    workletRef.current = null;
    sourceRef.current = null;
    gainRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const context = audioRef.current;
    audioRef.current = null;
    if (context && context.state !== "closed") void context.close().catch(() => {});
    if (transcriber) void transcriber.close(false, 250).catch(() => {});
    resamplerRef.current = null;
    chunkerRef.current = new PcmChunker();
  }, []);

  const resume = useCallback((recognition: SpeechRec) => {
    if (!shouldListen.current || engineRef.current !== "chrome") return;
    try {
      recognition.start();
      setListening(true);
      setError(null);
    } catch {
      window.setTimeout(() => {
        if (!shouldListen.current || engineRef.current !== "chrome") return;
        try {
          recognition.start();
          setListening(true);
        } catch {
          setListening(false);
          setError("Microphone didn't start. Click the meter and try again.");
        }
      }, 250);
    }
  }, []);

  const ensure = useCallback(
    (Ctor: SpeechCtor) => {
      if (recognitionRef.current) return recognitionRef.current;
      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (event) => {
        if (!shouldListen.current || engineRef.current !== "chrome") return;
        publish(committedRef.current, piecesFrom(event));
        markSpeaking();
      };
      recognition.onerror = (event) => {
        const code = event.error ?? "";
        if (code === "language-not-supported" && recognition.processLocally) {
          recognition.processLocally = false;
          try {
            recognition.stop();
          } catch {
            /* onend restarts with Chrome's default recognizer */
          }
          return;
        }
        if (code === "not-allowed" || code === "service-not-allowed") {
          shouldListen.current = false;
          setListening(false);
          setMicPermission("denied");
          setError(micBlockMessage("denied"));
          return;
        }
      };
      recognition.onend = () => {
        const gen = generation.current;
        if (!shouldListen.current || engineRef.current !== "chrome") {
          setListening(false);
          setSpeaking(false);
          return;
        }
        publish(commitSession(committedRef.current, sessionRef.current), []);
        window.setTimeout(() => {
          if (!shouldListen.current || generation.current !== gen || engineRef.current !== "chrome") return;
          resume(recognition);
        }, 200);
      };
      recognitionRef.current = recognition;
      return recognition;
    },
    [markSpeaking, publish, resume],
  );

  const startChrome = useCallback(
    (reset: boolean) => {
      const Ctor = recognitionCtor();
      if (!Ctor) {
        setSupported(false);
        setListening(false);
        setError("Speech recognition needs Chrome.");
        return;
      }
      teardownAudio();
      engineRef.current = "chrome";
      setEngine("chrome");
      setSupported(true);
      setError(null);
      if (reset) {
        assemblyState.current = EMPTY_ASSEMBLY;
        publish("", []);
      } else {
        const kept = renderAssemblyTranscript(assemblyState.current);
        assemblyState.current = kept ? { prefix: kept, turns: [], partial: "" } : EMPTY_ASSEMBLY;
        publish(kept, []);
      }
      const recognition = ensure(Ctor);
      try {
        recognition.start();
        setListening(true);
      } catch {
        try {
          recognition.stop();
        } catch {
          /* already stopped */
        }
        window.setTimeout(() => resume(recognition), 200);
      }
      preferOnDevice(Ctor, recognition);
    },
    [ensure, publish, resume, teardownAudio],
  );

  const connectAssembly = useCallback(
    async (gen: number): Promise<boolean> => {
      let response: Response;
      try {
        response = await fetch("/api/assemblyai-token", { cache: "no-store" });
      } catch {
        return false;
      }
      if (!response.ok) return false;
      const body = (await response.json().catch(() => null)) as {
        token?: unknown;
        max_session_duration_seconds?: unknown;
      } | null;
      const token = typeof body?.token === "string" ? body.token : "";
      if (!token) return false;
      if (generation.current !== gen || !shouldListen.current) return false;

      const sdk = await import("assemblyai/streaming");
      const transcriber = new sdk.StreamingTranscriber({
        token,
        sampleRate: ASSEMBLY_SAMPLE_RATE,
        encoding: "pcm_s16le",
        speechModel: ASSEMBLY_SPEECH_MODEL,
        mode: "min_latency",
        maxConnectionRetries: 1,
        connectionRetryDelay: 250,
        connectTimeout: 8000,
      }) as unknown as Transcriber;

      transcriber.on("turn", (event) => {
        if (generation.current !== gen || !shouldListen.current || transcriberRef.current !== transcriber) return;
        publishAssembly(applyAssemblyTurn(assemblyState.current, event));
        markSpeaking();
      });
      transcriber.on("speechStarted", () => {
        if (generation.current !== gen || transcriberRef.current !== transcriber) return;
        markSpeaking();
      });
      transcriber.on("error", () => {
        if (generation.current !== gen || !shouldListen.current || transcriberRef.current !== transcriber) return;
        window.setTimeout(() => {
          if (transcriberRef.current !== transcriber || !shouldListen.current || generation.current !== gen) return;
          void replaceRef.current(gen, "drop");
        }, 400);
      });
      transcriber.on("close", () => {
        if (transcriberRef.current !== transcriber || !shouldListen.current || generation.current !== gen) return;
        void replaceRef.current(gen, "drop");
      });

      transcriberRef.current = transcriber;
      try {
        await transcriber.connect();
      } catch {
        if (transcriberRef.current === transcriber) transcriberRef.current = null;
        await transcriber.close(false, 200).catch(() => {});
        return false;
      }
      if (generation.current !== gen || !shouldListen.current || transcriberRef.current !== transcriber) {
        await transcriber.close(false, 200).catch(() => {});
        if (transcriberRef.current === transcriber) transcriberRef.current = null;
        return false;
      }
      senderRef.current = (pcm) => {
        try {
          transcriber.sendAudio(pcm.buffer);
        } catch {
          /* socket closed between chunks */
        }
      };
      const maxSeconds =
        typeof body?.max_session_duration_seconds === "number" ? body.max_session_duration_seconds : 480;
      if (rotateTimer.current != null) window.clearTimeout(rotateTimer.current);
      rotateTimer.current = window.setTimeout(() => {
        if (generation.current !== gen || !shouldListen.current) return;
        void replaceRef.current(gen, "rotate");
      }, sessionRotateDelayMs(maxSeconds));
      return true;
    },
    [markSpeaking, publishAssembly],
  );

  const replaceSocket = useCallback(
    async (gen: number, reason: "rotate" | "drop") => {
      if (replacing.current || generation.current !== gen || !shouldListen.current) return;
      if (
        reason === "drop" &&
        !shouldReconnect({ listening: true, intentionalClose: false, attempts: reconnects.current })
      ) {
        startChrome(false);
        return;
      }
      replacing.current = true;
      if (reason === "drop") reconnects.current += 1;
      try {
        publishAssembly(sealAssemblyTranscript(assemblyState.current));
        const previous = transcriberRef.current;
        transcriberRef.current = null;
        senderRef.current = null;
        if (rotateTimer.current != null) {
          window.clearTimeout(rotateTimer.current);
          rotateTimer.current = null;
        }
        await previous?.close(false, 250).catch(() => {});
        if (generation.current !== gen || !shouldListen.current) return;
        const opened = await connectAssembly(gen);
        if (!opened && generation.current === gen && shouldListen.current) startChrome(false);
      } finally {
        replacing.current = false;
      }
    },
    [connectAssembly, publishAssembly, startChrome],
  );
  replaceRef.current = replaceSocket;

  const startAssembly = useCallback(
    (gen: number, stream: MediaStream) => {
      const context = new AudioContext();
      audioRef.current = context;
      void context.resume().catch(() => {});
      stream.getVideoTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      setListening(true);

      void (async () => {
        if (generation.current !== gen || !shouldListen.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        try {
          await context.audioWorklet.addModule("/pcm-worklet.js");
          if (generation.current !== gen || !shouldListen.current) {
            teardownAudio();
            return;
          }
          const source = context.createMediaStreamSource(stream);
          const worklet = new AudioWorkletNode(context, "pcm-capture", {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            channelCount: 1,
          });
          const gain = context.createGain();
          gain.gain.value = 0;
          source.connect(worklet);
          worklet.connect(gain);
          gain.connect(context.destination);
          sourceRef.current = source;
          workletRef.current = worklet;
          gainRef.current = gain;
          resamplerRef.current = new LinearResampler(context.sampleRate || TARGET_SAMPLE_RATE, TARGET_SAMPLE_RATE);
          chunkerRef.current = new PcmChunker();
          worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
            if (generation.current !== gen || !shouldListen.current) return;
            const floats = event.data;
            if (!(floats instanceof Float32Array) || floats.length === 0) return;
            const resampler = resamplerRef.current;
            if (!resampler) return;
            const pcm = floatToPcm16(resampler.process(floats));
            const send = senderRef.current;
            if (!send) return;
            for (const chunk of chunkerRef.current.push(pcm)) send(chunk);
          };
          const opened = await connectAssembly(gen);
          if (generation.current !== gen || !shouldListen.current) {
            teardownAudio();
            return;
          }
          if (!opened) {
            startChrome(true);
            return;
          }
          engineRef.current = "assemblyai";
          setEngine("assemblyai");
          setSupported(true);
          setError(null);
        } catch {
          if (generation.current !== gen || !shouldListen.current) return;
          startChrome(true);
        }
      })();
    },
    [connectAssembly, startChrome, teardownAudio],
  );

  const start = useCallback((): Promise<boolean> => {
    if (inflight.current) return inflight.current;
    const media = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
    if (!media || typeof media.getUserMedia !== "function") {
      setMicPermission("unsupported");
      setError(micBlockMessage("unsupported"));
      return Promise.resolve(false);
    }
    // Invoked inside the click, before any await, so the browser can show
    // the microphone prompt. Audio only — the constraints have no video key.
    let micPromise: Promise<MediaStream>;
    try {
      micPromise = media.getUserMedia(microphoneConstraints());
    } catch (error) {
      const next = permissionFromCaptureError(error);
      setMicPermission(next);
      setError(micBlockMessage(next));
      return Promise.resolve(false);
    }
    const task = micPromise
      .then((stream) => {
        stream.getVideoTracks().forEach((track) => track.stop());
        setMicPermission("granted");
        shouldListen.current = true;
        generation.current += 1;
        const gen = generation.current;
        reconnects.current = 0;
        replacing.current = false;
        setError(null);
        setSpeaking(false);
        assemblyState.current = EMPTY_ASSEMBLY;
        engineRef.current = null;
        setEngine(null);
        publish("", []);
        if (assemblyReady.current === false) {
          stream.getTracks().forEach((track) => track.stop());
          startChrome(true);
          return true;
        }
        startAssembly(gen, stream);
        return true;
      })
      .catch((error: unknown) => {
        const next = permissionFromCaptureError(error);
        setMicPermission(next);
        setError(micBlockMessage(next));
        shouldListen.current = false;
        setListening(false);
        return false;
      })
      .finally(() => {
        if (inflight.current === task) inflight.current = null;
      });
    inflight.current = task;
    return task;
  }, [publish, startAssembly, startChrome]);

  const clear = useCallback(() => {
    shouldListen.current = false;
    generation.current += 1;
    engineRef.current = null;
    setEngine(null);
    setListening(false);
    setSpeaking(false);
    setError(null);
    assemblyState.current = EMPTY_ASSEMBLY;
    publish("", []);
    teardownAudio();
    try {
      recognitionRef.current?.abort();
    } catch {
      /* already stopped */
    }
  }, [publish, teardownAudio]);

  const stop = useCallback(() => {
    shouldListen.current = false;
    generation.current += 1;
    setListening(false);
    setSpeaking(false);
    if (engineRef.current === "assemblyai") {
      const text = renderAssemblyTranscript(assemblyState.current);
      assemblyState.current = text ? { prefix: text, turns: [], partial: "" } : EMPTY_ASSEMBLY;
      publish(text, []);
    } else {
      publish(commitSession(committedRef.current, sessionRef.current), []);
    }
    teardownAudio();
    try {
      recognitionRef.current?.stop();
    } catch {
      /* already stopped */
    }
  }, [publish, teardownAudio]);

  useEffect(() => {
    return () => {
      shouldListen.current = false;
      teardownAudio();
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, [teardownAudio]);

  return { supported, listening, transcript, speaking, error, engine, micPermission, start, stop, clear };
}
