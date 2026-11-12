"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#f4f0e6", "#e0b44c", "#c4a574", "#2fbf6e", "#e7d7c1", "#d7c2a4", "#8aa57c", "#fffaf2", "#6f4e37"];

type Bit = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  color: string;
  shape: "bean" | "dot" | "cup";
  life: number;
};

/**
 * One coffee-colored burst. The parent passes a new key for each placed order
 * and passes null when the visitor prefers reduced motion.
 */
export default function OrderConfetti({ burstKey }: { burstKey: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!burstKey) return;
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let raf = 0;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    const bits: Bit[] = [];
    const originX = canvas.width / 2;
    const originY = canvas.height * 0.42;
    for (let index = 0; index < 130; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 5.5 + Math.random() * 10.5;
      bits.push({
        x: originX + (Math.random() - 0.5) * 40,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 5,
        w: 7 + Math.random() * 9,
        h: 8 + Math.random() * 11,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.28,
        color: COLORS[index % COLORS.length],
        shape: (["bean", "dot", "cup"] as const)[index % 3],
        life: 1,
      });
    }

    const tick = () => {
      frame += 1;
      context.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const bit of bits) {
        bit.vy += 0.16;
        bit.x += bit.vx;
        bit.y += bit.vy;
        bit.vx *= 0.992;
        bit.rot += bit.vr;
        bit.life -= 0.0075;
        if (bit.life <= 0) continue;
        alive = true;
        context.save();
        context.translate(bit.x, bit.y);
        context.rotate(bit.rot);
        context.globalAlpha = Math.max(0, bit.life);
        context.fillStyle = bit.color;
        if (bit.shape === "dot") {
          context.beginPath();
          context.arc(0, 0, bit.w * 0.32, 0, Math.PI * 2);
          context.fill();
        } else if (bit.shape === "cup") {
          context.fillRect(-bit.w / 2, -bit.h / 4, bit.w, bit.h * 0.62);
          context.fillRect(-bit.w / 2 - 1, -bit.h / 4 - 3, bit.w + 2, 3.5);
        } else {
          context.beginPath();
          context.ellipse(0, 0, bit.w * 0.48, bit.h * 0.26, 0.5, 0, Math.PI * 2);
          context.fill();
        }
        context.restore();
      }
      if (alive && frame < 240) raf = requestAnimationFrame(tick);
      else context.clearRect(0, 0, canvas.width, canvas.height);
    };

    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [burstKey]);

  if (!burstKey) return null;
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[90]" aria-hidden data-confetti={burstKey} />;
}
