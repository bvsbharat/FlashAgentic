import { drinkImage, type DrinkType, type Temp } from "./types";

export type StartGlass = {
  id: string;
  type: DrinkType;
  temp: Temp;
  /** Same product image the counter cards and the checkout receipt use. */
  image: string;
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  size: number;
  tilt: number;
  dx: number;
  dy: number;
  spin: number;
  fromX: number;
  fromY: number;
  dur: number;
  delay: number;
  fade: number;
  steam?: boolean;
};

type GlassSeed = Omit<StartGlass, "image">;

const SEEDS: readonly GlassSeed[] = [
  { id: "tl", type: "matcha", temp: "Hot", steam: true, corner: "top-left", top: 14, left: 2.4, size: 118, tilt: -8, dx: 14, dy: 18, spin: 4, fromX: -48, fromY: -36, dur: 17, delay: 0.2, fade: 0.92 },
  { id: "tr", type: "cappuccino", temp: "Iced", corner: "top-right", top: 5, right: 3.5, size: 124, tilt: 8, dx: -16, dy: 14, spin: -3, fromX: 52, fromY: -40, dur: 19, delay: 1.1, fade: 0.9 },
  { id: "bl", type: "latte", temp: "Hot", steam: true, corner: "bottom-left", bottom: 5, left: 4, size: 136, tilt: 6, dx: 12, dy: -16, spin: 3, fromX: -44, fromY: 42, dur: 18, delay: 0.5, fade: 0.92 },
  { id: "br", type: "cappuccino", temp: "Hot", steam: true, corner: "bottom-right", bottom: 4, right: 3.5, size: 124, tilt: -7, dx: -14, dy: -18, spin: -4, fromX: 46, fromY: 40, dur: 16, delay: 1.6, fade: 0.92 },
];

/** Cups sit in the four corners, outside the title column. */
export const START_GLASSES: readonly StartGlass[] = SEEDS.map((glass) => ({
  ...glass,
  image: drinkImage(glass.type, glass.temp),
}));

const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;

export function glassesCoverCorners(glasses: readonly { corner: string }[]): boolean {
  return CORNERS.every((corner) => glasses.some((glass) => glass.corner === corner));
}

/** Anchor sits in the outer band, so it does not land on the title, hint, or Start button. */
export function glassStaysPeripheral(glass: Pick<StartGlass, "top" | "bottom" | "left" | "right">): boolean {
  const x = glass.left ?? (glass.right != null ? 100 - glass.right : 50);
  const y = glass.top ?? (glass.bottom != null ? 100 - glass.bottom : 50);
  return x <= 16 || x >= 84 || y <= 14 || y >= 86;
}
