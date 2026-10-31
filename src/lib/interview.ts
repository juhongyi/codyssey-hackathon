export type InterviewPhase =
  | "ready"
  | "speaking"
  | "listening"
  | "preparing"
  | "complete";
export interface InterviewState {
  phase: InterviewPhase;
  index: number;
}
export const initialInterview: InterviewState = { phase: "ready", index: 0 };
export function advanceInterview(
  state: InterviewState,
  event: "start" | "spoken" | "answer" | "prepared",
  count: number,
): InterviewState {
  if (state.phase === "ready" && event === "start")
    return { phase: "speaking", index: 0 };
  if (state.phase === "speaking" && event === "spoken")
    return { ...state, phase: "listening" };
  if (state.phase === "listening" && event === "answer")
    return state.index + 1 >= count
      ? { ...state, phase: "preparing" }
      : { phase: "speaking", index: state.index + 1 };
  if (state.phase === "preparing" && event === "prepared")
    return { ...state, phase: "complete" };
  return state;
}
