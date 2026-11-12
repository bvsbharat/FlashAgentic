import assert from "node:assert/strict";
import test from "node:test";
import { microphoneConstraints, requestsCamera } from "./pcm";
import {
  dismissStartAfterCapture,
  meterShowsStart,
  micBlockMessage,
  permissionFromCaptureError,
  permissionFromQuery,
} from "./mic-permission";

test("the meter says Start for prompt, denied, and unsupported, and dots once granted", () => {
  assert.equal(meterShowsStart("prompt"), true);
  assert.equal(meterShowsStart("denied"), true);
  assert.equal(meterShowsStart("unsupported"), true);
  assert.equal(meterShowsStart("granted"), false);
});

test("the start screen dismisses only after the microphone is granted", () => {
  assert.equal(dismissStartAfterCapture(true), true);
  assert.equal(dismissStartAfterCapture(false), false);
});

test("permission query keeps granted, denied, and prompt, and treats anything else as a prompt", () => {
  assert.equal(permissionFromQuery("granted"), "granted");
  assert.equal(permissionFromQuery("denied"), "denied");
  assert.equal(permissionFromQuery("prompt"), "prompt");
  assert.equal(permissionFromQuery(undefined), "prompt");
  assert.equal(permissionFromQuery("not-a-state"), "prompt");
});

test("a refused capture stays on the start screen with a way to retry", () => {
  assert.equal(permissionFromCaptureError({ name: "NotAllowedError" }), "denied");
  assert.equal(permissionFromCaptureError({ name: "PermissionDeniedError" }), "denied");
  assert.equal(permissionFromCaptureError({ name: "SecurityError" }), "denied");
  assert.equal(permissionFromCaptureError({ name: "NotFoundError" }), "unsupported");
  assert.equal(permissionFromCaptureError(new Error("boom")), "unsupported");
  assert.equal(dismissStartAfterCapture(false), false);
  assert.match(micBlockMessage("denied") ?? "", /press Start/);
  assert.match(micBlockMessage("unsupported") ?? "", /Chrome/);
  assert.equal(micBlockMessage("prompt"), null);
  assert.equal(micBlockMessage("granted"), null);
});

test("capture asks for audio only", () => {
  const constraints = microphoneConstraints();
  assert.equal("video" in constraints, false);
  assert.equal(requestsCamera(constraints), false);
  assert.equal(requestsCamera({ audio: true, video: true }), true);
});
