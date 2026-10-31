import { describe, expect, it } from "vitest";
import {
  constrainPiece,
  createHistory,
  editHistory,
  resizePiece,
} from "./editor-state";
import type { Piece } from "./types";

const piece: Piece = {
  id: "one",
  title: "작은 시작",
  description: "",
  category: "work",
  startMonth: 10,
  durationMonths: 12,
  lane: 0,
};

describe("five-year planning", () => {
  it("resizes either edge while keeping the opposite edge anchored within month 0..60", () => {
    expect(resizePiece(piece, "start", 30)).toMatchObject({
      startMonth: 21,
      durationMonths: 1,
    });
    expect(resizePiece(piece, "start", -30)).toMatchObject({
      startMonth: 0,
      durationMonths: 22,
    });
    expect(resizePiece(piece, "end", 80)).toMatchObject({
      startMonth: 10,
      durationMonths: 50,
    });
    expect(resizePiece(piece, "end", -80)).toMatchObject({
      startMonth: 10,
      durationMonths: 1,
    });
  });
  it("snaps movement to months and keeps the whole duration inside five years", () => {
    expect(
      constrainPiece({ ...piece, startMonth: 58.7, lane: 8 }),
    ).toMatchObject({ startMonth: 48, durationMonths: 12, lane: 3 });
    expect(constrainPiece({ ...piece, startMonth: -4 })).toMatchObject({
      startMonth: 0,
    });
  });
  it("bounds a resized period and never allows a zero-month piece", () => {
    expect(constrainPiece({ ...piece, durationMonths: 100 })).toMatchObject({
      startMonth: 0,
      durationMonths: 60,
    });
    expect(constrainPiece({ ...piece, durationMonths: 0 })).toMatchObject({
      durationMonths: 1,
    });
  });
  it("undoes deletion, redoes it, and discards redo after a new edit", () => {
    const initial = createHistory([piece]);
    const removed = editHistory(initial, { type: "commit", pieces: [] });
    const undone = editHistory(removed, { type: "undo" });
    expect(undone.present).toEqual([piece]);
    expect(editHistory(undone, { type: "redo" }).present).toEqual([]);
    const changed = editHistory(undone, {
      type: "commit",
      pieces: [{ ...piece, title: "다른 미래" }],
    });
    expect(editHistory(changed, { type: "redo" }).present[0].title).toBe(
      "다른 미래",
    );
    expect(initial.present[0].title).toBe("작은 시작");
  });
  it("allows overlapping pieces without moving other plans or lanes", () => {
    const other = { ...piece, id: "two" };
    const state = editHistory(createHistory([piece]), {
      type: "commit",
      pieces: [piece, other],
    });
    expect(state.present).toHaveLength(2);
    expect(state.present[0].startMonth).toBe(state.present[1].startMonth);
  });
});
