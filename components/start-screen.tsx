"use client";

import { micBlockMessage, type MicPermission } from "@/lib/mic-permission";
import { BRAND_LOGO, HERO_BG, HERO_CUPS, LANDING_TILES } from "@/lib/start-scene";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type PointerEvent } from "react";

const ROTATE_MS = 4200;

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
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const [visible, setVisible] = useState(true);
  const dragX = useRef<number | null>(null);
  const cup = HERO_CUPS[shown] ?? HERO_CUPS[0];

  useEffect(() => {
    if (reduce) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % HERO_CUPS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [reduce, index]);

  useEffect(() => {
    if (shown === index) return;
    if (reduce) {
      setShown(index);
      setVisible(true);
      return;
    }
    setVisible(false);
    const timer = window.setTimeout(() => {
      setShown(index);
      setVisible(true);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [index, reduce, shown]);

  function step(direction: 1 | -1) {
    setIndex((current) => (current + (direction === 1 ? 1 : HERO_CUPS.length - 1)) % HERO_CUPS.length);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    dragX.current = event.clientX;
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragX.current == null) return;
    const delta = event.clientX - dragX.current;
    dragX.current = null;
    if (Math.abs(delta) < 42) return;
    step(delta < 0 ? 1 : -1);
  }

  return (
    <motion.div
      className="welcome-screen pointer-events-auto absolute inset-0 z-[48]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.28 }}
    >
      <img src={HERO_BG} alt="" className="hero-bg" />
      <div className="hero-shade" aria-hidden />
      <div className="hero-layout">
        <header className="hero-nav">
          <a className="hero-brand" href="#start-title">
            <img src={BRAND_LOGO} alt="Flash Agentic" width={48} height={48} />
          </a>
          <nav className="hero-links" aria-label="Welcome">
            <a href="#landing-menu">Menu</a>
            <a href="#how-it-works">How it works</a>
            <a href="#about">About</a>
          </nav>
        </header>

        <div className="hero-copy">
          <p className="hero-eyebrow">Flash Agentic is...</p>
          <h1 id="start-title" className="hero-title">
            <span>
              Just say <strong>what</strong>
            </span>
            <span>
              you <strong>want</strong>
            </span>
          </h1>
          <p id="how-it-works" className="sr-only">
            Say the drink. The counter builds the order while you talk, then you confirm by voice.
          </p>
          {blocked && (
            <p role="alert" data-mic-block className="hero-block">
              {blocked}
            </p>
          )}
          <div className="hero-actions">
            <button
              type="button"
              data-start
              autoFocus
              aria-busy={starting || undefined}
              aria-label={starting ? "Starting microphone" : "Start listening"}
              onClick={onStart}
              className="hero-primary"
            >
              <MicIcon />
              <span>{starting ? "Starting" : "Start Ordering"}</span>
            </button>
            <button type="button" className="hero-secondary" onClick={onStart}>
              <WaveIcon />
              <span>No Buttons. Just Voice</span>
            </button>
          </div>
          <p className="hero-keys">Enter or Space</p>
          <ul id="landing-menu" className="hero-tiles">
            {LANDING_TILES.map((tile) => (
              <li key={tile.id}>
                <img src={tile.image} alt={tile.name} draggable={false} />
              </li>
            ))}
          </ul>
          <p id="about" className="sr-only">
            Flash Agentic is a voice coffee counter. A lightning bolt is the mark.
          </p>
        </div>

        <aside className="hero-panel" aria-hidden>
          <div className="hero-words">
            <span className="is-outline">{cup.label}</span>
            <span className="is-solid">{cup.label}</span>
          </div>
          <div
            className={reduce ? "hero-stage is-still" : "hero-stage"}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              dragX.current = null;
            }}
          >
            <img
              key={cup.id}
              src={cup.image}
              alt=""
              draggable={false}
              className={visible ? "hero-cup-photo is-on" : "hero-cup-photo"}
            />
          </div>
          <span className="hero-heart">
            <HeartIcon />
          </span>
        </aside>
      </div>
    </motion.div>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 17v3.2M9 20.2h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 20s-7-4.4-7-9.1C5 8 6.8 6.2 9.1 6.2c1.3 0 2.4.6 2.9 1.6.5-1 1.6-1.6 2.9-1.6 2.3 0 4.1 1.8 4.1 4.7C19 15.6 12 20 12 20Z"
        fill="#ff4d6a"
      />
    </svg>
  );
}
