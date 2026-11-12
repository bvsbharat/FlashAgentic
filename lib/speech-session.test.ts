import assert from "node:assert/strict";
import test from "node:test";
import { clearInterpret, IDLE_LOOP, noteTranscript, settleInterpret, shouldApplyInterpret } from "./live-order";
import { commitSession, liveTranscript } from "./speech-session";

test("interim words are part of the live transcript", () => {
  const text = liveTranscript("", [
    { transcript: "can i get", isFinal: false },
  ]);
  assert.equal(text, "can i get");
});

test("a later interim replaces the hypothesis instead of repeating it", () => {
  const text = liveTranscript("", [
    { transcript: "can i get a matcha", isFinal: false },
  ]);
  assert.equal(text, "can i get a matcha");
});

test("finals from an earlier session stay when the next session starts", () => {
  const committed = commitSession("", [
    { transcript: "can i get a matcha", isFinal: true },
    { transcript: "let's make it iced", isFinal: false },
  ]);
  assert.equal(committed, "can i get a matcha let's make it iced");
  const next = liveTranscript(committed, [{ transcript: "with oat milk", isFinal: false }]);
  assert.equal(next, "can i get a matcha let's make it iced with oat milk");
});

test("a restarted session that repeats the prefix does not duplicate it", () => {
  const committed = "can i get a matcha";
  const text = liveTranscript(committed, [
    { transcript: "can i get a matcha let's make it iced", isFinal: false },
  ]);
  assert.equal(text, "can i get a matcha let's make it iced");
});

test("an interim-only session is kept when recognition ends", () => {
  const committed = commitSession("", [{ transcript: "can i get a matcha", isFinal: false }]);
  assert.equal(committed, "can i get a matcha");
  assert.equal(liveTranscript(committed, []), committed);
});

test("the first interim transcript is sent to interpret", () => {
  const first = noteTranscript(IDLE_LOOP, "can i");
  assert.equal(first.send, "can i");
  assert.equal(first.loop.inflight, "can i");
});

test("a newer interim waits, then is sent when the current call settles", () => {
  const first = noteTranscript(IDLE_LOOP, "can i get");
  const held = noteTranscript(first.loop, "can i get a matcha");
  assert.equal(held.send, null);
  assert.equal(held.loop.pending, "can i get a matcha");
  const next = settleInterpret(held.loop);
  assert.equal(next.send, "can i get a matcha");
  assert.equal(next.loop.inflight, "can i get a matcha");
  assert.equal(next.loop.pending, null);
});

test("interpret is not limited to a final transcript", () => {
  let loop = noteTranscript(IDLE_LOOP, "can i get a").loop;
  loop = noteTranscript(loop, "can i get a matcha").loop;
  const sent = settleInterpret(loop).send;
  assert.equal(sent, "can i get a matcha");
  assert.equal(sent?.includes("matcha"), true);
});

test("settling with no newer words does not send again", () => {
  const first = noteTranscript(IDLE_LOOP, "can i get a matcha");
  const same = noteTranscript(first.loop, "can i get a matcha");
  assert.equal(same.send, null);
  const done = settleInterpret(same.loop);
  assert.equal(done.send, null);
  assert.deepEqual(done.loop, IDLE_LOOP);
});

test("an empty transcript does not call interpret", () => {
  assert.equal(noteTranscript(IDLE_LOOP, "   ").send, null);
});

test("clear drops the in-flight transcript and the interim waiting behind it", () => {
  const started = noteTranscript(IDLE_LOOP, "can i get a matcha");
  const waiting = noteTranscript(started.loop, "can i get a matcha let's make it iced");
  assert.equal(waiting.loop.pending, "can i get a matcha let's make it iced");
  const cleared = clearInterpret(waiting.loop);
  assert.equal(cleared.inflight, null);
  assert.equal(cleared.pending, null);
  assert.equal(cleared.epoch, waiting.loop.epoch + 1);
  assert.equal(settleInterpret(cleared).send, null);
  assert.equal(noteTranscript(cleared, "").send, null);
});

test("a late interpret response is ignored after clear", () => {
  const started = noteTranscript(IDLE_LOOP, "can i get a matcha");
  const sent = { epoch: started.loop.epoch, text: "can i get a matcha" };
  assert.equal(shouldApplyInterpret(started.loop, sent.epoch, sent.text), true);
  const cleared = clearInterpret(started.loop);
  assert.equal(shouldApplyInterpret(cleared, sent.epoch, sent.text), false);
});

test("speech after clear can start a new order", () => {
  const cleared = clearInterpret(noteTranscript(IDLE_LOOP, "can i get a matcha").loop);
  const again = noteTranscript(cleared, "one cappuccino");
  assert.equal(again.send, "one cappuccino");
  assert.equal(shouldApplyInterpret(again.loop, again.loop.epoch, "one cappuccino"), true);
  assert.equal(shouldApplyInterpret(again.loop, cleared.epoch - 1, "can i get a matcha"), false);
});

test("discarding committed and interim speech leaves no words", () => {
  const kept = commitSession("can i get a matcha", [{ transcript: "let's make it iced", isFinal: false }]);
  assert.equal(kept, "can i get a matcha let's make it iced");
  assert.equal(liveTranscript("", []), "");
});
