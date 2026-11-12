import assert from "node:assert/strict";
import test from "node:test";
import { MENU_MILKS, MENU_SHOTS, MENU_SIZES, MENU_TEMPS, MENU_TYPES, ORDER_HINTS, clearControlVisible, hintLine, startGateVisible } from "./start-gate";

test("the opening screen is up until Start, and skipped for demo and stills", () => {
  assert.equal(startGateVisible({ dismissed: false, frozen: false, autoDemo: false, shot: false }), true);
  assert.equal(startGateVisible({ dismissed: true, frozen: false, autoDemo: false, shot: false }), false);
  assert.equal(startGateVisible({ dismissed: false, frozen: true, autoDemo: false, shot: false }), false);
  assert.equal(startGateVisible({ dismissed: false, frozen: false, autoDemo: true, shot: false }), false);
  assert.equal(startGateVisible({ dismissed: false, frozen: false, autoDemo: false, shot: true }), false);
});

test("order hints use only drinks, sizes, shots, milks, and temperatures from the menu", () => {
  assert.deepEqual(ORDER_HINTS.map(hintLine), [
    "a grande iced matcha with oat milk",
    "two shots, hot latte with whole milk",
    "a tall cappuccino with almond milk",
  ]);
  for (const hint of ORDER_HINTS) {
    assert.ok(MENU_TYPES.includes(hint.type));
    if (hint.size) assert.ok(MENU_SIZES.includes(hint.size));
    if (hint.shots) assert.ok(MENU_SHOTS.includes(hint.shots));
    if (hint.milk) assert.ok(MENU_MILKS.includes(hint.milk));
    if (hint.temp) assert.ok(MENU_TEMPS.includes(hint.temp));
  }
});

test("Clear stays hidden on the start screen and on an idle counter", () => {
  const idle = { gate: false, shot: false, listening: false, transcript: "", drinkCount: 0, demoPlaying: false };
  assert.equal(clearControlVisible({ ...idle, gate: true, listening: true }), false);
  assert.equal(clearControlVisible(idle), false);
  assert.equal(clearControlVisible({ ...idle, shot: true, listening: true, drinkCount: 2 }), false);
});

test("Clear appears once the mic, a transcript, an order, or the demo is active", () => {
  const idle = { gate: false, shot: false, listening: false, transcript: "", drinkCount: 0, demoPlaying: false };
  assert.equal(clearControlVisible({ ...idle, listening: true }), true);
  assert.equal(clearControlVisible({ ...idle, transcript: "can i get a matcha" }), true);
  assert.equal(clearControlVisible({ ...idle, transcript: "   " }), false);
  assert.equal(clearControlVisible({ ...idle, drinkCount: 1 }), true);
  assert.equal(clearControlVisible({ ...idle, demoPlaying: true }), true);
});

test("Clear hides again after the counter is reset to idle", () => {
  const afterClear = { gate: false, shot: false, listening: false, transcript: "", drinkCount: 0, demoPlaying: false };
  assert.equal(clearControlVisible(afterClear), false);
  assert.equal(startGateVisible({ dismissed: true, frozen: false, autoDemo: false, shot: false }), false);
});
