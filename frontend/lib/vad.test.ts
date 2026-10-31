import { expect, it } from "vitest";
import { updateVoiceActivity } from "./vad";

it("waits indefinitely before speech and only submits after three quiet seconds following speech", () => {
  let state = { heardSpeech: false, lastSpeechAt: 0, shouldStop: false };
  state = updateVoiceActivity(state, 0, 10000);
  expect(state.shouldStop).toBe(false);
  state = updateVoiceActivity(state, 0.08, 11000);
  state = updateVoiceActivity(state, 0.001, 13999);
  expect(state.shouldStop).toBe(false);
  state = updateVoiceActivity(state, 0.07, 14000);
  state = updateVoiceActivity(state, 0, 16999);
  expect(state.shouldStop).toBe(false);
  expect(updateVoiceActivity(state, 0, 17000).shouldStop).toBe(true);
});
