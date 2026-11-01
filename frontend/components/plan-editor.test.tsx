import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "../lib/api-client";
import type { Board, Plan } from "../lib/types";
import { EditorCanvas } from "./editor-canvas";
import { PlanCard } from "./plan-card";
import { PlanEditor } from "./plan-editor";
import { Ratings } from "./rating-bar";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: () => null }));
vi.mock("../lib/api-client", () => ({ api: { savePlan: vi.fn() } }));
vi.mock("./editor-canvas", () => ({ EditorCanvas: () => null }));
vi.mock("./timeline", () => ({ Timeline: () => null }));
const plan: Plan = {
  id: "A",
  label: "Plan A",
  title: "Future",
  description: "",
  pieces: [
    {
      id: "piece",
      title: "Work",
      description: "",
      category: "work",
      startMonth: 0,
      durationMonths: 1,
      lane: 0,
    },
  ],
  scores: {},
};
const board: Board = {
  id: "board",
  interviewId: "interview",
  createdAt: "2026-10-31",
  plans: [plan],
};
let root: ReactTestRenderer;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.mocked(api.savePlan).mockResolvedValue(board);
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

it("saves scores and piece edits together without saving untouched defaults", async () => {
  await act(async () => {
    root = create(<PlanEditor board={board} initialPlan={plan} />);
  });
  expect(api.savePlan).not.toHaveBeenCalled();
  await act(async () =>
    root.root.findByProps({ "aria-label": "자원 평가하기" }).props.onClick(),
  );
  const piece = {
    id: "piece",
    title: "Rest",
    description: "",
    category: "rest",
    startMonth: 0,
    durationMonths: 1,
    lane: 0,
  };
  // A piece edit must not replace the assessment with the initial empty scores.
  await act(async () =>
    root.root.findByType(EditorCanvas).props.onChange(piece),
  );
  await act(async () =>
    root.root.findByType(Ratings).props.onChange({ resources: 0, liking: 7 }),
  );
  await act(async () =>
    root.root.findByProps({ "aria-label": "보드로 돌아가기" }).props.onClick(),
  );
  expect(api.savePlan).toHaveBeenLastCalledWith("board", {
    ...plan,
    pieces: [piece],
    scores: { resources: 0, liking: 7 },
  });
});

it("shows assessment comparison on each real plan card", async () => {
  for (const id of ["A", "B", "C"] as const) {
    await act(async () => {
      root = create(
        <PlanCard
          plan={{ ...plan, id, scores: { resources: 0 } }}
          createdAt={board.createdAt}
        />,
      );
    });
    expect(root.root.findByType(Ratings).props.scores).toEqual({
      resources: 0,
    });
    await act(async () => root.unmount());
  }
});
