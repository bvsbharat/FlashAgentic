export type DrinkType = "matcha" | "cappuccino" | "latte";
export type Size = "Tall" | "Grande" | "Venti";
export type Milk = "Whole" | "Oat" | "Almond" | "Skim";
export type Temp = "Hot" | "Iced";

export type Drink = {
  id: string;
  type: DrinkType;
  size: Size;
  shots: number;
  milk: Milk;
  temp: Temp;
};

export type OptionField = "size" | "shots" | "milk" | "temp";

export const DRINK_TITLES: Record<DrinkType, string> = {
  matcha: "Matcha Latte",
  cappuccino: "Cappuccino",
  latte: "Caffè Latte",
};

export function drinkTitle(drink: Drink): string {
  const name = DRINK_TITLES[drink.type];
  return drink.temp === "Iced" ? `Iced ${name}` : name;
}

export function drinkImage(type: DrinkType, temp: Temp): string {
  return `/drinks/${type}-${temp === "Iced" ? "iced" : "hot"}.png`;
}

export function milkLabel(milk: Milk): string {
  if (milk === "Oat") return "Oat milk";
  if (milk === "Almond") return "Almond milk";
  if (milk === "Skim") return "Skim milk";
  return "Whole milk";
}

export function shotsLabel(shots: number): string {
  return `${shots} ${shots === 1 ? "shot" : "shots"}`;
}
