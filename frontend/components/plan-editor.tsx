"use client";
import {
  ArrowLeft,
  Check,
  Copy,
  Pencil,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useReducer, useState } from "react";
import { createHistory, editHistory } from "../lib/editor-state";
import type { Board, Piece, Plan } from "../lib/types";
import { usePlanSave } from "../lib/use-plan-save";
import { EditorCanvas } from "./editor-canvas";
import { PieceSheet } from "./piece-sheet";

export function PlanEditor({
  board,
  initialPlan,
}: {
  board: Board;
  initialPlan: Plan;
}) {
  const [history, dispatch] = useReducer(
    editHistory,
    initialPlan.pieces,
    createHistory,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ piece: Piece | null } | null>(null);
  const [zoom, setZoom] = useState(2);
  const plan = useMemo(
    () => ({ ...initialPlan, pieces: history.present }),
    [initialPlan, history.present],
  );
  const saving = usePlanSave(board.id, plan);
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  async function leave() {
    if (leaving) return;
    setLeaving(true);
    const saved = await saving.retry();
    if (saved) router.push("/board");
    else setLeaving(false);
  }
  const piece = history.present.find((item) => item.id === selected);
  function commit(pieces: Piece[]) {
    dispatch({ type: "commit", pieces });
  }
  function update(updated: Piece) {
    commit(
      history.present.map((item) => (item.id === updated.id ? updated : item)),
    );
  }
  function savePiece(updated: Piece) {
    if (history.present.some((item) => item.id === updated.id)) update(updated);
    else commit([...history.present, updated]);
    setSelected(updated.id);
    setSheet(null);
  }
  const statusLabel =
    saving.status === "saved"
      ? "모든 변경 저장됨"
      : saving.status === "error"
        ? "저장 실패"
        : saving.status === "pending"
          ? "저장 대기 중"
          : "저장 중…";
  return (
    <main className="editor-page">
      <header className="page-header">
        <button
          type="button"
          onClick={leave}
          disabled={leaving}
          className="button small editor-back"
          aria-label="보드로 돌아가기"
        >
          <ArrowLeft size={17} /> 라이프 보드
        </button>
        <h1>오딧세이 편집</h1>
        {saving.status === "saved" ? (
          <button
            type="button"
            onClick={leave}
            disabled={leaving}
            className="button primary small"
          >
            <Check size={16} /> 완료
          </button>
        ) : (
          <button
            type="button"
            className="button small"
            disabled={saving.status !== "error"}
            onClick={saving.retry}
          >
            {saving.status === "error" ? "재시도" : "저장 중"}
          </button>
        )}
      </header>
      <section className="editor-title">
        <h2>
          Plan {["A", "B", "C"].indexOf(plan.id) + 1} · {plan.title}
        </h2>
        <small className="editor-created">
          생성 {new Date(board.createdAt).getFullYear()}.
          {String(new Date(board.createdAt).getMonth() + 1).padStart(2, "0")}
        </small>
        <div className={`save-status ${saving.status}`} role="status">
          <i />
          {statusLabel}
        </div>
      </section>
      <div className="editor-toolbar" role="toolbar" aria-label="편집 도구">
        <button
          className="button small primary"
          type="button"
          onClick={() => setSheet({ piece: null })}
        >
          <Plus size={17} /> 조각 추가
        </button>
        <div className="toolbar-group">
          <button
            className="icon-button"
            type="button"
            aria-label="실행 취소"
            disabled={!history.past.length}
            onClick={() => dispatch({ type: "undo" })}
          >
            <Undo2 size={18} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="다시 실행"
            disabled={!history.future.length}
            onClick={() => dispatch({ type: "redo" })}
          >
            <Redo2 size={18} />
          </button>
        </div>
      </div>
      {piece && (
        <div
          className="selection-toolbar"
          role="toolbar"
          aria-label="선택한 조각 편집"
        >
          {
            <>
              <span className="selection-name">{piece.title}</span>
              <button type="button" onClick={() => setSheet({ piece })}>
                <Pencil size={15} /> 수정
              </button>
              <button
                type="button"
                onClick={() => {
                  const copy = {
                    ...piece,
                    id: crypto.randomUUID(),
                    title: `${piece.title} (복사)`,
                  };
                  commit([...history.present, copy]);
                  setSelected(copy.id);
                }}
              >
                <Copy size={15} /> 복제
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  commit(
                    history.present.filter((item) => item.id !== piece.id),
                  );
                  setSelected(null);
                }}
              >
                <Trash2 size={15} /> 삭제
              </button>
            </>
          }
        </div>
      )}
      {saving.error && (
        <div className="error-box compact" role="alert">
          {saving.error}
          <button type="button" onClick={saving.retry}>
            저장 다시 시도
          </button>
        </div>
      )}
      <EditorCanvas
        pieces={history.present}
        selected={selected}
        onSelect={setSelected}
        onChange={update}
        zoom={zoom}
        onZoom={setZoom}
        createdAt={board.createdAt}
      />
      <div className="editor-bottom">
        <div>
          <span>조각을 눌러 선택하고 끌어서 이동해요</span>
          <small>두 손가락으로 확대·이동</small>
        </div>
        <div className="editor-bottom-tools">
          <span>{history.present.length}개의 조각</span>
          <div className="toolbar-group zoom-group">
            <button
              className="icon-button"
              type="button"
              aria-label="축소"
              disabled={zoom <= 1}
              onClick={() => setZoom(Math.max(1, zoom - 0.5))}
            >
              <ZoomOut size={18} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label="확대"
              disabled={zoom >= 4}
              onClick={() => setZoom(Math.min(4, zoom + 0.5))}
            >
              <ZoomIn size={18} />
            </button>
            <button
              className="button small"
              type="button"
              onClick={() => setZoom(1)}
            >
              전체보기 · {Math.round(zoom * 100)}%
            </button>
          </div>
        </div>
      </div>
      {sheet && (
        <PieceSheet
          piece={sheet.piece}
          createdAt={board.createdAt}
          onClose={() => setSheet(null)}
          onSave={savePiece}
        />
      )}
    </main>
  );
}
