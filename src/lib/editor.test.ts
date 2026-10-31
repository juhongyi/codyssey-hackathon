import { describe, expect, it } from "vitest";
import { applyEdit, createHistory, movePiece, redo, undo } from "./editor";
import type { Piece } from "./types";

const piece: Piece = {
  id: "one",
  category: "work",
  title: "리드 도전",
  description: "PM 역량 확장",
  year: 0.3,
  lane: 0,
};

describe("editor history", () => {
  it("undoes and redoes a change without mutating the input", () => {
    const initial = createHistory([piece]);
    const edited = applyEdit(initial, [{ ...piece, title: "새 목표" }]);
    expect(initial.present[0].title).toBe("리드 도전");
    expect(undo(edited).present).toEqual([piece]);
    expect(redo(undo(edited)).present[0].title).toBe("새 목표");
  });
  it("clears redo history when a new edit follows undo", () => {
    const edited = applyEdit(createHistory([piece]), []);
    const branched = applyEdit(undo(edited), [
      { ...piece, title: "다른 방향" },
    ]);
    expect(branched.future).toEqual([]);
    expect(redo(branched)).toBe(branched);
  });
  it("clamps movement to the five-year timeline and valid lanes", () => {
    expect(movePiece(piece, -3, -1)).toMatchObject({ year: 0, lane: 0 });
    expect(movePiece(piece, 9, 7)).toMatchObject({ year: 5, lane: 2 });
    expect(movePiece(piece, 1.26, 1)).toMatchObject({ year: 1.3, lane: 1 });
  });
});
