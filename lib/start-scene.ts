import { drinkImage, type DrinkType, type Temp } from "./types";

export type LandingTile = {
  id: string;
  name: string;
  image: string;
};

/** Five cropped drinks under the hero actions, left to right. */
export const LANDING_TILES: readonly LandingTile[] = [
  { id: "latte", name: "Latte", image: "/landing/tile-1.webp" },
  { id: "iced-latte", name: "Iced latte", image: "/landing/tile-2.webp" },
  { id: "mocha", name: "Mocha", image: "/landing/tile-3.webp" },
  { id: "cappuccino", name: "Cappuccino", image: "/landing/tile-4.webp" },
  { id: "iced-matcha", name: "Iced matcha", image: "/landing/tile-5.webp" },
];

export type HeroCup = {
  id: string;
  label: string;
  type: DrinkType;
  temp: Temp;
  /** Same product photo the counter cards and the checkout receipt use. */
  image: string;
};

const HERO_SEEDS: readonly Omit<HeroCup, "image">[] = [
  { id: "matcha-iced", label: "Matcha", type: "matcha", temp: "Iced" },
  { id: "latte-hot", label: "Latte", type: "latte", temp: "Hot" },
  { id: "cappuccino-iced", label: "Cappuccino", type: "cappuccino", temp: "Iced" },
  { id: "matcha-hot", label: "Matcha", type: "matcha", temp: "Hot" },
  { id: "latte-iced", label: "Latte", type: "latte", temp: "Iced" },
  { id: "cappuccino-hot", label: "Cappuccino", type: "cappuccino", temp: "Hot" },
];

/** Hero slides. Every frame is an in-app drink photo, not the cropped landing render. */
export const HERO_CUPS: readonly HeroCup[] = HERO_SEEDS.map((cup) => ({
  ...cup,
  image: drinkImage(cup.type, cup.temp),
}));

export const HERO_BG = "/landing/hero-bg.webp";
export const BRAND_LOGO = "/landing/logo.webp";

export function landingTilesAreDistinct(tiles: readonly Pick<LandingTile, "id" | "image">[]): boolean {
  const ids = new Set(tiles.map((tile) => tile.id));
  return ids.size === tiles.length && tiles.every((tile) => /\/landing\/tile-\d+\.webp$/.test(tile.image));
}

export function heroCupsUseMenuArt(cups: readonly Pick<HeroCup, "id" | "image">[]): boolean {
  const ids = new Set(cups.map((cup) => cup.id));
  return (
    cups.length > 0 &&
    ids.size === cups.length &&
    cups.every((cup) => /^\/drinks\/(matcha|latte|cappuccino)-(hot|iced)\.png$/.test(cup.image))
  );
}
