import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Piece } from "../lib/types";
import { EditorCanvas } from "./editor-canvas";

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const pieceA: Piece = {
  id: "piece-a",
  title: "첫 번째 조각",
  description: "",
  category: "work",
  startMonth: 10,
  durationMonths: 12,
  lane: 0,
};

const pieceB: Piece = {
  id: "piece-b",
  title: "첫 번째 조각 (복사)",
  description: "",
  category: "work",
  startMonth: 10,
  durationMonths: 12,
  lane: 0,
};

const pieceC: Piece = {
  id: "piece-c",
  title: "세 번째 조각 (부분 중첩)",
  description: "",
  category: "work",
  startMonth: 15,
  durationMonths: 10,
  lane: 0,
};

const separatePiece: Piece = {
  id: "piece-other-lane",
  title: "다른 줄 조각",
  description: "",
  category: "rest",
  startMonth: 10,
  durationMonths: 12,
  lane: 2,
};

describe("EditorCanvas overlapping pieces interaction", () => {
  let root: ReactTestRenderer;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    vi.unstubAllGlobals();
  });

  it("renders overlap badges when pieces share lane and time range", async () => {
    const pieces = [pieceA, pieceB, separatePiece];
    await act(async () => {
      root = create(
        <EditorCanvas
          pieces={pieces}
          selected={pieceB.id}
          onSelect={vi.fn()}
          onChange={vi.fn()}
          zoom={1}
          onZoom={vi.fn()}
          createdAt="2026-11-01"
        />,
      );
    });

    const badges = root.root.findAllByProps({
      className: "piece-overlap-badge",
    });
    // pieceA and pieceB overlap (lane 0, month 10..22), separatePiece is in lane 2
    expect(badges).toHaveLength(2);
    expect(badges[0].children).toContain("중첩 ");
    expect(badges[0].children).toContain("2");
    expect(badges[1].children).toContain("2");
  });

  it("cycles selection to the next overlapping piece on click when already selected", async () => {
    const onSelect = vi.fn();
    const pieces = [pieceA, pieceB];

    // pieceB is currently selected
    await act(async () => {
      root = create(
        <EditorCanvas
          pieces={pieces}
          selected={pieceB.id}
          onSelect={onSelect}
          onChange={vi.fn()}
          zoom={1}
          onZoom={vi.fn()}
          createdAt="2026-11-01"
        />,
      );
    });

    // Find piece-b button and click it
    const buttons = root.root.findAllByProps({ className: "piece-body" });
    const buttonB = buttons.find((b) => b.props["aria-pressed"] === true);
    expect(buttonB).toBeDefined();

    // Click without drag: pointerDown -> pointerUp -> click
    await act(async () => {
      buttonB?.props.onPointerDown({
        clientX: 100,
        clientY: 100,
        pointerId: 1,
        stopPropagation: vi.fn(),
        currentTarget: { setPointerCapture: vi.fn() },
      });
      buttonB?.props.onPointerUp();
      buttonB?.props.onClick();
    });

    // Clicking already selected pieceB should cycle selection to pieceA!
    expect(onSelect).toHaveBeenCalledWith(pieceA.id);
  });

  it("does not cycle selection when dragging the piece", async () => {
    const onSelect = vi.fn();
    const onChange = vi.fn();
    const pieces = [pieceA, pieceB];

    await act(async () => {
      root = create(
        <EditorCanvas
          pieces={pieces}
          selected={pieceB.id}
          onSelect={onSelect}
          onChange={onChange}
          zoom={1}
          onZoom={vi.fn()}
          createdAt="2026-11-01"
        />,
      );
    });

    const buttons = root.root.findAllByProps({ className: "piece-body" });
    const buttonB = buttons.find((b) => b.props["aria-pressed"] === true);

    // Simulate drag: pointerDown -> pointerMove (dx > 5) -> pointerUp -> click
    await act(async () => {
      buttonB?.props.onPointerDown({
        clientX: 100,
        clientY: 100,
        pointerId: 1,
        stopPropagation: vi.fn(),
        currentTarget: { setPointerCapture: vi.fn() },
      });
      buttonB?.props.onPointerMove({
        clientX: 150,
        clientY: 100,
      });
      buttonB?.props.onPointerUp();
      buttonB?.props.onClick();
    });

    // Drag moved the piece: onChange should be called, but onSelect cycle should NOT be called
    expect(onChange).toHaveBeenCalled();
    // onSelect was called initially during pointerDown with pieceB.id, but NOT cycled to pieceA
    expect(onSelect).not.toHaveBeenCalledWith(pieceA.id);
  });

  it("cycles through all 3 overlapping pieces in sequence", async () => {
    const onSelect = vi.fn();
    const pieces = [pieceA, pieceB, pieceC];

    // Selected: pieceA
    await act(async () => {
      root = create(
        <EditorCanvas
          pieces={pieces}
          selected={pieceA.id}
          onSelect={onSelect}
          onChange={vi.fn()}
          zoom={1}
          onZoom={vi.fn()}
          createdAt="2026-11-01"
        />,
      );
    });

    const buttons = root.root.findAllByProps({ className: "piece-body" });
    const buttonA = buttons.find((b) => b.props["aria-pressed"] === true);

    await act(async () => {
      buttonA?.props.onPointerDown({
        clientX: 100,
        clientY: 100,
        pointerId: 1,
        stopPropagation: vi.fn(),
        currentTarget: { setPointerCapture: vi.fn() },
      });
      buttonA?.props.onPointerUp();
      buttonA?.props.onClick();
    });

    expect(onSelect).toHaveBeenCalledWith(pieceB.id);
  });
});
