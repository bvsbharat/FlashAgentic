"use client";

import { micBlockMessage, type MicPermission } from "@/lib/mic-permission";
import { START_GLASSES, type StartGlass } from "@/lib/start-scene";
import { motion, useReducedMotion } from "framer-motion";
import type { CSSProperties } from "react";

export default function StartScreen({
  onStart,
  permission,
  starting = false,
}: {
  onStart: () => void;
  permission: MicPermission;
  starting?: boolean;
}) {
  const reduce = useReducedMotion();
  const blocked = micBlockMessage(permission);
  const fade = reduce ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <motion.div
      className="welcome-screen pointer-events-auto absolute inset-0 z-[48] flex items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.28 }}
    >
      <div className="welcome-glow" aria-hidden />
      <div className="start-floats" data-floats aria-hidden>
        {START_GLASSES.map((glass) => (
          <FloatCup key={glass.id} glass={glass} />
        ))}
      </div>
      <motion.div
        className="relative z-10 flex w-full max-w-[760px] flex-col items-center text-center"
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={fade}
      >
        <p className="text-[13px] font-medium tracking-[0.32em] text-[#c4a574] uppercase">Voice counter</p>
        <h1
          id="start-title"
          className="mt-6 text-[clamp(64px,7.2vw,108px)] leading-[0.92] font-medium tracking-[-0.045em] text-[#f4efe6]"
        >
          What are you drinking?
        </h1>
        <p className="mt-6 text-[clamp(18px,1.6vw,22px)] text-[#d9c7ae]">Say the drink.</p>
        {blocked && (
          <p role="alert" data-mic-block className="mt-6 max-w-[520px] text-[18px] leading-relaxed text-[#f4efe6]">
            {blocked}
          </p>
        )}
        <button
          type="button"
          data-start
          autoFocus
          aria-busy={starting || undefined}
          aria-label={starting ? "Starting microphone" : "Start listening"}
          onClick={onStart}
          className={`sketch-start${starting ? " is-arming" : ""}`}
        >
          <svg className="sketch-svg" viewBox="0 0 140 140" aria-hidden>
            <g className="sketch-back">
              <path
                className="sketch-stroke"
                d="M72 16 C 102 12, 124 38, 122 70 C 126 102, 100 126, 68 122 C 38 126, 16 102, 18 70 C 14 38, 42 12, 72 16 Z"
              />
            </g>
            <path
              className="sketch-stroke sketch-front"
              pathLength="100"
              d="M70 11 C 106 7, 131 36, 128 70 C 132 106, 104 131, 70 128 C 34 132, 9 104, 12 70 C 8 34, 36 8, 70 11 Z"
            />
          </svg>
          <span>{starting ? "Starting" : "Start"}</span>
        </button>
        <p className="mt-4 text-[13px] tracking-[0.14em] text-[#a89078] uppercase">Enter or Space</p>
      </motion.div>
    </motion.div>
  );
}

function FloatCup({ glass }: { glass: StartGlass }) {
  return (
    <div
      data-float={glass.corner}
      className="float-cup"
      style={
        {
          top: glass.top != null ? `${glass.top}%` : undefined,
          bottom: glass.bottom != null ? `${glass.bottom}%` : undefined,
          left: glass.left != null ? `${glass.left}%` : undefined,
          right: glass.right != null ? `${glass.right}%` : undefined,
          "--size": `${glass.size}px`,
          "--tilt": `${glass.tilt}deg`,
          "--dx": `${glass.dx}px`,
          "--dy": `${glass.dy}px`,
          "--spin": `${glass.spin}deg`,
          "--from-x": `${glass.fromX}px`,
          "--from-y": `${glass.fromY}px`,
          "--dur": `${glass.dur}s`,
          "--delay": `${glass.delay}s`,
          "--fade": String(glass.fade),
        } as CSSProperties
      }
    >
      <img src={glass.image} alt="" draggable={false} className="cup-image" />
      {glass.steam && (
        <svg className="cup-steam" viewBox="0 0 40 28" aria-hidden>
          <path d="M12 26c2-6 2-8 0-14" />
          <path d="M20 26c2-7 2-9 0-16" />
          <path d="M28 26c2-5 2-7 0-12" />
        </svg>
      )}
    </div>
  );
}
