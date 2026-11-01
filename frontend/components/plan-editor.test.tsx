import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "../lib/api-client";
import type { Board, Plan } from "../lib/types";
import { EditorCanvas } from "./editor-canvas";
import { PieceSheet } from "./piece-sheet";
import { PlanCard } from "./plan-card";
import { PlanEditor } from "./plan-editor";
import { Ratings } from "./rating-bar";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: () => null }));
vi.mock("../lib/api-client", () => ({ api: { savePlan: vi.fn() } }));
vi.mock("./editor-canvas", () => ({ EditorCanvas: () => null }));
vi.mock("./timeline", () => ({ Timeline: () => null }));
vi.mock("./piece-sheet", () => ({ PieceSheet: () => null }));
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

it("keeps the latest assessment and pieces after failure, retry and reload", async () => {
  let persisted = plan;
  vi.mocked(api.savePlan)
    .mockRejectedValueOnce(new Error("offline"))
    .mockImplementation(async (_id, value) => {
      persisted = value;
      return { ...board, plans: [value] };
    });
  await act(async () => {
    root = create(<PlanEditor board={board} initialPlan={plan} />);
  });
  await act(async () =>
    root.root.findByType(Ratings).props.onChange({ resources: 0 }),
  );
  await act(async () =>
    root.root.findByProps({ "aria-label": "보드로 돌아가기" }).props.onClick(),
  );
  expect(root.root.findByProps({ role: "alert" }).children).toContain(
    "offline",
  );
  expect(root.root.findByType(Ratings).props.scores).toEqual({ resources: 0 });
  const changed = { ...plan.pieces[0], title: "최신 조각", startMonth: 59 };
  await act(async () =>
    root.root.findByType(EditorCanvas).props.onChange(changed),
  );
  await act(async () =>
    root.root.findByType(Ratings).props.onChange({ resources: 0, liking: 9 }),
  );
  await act(async () =>
    root.root.findByProps({ "aria-label": "보드로 돌아가기" }).props.onClick(),
  );
  expect(persisted.pieces).toEqual([changed]);
  expect(persisted.scores).toEqual({ resources: 0, liking: 9 });
  expect(root.root.findByProps({ role: "status" }).children).toContain(
    "모든 변경 저장됨",
  );
  await act(async () => root.unmount());
  await act(async () => {
    root = create(
      <PlanEditor
        board={{ ...board, plans: [persisted] }}
        initialPlan={persisted}
      />,
    );
  });
  expect(root.root.findByType(Ratings).props.scores).toEqual(persisted.scores);
  expect(root.root.findByType(EditorCanvas).props.pieces).toEqual([changed]);
});

it("preserves existing scores through piece edits, duplication, deletion and undo/redo", async () => {
  const scores = { resources: 0, confidence: 8 };
  await act(async () => {
    root = create(
      <PlanEditor board={board} initialPlan={{ ...plan, scores }} />,
    );
  });
  const button = (text: string) => {
    const found = root.root
      .findAllByType("button")
      .find((node) => node.children.includes(text));
    if (!found) throw new Error(`Missing button: ${text}`);
    return found;
  };
  await act(async () =>
    root.root.findByType(EditorCanvas).props.onSelect("piece"),
  );
  await act(async () => button(" 수정").props.onClick());
  await act(async () =>
    root.root
      .findByType(PieceSheet)
      .props.onSave({ ...plan.pieces[0], title: "수정" }),
  );
  await act(async () => button(" 복제").props.onClick());
  expect(root.root.findByType(EditorCanvas).props.pieces).toHaveLength(2);
  await act(async () => button(" 삭제").props.onClick());
  expect(root.root.findByType(EditorCanvas).props.pieces).toHaveLength(1);
  await act(async () =>
    root.root.findByProps({ "aria-label": "실행 취소" }).props.onClick(),
  );
  expect(root.root.findByType(EditorCanvas).props.pieces).toHaveLength(2);
  await act(async () =>
    root.root.findByProps({ "aria-label": "다시 실행" }).props.onClick(),
  );
  expect(root.root.findByType(EditorCanvas).props.pieces).toHaveLength(1);
  expect(root.root.findByType(Ratings).props.scores).toEqual(scores);
  await act(async () =>
    root.root.findByProps({ "aria-label": "보드로 돌아가기" }).props.onClick(),
  );
  expect(api.savePlan).toHaveBeenLastCalledWith(
    "board",
    expect.objectContaining({ scores }),
  );
});
