import assert from "node:assert/strict";
import test from "node:test";
import { GLASS_KINDS, START_GLASSES, glassesCoverCorners, glassStaysPeripheral } from "./start-scene";

test("floating glasses ring every corner and both side edges", () => {
  assert.equal(glassesCoverCorners(START_GLASSES), true);
  assert.equal(START_GLASSES.some((glass) => glass.corner === "left"), true);
  assert.equal(START_GLASSES.some((glass) => glass.corner === "right"), true);
  assert.equal(new Set(START_GLASSES.map((glass) => glass.id)).size, START_GLASSES.length);
});

test("every glass stays outside the title and Start button", () => {
  for (const glass of START_GLASSES) {
    assert.equal(glassStaysPeripheral(glass), true);
    assert.ok(GLASS_KINDS.includes(glass.kind));
    assert.ok(glass.size >= 64 && glass.size <= 120);
    assert.ok(glass.fade > 0 && glass.fade <= 1);
  }
});

test("a glass parked in the middle is not peripheral", () => {
  assert.equal(glassStaysPeripheral({ top: 46, left: 48 }), false);
  assert.equal(glassStaysPeripheral({ top: 4, left: 48 }), true);
});
