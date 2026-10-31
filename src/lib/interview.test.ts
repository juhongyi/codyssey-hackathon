import { describe, expect, it } from "vitest";
import { advanceInterview, initialInterview } from "./interview";

describe("interview progression", () => {
  it("advances only after a listening answer is completed", () => {
    expect(advanceInterview(initialInterview, "answer", 5)).toEqual(
      initialInterview,
    );
    const speaking = advanceInterview(initialInterview, "start", 5);
    expect(speaking.phase).toBe("speaking");
    const listening = advanceInterview(speaking, "spoken", 5);
    expect(listening.phase).toBe("listening");
    expect(advanceInterview(listening, "answer", 5)).toEqual({
      phase: "speaking",
      index: 1,
    });
  });
  it("finishes only after all questions and draft preparation", () => {
    const last = advanceInterview(
      { phase: "listening", index: 4 },
      "answer",
      5,
    );
    expect(last.phase).toBe("preparing");
    expect(advanceInterview(last, "prepared", 5).phase).toBe("complete");
  });
});
