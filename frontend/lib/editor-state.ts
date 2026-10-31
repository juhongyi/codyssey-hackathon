import type { Piece } from "./types";

export function resizePiece(
  piece: Piece,
  edge: "start" | "end",
  delta: number,
): Piece {
  if (edge === "end")
    return {
      ...piece,
      durationMonths: Math.max(
        1,
        Math.min(
          60 - piece.startMonth,
          piece.durationMonths + Math.round(delta),
        ),
      ),
    };
  const end = piece.startMonth + piece.durationMonths;
  const startMonth = Math.max(
    0,
    Math.min(end - 1, piece.startMonth + Math.round(delta)),
  );
  return { ...piece, startMonth, durationMonths: end - startMonth };
}

export function constrainPiece(piece: Piece): Piece {
  const durationMonths = Math.max(
    1,
    Math.min(60, Math.round(piece.durationMonths)),
  );
  return {
    ...piece,
    durationMonths,
    startMonth: Math.max(
      0,
      Math.min(60 - durationMonths, Math.round(piece.startMonth)),
    ),
    lane: Math.max(0, Math.min(3, Math.round(piece.lane))),
  };
}
export type History = { past: Piece[][]; present: Piece[]; future: Piece[][] };
export type EditAction =
  | { type: "commit"; pieces: Piece[] }
  | { type: "undo" }
  | { type: "redo" };
export const createHistory = (pieces: Piece[]): History => ({
  past: [],
  present: pieces,
  future: [],
});
export function editHistory(state: History, action: EditAction): History {
  if (action.type === "undo") {
    if (!state.past.length) return state;
    return {
      past: state.past.slice(0, -1),
      present: state.past[state.past.length - 1],
      future: [state.present, ...state.future],
    };
  }
  if (action.type === "redo") {
    if (!state.future.length) return state;
    return {
      past: [...state.past, state.present],
      present: state.future[0],
      future: state.future.slice(1),
    };
  }
  const pieces = action.pieces.map(constrainPiece);
  if (JSON.stringify(pieces) === JSON.stringify(state.present)) return state;
  return {
    past: [...state.past.slice(-49), state.present],
    present: pieces,
    future: [],
  };
}
