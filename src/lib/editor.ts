import type { Piece } from "./types";
export interface History {
  past: Piece[][];
  present: Piece[];
  future: Piece[][];
}
export function createHistory(pieces: Piece[]): History {
  return { past: [], present: pieces, future: [] };
}
export function applyEdit(history: History, pieces: Piece[]): History {
  return {
    past: [...history.past, history.present],
    present: pieces,
    future: [],
  };
}
export function undo(history: History): History {
  if (!history.past.length) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
  };
}
export function redo(history: History): History {
  if (!history.future.length) return history;
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
  };
}
export function movePiece(piece: Piece, year: number, lane: number): Piece {
  return {
    ...piece,
    year: Math.round(Math.min(5, Math.max(0, year)) * 10) / 10,
    lane: Math.min(2, Math.max(0, Math.round(lane))),
  };
}
