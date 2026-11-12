"use client";

import { buildReceipt, formatMoney, TAX_LABEL, type CheckoutPhase } from "@/lib/checkout";
import { drinkImage, type Drink } from "@/lib/types";
import { useEffect, useId, useRef, type ReactNode } from "react";

export default function CheckoutModal({
  phase,
  drinks,
  orderNo,
  calm,
  onDismiss,
  onPlace,
}: {
  phase: Exclude<CheckoutPhase, "shopping">;
  drinks: Drink[];
  orderNo: string | null;
  calm: boolean;
  onDismiss: () => void;
  onPlace: () => void;
}) {
  const titleId = useId();
  const promptId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const placed = phase === "placed";
  const receipt = buildReceipt(drinks);
  const canPlace = drinks.length > 0;

  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    const previously = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        dismissRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = [...node.querySelectorAll<HTMLElement>("button:not(:disabled)")];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previously?.focus();
    };
  }, [phase]);

  return (
    <div
      className="checkout-overlay fixed inset-0 z-[80] flex items-center justify-center px-4 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={promptId}
        tabIndex={-1}
        data-checkout={phase}
        data-celebration={placed ? (calm ? "calm" : "confetti") : undefined}
        className="checkout-panel relative flex max-h-[min(92dvh,840px)] w-full max-w-[560px] flex-col overflow-hidden rounded-[28px] bg-[#14241f] text-white shadow-[0_24px_80px_rgba(0,0,0,0.4)] outline-none"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-3 sm:px-8">
          {placed ? (
            <div className="flex flex-col items-center text-center">
              <div className={`checkout-check${calm ? " is-calm" : ""}`} aria-hidden>
                <svg viewBox="0 0 64 64" className="h-11 w-11">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="#2fbf6e" strokeWidth="2.5" />
                  <path d="M20 33.5 28 41.5 45 23" fill="none" stroke="#f4f0e6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="mt-2 text-[13px] font-medium tracking-[0.22em] text-[#8a9990] uppercase">Ticket {orderNo}</p>
              <h2 id={titleId} className="mt-1 text-[clamp(32px,3.4vw,40px)] font-medium tracking-[-0.03em]">
                Order placed
              </h2>
              <p id={promptId} className="mt-2 max-w-[360px] text-[clamp(16px,1.6vw,18px)] leading-relaxed text-[#c5d1cb]">
                Thank you. We will start on it. Say “close”, or press Escape.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[13px] font-medium tracking-[0.22em] text-[#8a9990] uppercase">Checkout</p>
              <h2 id={titleId} className="mt-2 text-[clamp(32px,3.6vw,44px)] font-medium tracking-[-0.03em]">
                Your order
              </h2>
              <p id={promptId} className="mt-3 text-[clamp(16px,1.5vw,18px)] leading-snug text-[#f3f1ea]">
                Say “place the order” to confirm.
              </p>
              <p className="mt-1 text-[14px] text-[#8a9990]">“Place it” or “confirm” works too. “Go back” keeps editing.</p>
            </>
          )}

          <ul className="mt-4 flex flex-col gap-2" aria-label="Order items">
            {drinks.length === 0 && (
              <li className="rounded-2xl bg-[#1d332c] px-4 py-5 text-[16px] text-[#c5d1cb]">Nothing on the ticket yet. Add a drink, then come back.</li>
            )}
            {drinks.map((item) => {
              const line = receipt.lines.find((entry) => entry.id === item.id);
              return (
                <li key={item.id} className="flex items-center gap-3 rounded-2xl bg-[#1d332c] px-3 py-2">
                  <img src={drinkImage(item.type, item.temp)} alt="" className="h-14 w-12 shrink-0 object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[18px] font-medium tracking-[-0.02em]">{line?.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#a3b0a8]">
                      <Detail icon={<SizeMark size={item.size} />} label={item.size} />
                      <Detail icon={<ShotMark count={item.shots} />} label={`${item.shots} ${item.shots === 1 ? "shot" : "shots"}`} />
                      <Detail icon={<MilkMark />} label={item.milk === "Whole" ? "Whole" : `${item.milk} milk`} />
                      <Detail icon={item.temp === "Iced" ? <IceMark /> : <HeatMark />} label={item.temp} />
                    </p>
                  </div>
                  <p className="shrink-0 text-[16px] tabular-nums text-[#f3f1ea]">{formatMoney(line?.cents ?? 0)}</p>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="shrink-0 border-t border-[#2a4038] px-6 pt-4 sm:px-8">
          <dl className="space-y-2 text-[15px] text-[#c5d1cb]">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd className="tabular-nums text-white">{formatMoney(receipt.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Tax ({TAX_LABEL})</dt>
              <dd className="tabular-nums text-white">{formatMoney(receipt.tax)}</dd>
            </div>
            <div className="flex justify-between border-t border-[#2a4038] pt-3 text-[20px] font-medium text-white">
              <dt>Total</dt>
              <dd className="tabular-nums text-[#e0b44c]">{formatMoney(receipt.total)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-[13px] text-[#6d7e76]">Simulated total. Nothing is charged.</p>
        </div>

        <div className="flex shrink-0 gap-3 px-6 py-4 sm:px-8">
          <button
            type="button"
            onClick={onDismiss}
            className="checkout-button flex-1 rounded-full border border-[#3d564c] px-4 py-3 text-[16px] font-medium text-[#f3f1ea] hover:border-[#f3f1ea] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2fbf6e] active:scale-[0.98]"
          >
            {placed ? "Close" : "Go back"}
          </button>
          {!placed && (
            <button
              type="button"
              onClick={onPlace}
              disabled={!canPlace}
              className="checkout-button flex-[1.4] rounded-full bg-[#f3f1ea] px-4 py-3 text-[16px] font-medium text-[#1a2420] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2fbf6e] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Place order
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {icon}
      <span>{label}</span>
    </span>
  );
}

function SizeMark({ size }: { size: Drink["size"] }) {
  const h = size === "Tall" ? 8 : size === "Grande" ? 11 : 14;
  return (
    <svg viewBox="0 0 14 16" className="h-3.5 w-3.5" aria-hidden>
      <path d={`M3 ${16 - h}h8l-1 ${h - 2}H4z`} fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function ShotMark({ count }: { count: number }) {
  const dots = Math.min(3, count);
  return (
    <svg viewBox="0 0 16 10" className="h-3 w-4" aria-hidden>
      {Array.from({ length: dots }, (_, index) => (
        <circle key={index} cx={3 + index * 5} cy="5" r="1.6" fill="currentColor" />
      ))}
    </svg>
  );
}

function MilkMark() {
  return (
    <svg viewBox="0 0 12 14" className="h-3.5 w-3" aria-hidden>
      <path d="M6 1.5c2 2.4 3.2 4.2 3.2 6.2a3.2 3.2 0 0 1-6.4 0C2.8 5.7 4 3.9 6 1.5z" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function HeatMark() {
  return (
    <svg viewBox="0 0 12 14" className="h-3.5 w-3" aria-hidden>
      <path d="M6 12.5c2.2 0 3.4-1.5 3.4-3.2 0-2.2-2-3.3-2-5.3 0 1.6-1.2 2.4-1.8 3.2-.4-1.6-1.6-2.6-1.6-4.4 0 2.6-2.4 3.6-2.4 6.4 0 1.8 1.4 3.3 4.4 3.3z" fill="currentColor" />
    </svg>
  );
}

function IceMark() {
  return (
    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden>
      <path d="M7 1.5v11M2.2 4.2l9.6 5.6M11.8 4.2 2.2 9.8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
