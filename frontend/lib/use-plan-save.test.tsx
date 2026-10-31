import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "./api-client";
import type { Plan } from "./types";
import { usePlanSave } from "./use-plan-save";

vi.mock("./api-client", () => ({ api: { savePlan: vi.fn() } }));
const plan: Plan = {
  id: "A",
  label: "Plan A",
  title: "나의 계획",
  description: "",
  pieces: [],
  scores: {},
};
let saving: ReturnType<typeof usePlanSave>;
let root: ReactTestRenderer;
function Harness({ value }: { value: Plan }) {
  saving = usePlanSave("board", value);
  return null;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

it("reports failure to navigation callers and retains the final edit for retry", async () => {
  vi.mocked(api.savePlan)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({
      id: "board",
      interviewId: "session",
      createdAt: "2026-10-31",
      plans: [],
    });
  await act(async () => {
    root = create(<Harness value={plan} />);
  });
  const changed = { ...plan, title: "바뀐 계획" };
  await act(async () => root.update(<Harness value={changed} />));
  let saved: unknown;
  await act(async () => {
    saved = await saving.retry();
  });
  expect(saved).toBe(false);
  expect(saving.status).toBe("error");
  await act(async () => {
    saved = await saving.retry();
  });
  expect(saved).toBe(true);
  expect(api.savePlan).toHaveBeenLastCalledWith("board", changed);
  expect(saving.status).toBe("saved");
});
