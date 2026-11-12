"use client";

import { MilkIcons, ShotIcons, SizeIcons, TempIcons } from "@/components/icons";
import { drinkImage, drinkTitle, milkLabel, shotsLabel, type Drink, type OptionField } from "@/lib/types";
import type { ReactNode } from "react";

const SIZE_INDEX = { Tall: 0, Grande: 1, Venti: 2 } as const;
const MILK_INDEX = { Whole: 0, Oat: 1, Almond: 2, Skim: -1 } as const;

export default function DrinkCard({ drink, gold }: { drink: Drink; gold: OptionField[] }) {
  const hot = drink.temp === "Hot";
  return (
    <article className="flex w-max flex-col items-center">
      <div className="relative flex h-[clamp(210px,21.6vh,314px)] w-[clamp(180px,16vw,300px)] items-end justify-center">
        <img
          src={drinkImage(drink.type, "Hot")}
          alt=""
          className={`absolute bottom-0 max-h-full max-w-full object-contain transition-opacity duration-300 ${hot ? "opacity-100" : "opacity-0"}`}
        />
        <img
          src={drinkImage(drink.type, "Iced")}
          alt=""
          className={`absolute bottom-0 max-h-full max-w-full object-contain transition-opacity duration-300 ${hot ? "opacity-0" : "opacity-100"}`}
        />
      </div>
      <h2 className="mt-[clamp(32px,4.4vh,64px)] text-center text-[clamp(22px,2.3vh,34px)] font-semibold tracking-[-0.02em] text-white">
        {drinkTitle(drink)}
      </h2>
      <div className="mt-[clamp(22px,2.8vh,42px)] flex flex-col gap-[clamp(14px,1.9vh,28px)]">
        <Option gold={gold.includes("size")} icon={<SizeIcons activeIndex={SIZE_INDEX[drink.size]} />} label={drink.size} />
        <Option gold={gold.includes("shots")} icon={<ShotIcons activeCount={Math.min(3, drink.shots)} />} label={shotsLabel(drink.shots)} />
        <Option gold={gold.includes("milk")} icon={<MilkIcons activeIndex={MILK_INDEX[drink.milk]} />} label={milkLabel(drink.milk)} />
        <Option gold={gold.includes("temp")} icon={<TempIcons active={hot ? "hot" : "iced"} />} label={drink.temp} />
      </div>
    </article>
  );
}

function Option({ gold, icon, label }: { gold: boolean; icon: ReactNode; label: string }) {
  return (
    <div
      className={`flex items-center gap-[16px] text-[clamp(17px,1.6vh,23px)] font-normal leading-none ${gold ? "text-[#e0b44c]" : "text-white"}`}
      style={{ transition: gold ? "none" : "color 0.55s linear" }}
    >
      <span className="flex h-10 w-[124px] shrink-0 items-end justify-start">{icon}</span>
      <span className={gold ? "" : "text-[#a3b0a8]"}>{label}</span>
    </div>
  );
}
