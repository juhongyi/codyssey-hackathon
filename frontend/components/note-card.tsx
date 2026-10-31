import type { Piece } from "../lib/types";
import { CategoryChip } from "./category-chip";

export function NoteCard({ piece }: { piece: Piece }) {
  return (
    <>
      <CategoryChip category={piece.category} />
      <strong>{piece.title}</strong>
      <small>
        {piece.durationMonths}개월 · {piece.startMonth + 1}개월째 시작
      </small>
      {piece.description && <p>{piece.description}</p>}
    </>
  );
}
