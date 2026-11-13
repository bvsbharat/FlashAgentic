import assert from "node:assert/strict";
import test from "node:test";
import { drinkImage } from "./types";
import { HERO_CUPS, LANDING_TILES, heroCupsUseMenuArt, landingTilesAreDistinct } from "./start-scene";

test("landing tiles stay distinct", () => {
  assert.equal(LANDING_TILES.length, 5);
  assert.equal(landingTilesAreDistinct(LANDING_TILES), true);
});

test("hero cups are the in-app menu photos", () => {
  assert.equal(heroCupsUseMenuArt(HERO_CUPS), true);
  assert.deepEqual(
    new Set(HERO_CUPS.map((cup) => cup.image)),
    new Set([
      drinkImage("matcha", "Iced"),
      drinkImage("matcha", "Hot"),
      drinkImage("latte", "Iced"),
      drinkImage("latte", "Hot"),
      drinkImage("cappuccino", "Iced"),
      drinkImage("cappuccino", "Hot"),
    ]),
  );
});

test("a cropped landing render is not a hero cup", () => {
  assert.equal(heroCupsUseMenuArt([{ id: "old", image: "/landing/hero-cup.webp" }]), false);
  assert.equal(HERO_CUPS.some((cup) => cup.image.includes("hero-cup")), false);
});
