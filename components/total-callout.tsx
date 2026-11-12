"use client";

import { buildReceipt, formatMoney, TAX_LABEL } from "@/lib/checkout";
import type { Drink } from "@/lib/types";

/** Running total shown when the guest asks "what's my total?". Updates live if the order changes. */
export default function TotalCallout({ drinks, askKey }: { drinks: Drink[]; askKey: string }) {
  const receipt = buildReceipt(drinks);
  const count = drinks.length;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[clamp(28px,5vh,72px)] z-30 flex justify-center" role="status" aria-live="polite">
      <div key={askKey} data-total className="total-callout flex items-center gap-[clamp(18px,1.6vw,28px)] rounded-full border border-[#e0b44c]/50 bg-[#152621] py-[clamp(12px,1.3vh,18px)] pr-[clamp(26px,2.2vw,40px)] pl-[clamp(22px,1.9vw,34px)]">
        <span className="text-[clamp(13px,1.2vh,16px)] font-medium tracking-[0.18em] text-[#a3b0a8] uppercase">Your total</span>
        <span key={receipt.total} className="total-amount text-[clamp(30px,3.3vh,46px)] font-semibold tabular-nums tracking-[-0.02em] text-[#e0b44c]">
          {formatMoney(receipt.total)}
        </span>
        <span className="text-[clamp(14px,1.35vh,18px)] text-[#a3b0a8]">
          {count} {count === 1 ? "drink" : "drinks"} · incl. {TAX_LABEL} tax
        </span>
      </div>
    </div>
  );
}
