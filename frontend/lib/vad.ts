export type VoiceActivity = {
  heardSpeech: boolean;
  lastSpeechAt: number;
  shouldStop: boolean;
};
export function updateVoiceActivity(
  state: VoiceActivity,
  rms: number,
  now: number,
): VoiceActivity {
  const speaking = rms > 0.025;
  const heardSpeech = state.heardSpeech || speaking;
  const lastSpeechAt = speaking ? now : state.lastSpeechAt;
  return {
    heardSpeech,
    lastSpeechAt,
    shouldStop: heardSpeech && !speaking && now - lastSpeechAt >= 3000,
  };
}
