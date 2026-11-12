import assert from "node:assert/strict";
import test from "node:test";
import { GOLD_WINDOW_SECONDS, transcriptAt } from "./demo";
import { parseOrder } from "./parser";
import type { Drink } from "./types";

const SCRIPT = [
  "can i get a matcha",
  "uh let's make it iced with oat milk",
  "and can we add one cappuccino and one latte",
  "actually can we add one more latte",
  "for one of the lattes can we make it large and then the other one small",
  "and then for the small one can we do three shots with oat milk",
  "and um let's make that one iced actually",
  "awesome actually let's get rid of the cappuccino",
].join(" ");

function summary(drinks: Drink[]) {
  return drinks.map((drink) => ({
    id: drink.id,
    type: drink.type,
    size: drink.size,
    shots: drink.shots,
    milk: drink.milk,
    temp: drink.temp,
  }));
}

function at(prefixWords: number) {
  const text = SCRIPT.split(" ").slice(0, prefixWords).join(" ");
  return parseOrder(text);
}

test("step 1 adds a default matcha latte", () => {
  const drinks = parseOrder("can i get a matcha");
  assert.deepEqual(summary(drinks), [
    { id: "matcha-1", type: "matcha", size: "Grande", shots: 2, milk: "Whole", temp: "Hot" },
  ]);
});

test("step 2 ices the matcha and switches it to oat milk", () => {
  const drinks = parseOrder("can i get a matcha uh let's make it iced with oat milk");
  assert.equal(drinks.length, 1);
  assert.equal(drinks[0].temp, "Iced");
  assert.equal(drinks[0].milk, "Oat");
  assert.equal(drinks[0].size, "Grande");
  assert.equal(drinks[0].shots, 2);
});

test("iced lands before oat milk as the sentence streams", () => {
  const iced = parseOrder("can i get a matcha let's make it iced");
  assert.equal(iced[0].temp, "Iced");
  assert.equal(iced[0].milk, "Whole");
  const oat = parseOrder("can i get a matcha let's make it iced with oat milk");
  assert.equal(oat[0].milk, "Oat");
});

test("step 3 adds a cappuccino and a caffè latte", () => {
  const drinks = at(SCRIPT.split(" ").indexOf("latte") + 1);
  assert.deepEqual(
    drinks.map((drink) => drink.type),
    ["matcha", "cappuccino", "latte"],
  );
  assert.equal(drinks[1].temp, "Hot");
  assert.equal(drinks[2].milk, "Whole");
});

test("step 4 adds a second latte on the right", () => {
  const marker = SCRIPT.indexOf("one more latte");
  const text = SCRIPT.slice(0, marker + "one more latte".length);
  const drinks = parseOrder(text);
  assert.deepEqual(
    drinks.map((drink) => drink.type),
    ["matcha", "cappuccino", "latte", "latte"],
  );
});

test("step 5 makes the second latte venti and the first latte tall", () => {
  const marker = SCRIPT.indexOf("other one small");
  const text = SCRIPT.slice(0, marker + "other one small".length);
  const drinks = parseOrder(text);
  const lattes = drinks.filter((drink) => drink.type === "latte");
  assert.equal(lattes.length, 2);
  assert.equal(lattes[0].size, "Tall");
  assert.equal(lattes[1].size, "Venti");
  assert.equal(drinks[0].size, "Grande");
  assert.equal(drinks[1].size, "Grande");
});

test("large applies to the latest latte before the other one gets small", () => {
  const marker = SCRIPT.indexOf("make it large");
  const text = SCRIPT.slice(0, marker + "make it large".length);
  const drinks = parseOrder(text);
  const lattes = drinks.filter((drink) => drink.type === "latte");
  assert.equal(lattes[0].size, "Grande");
  assert.equal(lattes[1].size, "Venti");
});

test("step 6 puts three shots and oat milk on the tall latte", () => {
  const marker = SCRIPT.indexOf("three shots with oat milk");
  const text = SCRIPT.slice(0, marker + "three shots with oat milk".length);
  const drinks = parseOrder(text);
  const tall = drinks.find((drink) => drink.size === "Tall");
  assert.ok(tall);
  assert.equal(tall?.shots, 3);
  assert.equal(tall?.milk, "Oat");
  assert.equal(tall?.temp, "Hot");
  assert.equal(drinks[3].shots, 2);
  assert.equal(drinks[3].milk, "Whole");
});

test("three shots land before the milk clause", () => {
  const marker = SCRIPT.indexOf("three shots");
  const text = SCRIPT.slice(0, marker + "three shots".length);
  const tall = parseOrder(text).find((drink) => drink.size === "Tall");
  assert.equal(tall?.shots, 3);
  assert.equal(tall?.milk, "Whole");
});

test("step 7 ices the tall latte and keeps its size", () => {
  const marker = SCRIPT.indexOf("that one iced");
  const text = SCRIPT.slice(0, marker + "that one iced".length);
  const drinks = parseOrder(text);
  assert.equal(drinks[2].type, "latte");
  assert.equal(drinks[2].temp, "Iced");
  assert.equal(drinks[2].size, "Tall");
  assert.equal(drinks[2].shots, 3);
  assert.equal(drinks[2].milk, "Oat");
  assert.equal(drinks[3].temp, "Hot");
  assert.equal(drinks[3].size, "Venti");
});

test("step 8 removes the cappuccino and leaves the others in order", () => {
  const drinks = parseOrder(SCRIPT);
  assert.deepEqual(
    drinks.map((drink) => drink.type),
    ["matcha", "latte", "latte"],
  );
  assert.equal(drinks[0].temp, "Iced");
  assert.equal(drinks[0].milk, "Oat");
  assert.equal(drinks[1].temp, "Iced");
  assert.equal(drinks[1].size, "Tall");
  assert.equal(drinks[1].shots, 3);
  assert.equal(drinks[1].milk, "Oat");
  assert.equal(drinks[2].temp, "Hot");
  assert.equal(drinks[2].size, "Venti");
  assert.equal(drinks[2].shots, 2);
  assert.equal(drinks[2].milk, "Whole");
});

test("reparsing the same transcript keeps stable ids", () => {
  const once = parseOrder(SCRIPT);
  const twice = parseOrder(SCRIPT);
  assert.deepEqual(once.map((drink) => drink.id), twice.map((drink) => drink.id));
});

test("demo clock hits the reference states", () => {
  const state = (seconds: number) =>
    parseOrder(transcriptAt(seconds)).map((drink) => [drink.type, drink.size, drink.shots, drink.milk, drink.temp].join("/"));

  assert.deepEqual(state(2.4), []);
  assert.deepEqual(state(4.2), ["matcha/Grande/2/Whole/Hot"]);
  assert.deepEqual(state(7.2), ["matcha/Grande/2/Oat/Iced"]);
  assert.deepEqual(state(11.5), [
    "matcha/Grande/2/Oat/Iced",
    "cappuccino/Grande/2/Whole/Hot",
    "latte/Grande/2/Whole/Hot",
  ]);
  assert.deepEqual(state(15.2), [
    "matcha/Grande/2/Oat/Iced",
    "cappuccino/Grande/2/Whole/Hot",
    "latte/Grande/2/Whole/Hot",
    "latte/Grande/2/Whole/Hot",
  ]);
  assert.deepEqual(state(19), [
    "matcha/Grande/2/Oat/Iced",
    "cappuccino/Grande/2/Whole/Hot",
    "latte/Tall/2/Whole/Hot",
    "latte/Venti/2/Whole/Hot",
  ]);
  assert.deepEqual(state(23.4), [
    "matcha/Grande/2/Oat/Iced",
    "cappuccino/Grande/2/Whole/Hot",
    "latte/Tall/3/Oat/Hot",
    "latte/Venti/2/Whole/Hot",
  ]);
  assert.deepEqual(state(33), [
    "matcha/Grande/2/Oat/Iced",
    "latte/Tall/3/Oat/Iced",
    "latte/Venti/2/Whole/Hot",
  ]);
});

test("gold window covers the frame where oat milk just changed", () => {
  const changedAt = 5.95;
  assert.ok(7.2 - changedAt < GOLD_WINDOW_SECONDS);
  assert.ok(7.2 - 4.33 > GOLD_WINDOW_SECONDS);
});
