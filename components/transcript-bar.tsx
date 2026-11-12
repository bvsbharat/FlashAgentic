"use client";

import { useEffect, useRef } from "react";

export default function TranscriptBar({
  transcript,
  latency,
  speaking,
  listening,
  onMic,
  source,
  stt,
  notice,
  meter,
}: {
  transcript: string;
  latency: number | null;
  speaking: boolean;
  listening: boolean;
  onMic: () => void;
  source: "jev" | "parser" | null;
  stt: "AssemblyAI" | "Chrome" | null;
  notice: string | null;
  meter: "start" | "dots";
}) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollLeft = node.scrollWidth;
  }, [transcript]);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[max(18px,2.5vh)] z-20 flex justify-center px-[max(16px,2vw)]">
      <div className="transcript-pill pointer-events-auto flex items-center gap-[clamp(10px,1.2vh,16px)] rounded-full bg-[#152621] pr-[clamp(10px,1.1vh,16px)] pl-[clamp(18px,2vh,28px)]">
        <div ref={scroller} className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
          <div className="flex w-max items-center whitespace-nowrap text-[clamp(16px,1.65vh,23px)] font-normal text-white">
            <span>{notice && !transcript ? notice : transcript}</span>
            <span className="caret" aria-hidden />
          </div>
        </div>
        {stt && (
          <span className="shrink-0 text-[clamp(11px,0.95vh,13px)] font-medium tracking-[0.04em] text-[#6d7e76]">
            {stt}
          </span>
        )}
        {source && (
          <span className="shrink-0 text-[clamp(11px,0.95vh,13px)] font-medium tracking-[0.04em] text-[#6d7e76] uppercase">
            {source === "jev" ? "Jev" : "parser"}
          </span>
        )}
        {latency != null && (
          <span className="shrink-0 text-[clamp(12px,1.05vh,15px)] font-normal tracking-[0.01em] text-[#6d7e76] tabular-nums">
            {latency} ms
          </span>
        )}
        <button
          type="button"
          data-meter={meter}
          onClick={onMic}
          aria-pressed={listening}
          aria-label={listening ? "Stop listening" : meter === "start" ? "Start" : "Start listening"}
          className={`viz flex shrink-0 items-center justify-center ${listening ? "shadow-[0_0_0_3px_#2fbf6e]" : ""}`}
        >
          {meter === "start" ? (
            <span className="text-[clamp(13px,1.25vh,16px)] font-medium tracking-[0.01em] text-[#1a2420]">Start</span>
          ) : (
            <Bars speaking={speaking} />
          )}
        </button>
      </div>
    </div>
  );
}

function Bars({ speaking }: { speaking: boolean }) {
  const bars = [0.78, 0.92, 1, 0.88, 0.74];
  return (
    <span className="flex h-[58%] items-center gap-[5px]" aria-hidden>
      {bars.map((weight, index) => (
        <span
          key={index}
          className={`w-[7px] rounded-full bg-[#1a2420] ${speaking ? "bar-live" : "h-[18%]"}`}
          style={
            speaking
              ? { animationDelay: `${index * 0.08}s`, ["--bar" as string]: String(weight) }
              : undefined
          }
        />
      ))}
    </span>
  );
}
