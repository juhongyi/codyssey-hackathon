"use client";
import {
  ArrowLeft,
  Check,
  Copy,
  Maximize,
  Minus,
  PencilLine,
  Plus,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { applyEdit, createHistory, movePiece, redo, undo } from "../lib/editor";
import { categories, type Piece, type Plan } from "../lib/types";
import { PieceForm } from "./piece-form";

export function EditorView({ plan }: { plan: Plan }) {
  const [history, setHistory] = useState(() => createHistory(plan.pieces));
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<"new" | Piece | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(false);
  const [viewport, setViewport] = useState({ left: 0, width: 1 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: string;
    x: number;
    y: number;
    year: number;
    lane: number;
    width: number;
    moved: boolean;
  } | null>(null);
  const pieces = history.present;
  const current = pieces.find((piece) => piece.id === selected);
  function edit(next: Piece[]) {
    setHistory((value) => applyEdit(value, next));
  }
  const updateViewport = useCallback(() => {
    const el = scrollRef.current;
    if (el)
      setViewport({
        left: el.scrollLeft / el.scrollWidth,
        width: el.clientWidth / el.scrollWidth,
      });
  }, []);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateViewport);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [updateViewport]);
  function changeZoom(value: number) {
    setFit(false);
    setZoom(value);
    requestAnimationFrame(updateViewport);
  }
  function duplicate() {
    if (current) {
      const piece = movePiece(
        {
          ...current,
          id: crypto.randomUUID(),
          title: `${current.title} (복제)`,
        },
        current.year + 0.3,
        (current.lane + 1) % 3,
      );
      edit([...pieces, piece]);
      setSelected(piece.id);
    }
  }
  return (
    <main className="editor-page">
      <header className="editor-header">
        <Link className="button back-board" href="/board">
          <ArrowLeft size={16} />
          <span>라이프 보드</span>
        </Link>
        <h1>오딧세이 편집</h1>
        <Link className="button primary" href="/board">
          <span>완료</span>
          <Check className="desktop-check" size={16} />
        </Link>
      </header>
      <div className="editor-plan-info">
        <strong>
          {plan.label} · {plan.title}
        </strong>
        <span>2026.10~</span>
      </div>
      <div className="editor-toolbar">
        <button
          className="button primary"
          type="button"
          onClick={() => setForm("new")}
        >
          <Plus size={17} /> 조각 추가
        </button>
        <div>
          <button
            className="icon-button"
            type="button"
            aria-label="실행 취소"
            disabled={!history.past.length}
            onClick={() => {
              setHistory(undo);
              setSelected(null);
            }}
          >
            <Undo2 size={19} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="다시 실행"
            disabled={!history.future.length}
            onClick={() => {
              setHistory(redo);
              setSelected(null);
            }}
          >
            <Redo2 size={19} />
          </button>
        </div>
      </div>
      <div className="editor-map-row">
        <strong>
          <span className="yellow-dot" /> 전체 5개년 미니맵
        </strong>
        <div
          className="minimap"
          role="slider"
          aria-label="타임라인 이동"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(viewport.left * 100)}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault();
              scrollRef.current?.scrollBy({
                left: event.key === "ArrowRight" ? 100 : -100,
                behavior: "smooth",
              });
            }
          }}
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const el = scrollRef.current;
            if (el)
              el.scrollTo({
                left:
                  ((event.clientX - rect.left) / rect.width) * el.scrollWidth -
                  el.clientWidth / 2,
                behavior: "smooth",
              });
          }}
        >
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <span key={n}>{n}</span>
          ))}
          <i
            style={{
              left: `${viewport.left * 100}%`,
              width: `${viewport.width * 100}%`,
            }}
          />
        </div>
      </div>
      <div className="editor-scroll" ref={scrollRef} onScroll={updateViewport}>
        <div
          className={`editor-canvas ${fit ? "fit-view" : ""}`}
          style={{
            width: `${zoom * 100}%`,
            minWidth: fit ? 0 : `${zoom * 660}px`,
          }}
        >
          <div className="canvas-grid">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <div
                className="canvas-year"
                key={n}
                style={{ left: `${4 + n * 17}%` }}
              >
                <strong>{n}</strong>
                <span>{2026 + n}.10</span>
              </div>
            ))}
          </div>
          <div className="canvas-orbit" />
          {pieces.map((piece) => (
            <button
              key={piece.id}
              type="button"
              className={`editor-piece ${piece.category} ${selected === piece.id ? "selected" : ""}`}
              style={{
                left: fit
                  ? `${3 + piece.year * 15.6}%`
                  : `calc(${4 + piece.year * 17}% - ${(piece.year / 5) * 100}px)`,
                top: `${84 + piece.lane * 117}px`,
              }}
              aria-pressed={selected === piece.id}
              aria-label={`${categories[piece.category]}: ${piece.title}, ${piece.year}년차. 방향키로 이동`}
              onClick={() => setSelected(piece.id)}
              onKeyDown={(event) => {
                const moves: Record<string, [number, number]> = {
                  ArrowLeft: [-0.1, 0],
                  ArrowRight: [0.1, 0],
                  ArrowUp: [0, -1],
                  ArrowDown: [0, 1],
                };
                const delta = moves[event.key];
                if (delta) {
                  event.preventDefault();
                  setSelected(piece.id);
                  edit(
                    pieces.map((p) =>
                      p.id === piece.id
                        ? movePiece(p, p.year + delta[0], p.lane + delta[1])
                        : p,
                    ),
                  );
                }
              }}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                setSelected(piece.id);
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = {
                  id: piece.id,
                  x: event.clientX,
                  y: event.clientY,
                  year: piece.year,
                  lane: piece.lane,
                  width: event.currentTarget.parentElement?.clientWidth ?? 660,
                  moved: false,
                };
              }}
              onPointerMove={(event) => {
                const start = drag.current;
                if (!start || start.id !== piece.id) return;
                const x = event.clientX - start.x;
                const y = event.clientY - start.y;
                if (Math.abs(x) + Math.abs(y) > 5) {
                  start.moved = true;
                  event.currentTarget.style.transform = `translate(${x}px, ${y}px)`;
                }
              }}
              onPointerUp={(event) => {
                const start = drag.current;
                if (!start) return;
                event.currentTarget.style.transform = "";
                if (start.moved)
                  edit(
                    pieces.map((p) =>
                      p.id === start.id
                        ? movePiece(
                            p,
                            start.year +
                              (event.clientX - start.x) / (start.width * 0.17),
                            start.lane + (event.clientY - start.y) / 117,
                          )
                        : p,
                    ),
                  );
                drag.current = null;
              }}
              onPointerCancel={(event) => {
                event.currentTarget.style.transform = "";
                drag.current = null;
              }}
            >
              <span className="category-label">
                {categories[piece.category]}
              </span>
              <strong>{piece.title}</strong>
              <small>{piece.description}</small>
              <span className="piece-time">{piece.year}년차</span>
            </button>
          ))}
        </div>
      </div>
      <div className="editor-bottom">
        <section className="selection-toolbar" aria-label="선택 조각 도구">
          {current ? (
            <>
              <span className="selected-title">
                {categories[current.category]} / {current.title}
              </span>
              <div>
                <button
                  className="button"
                  type="button"
                  onClick={() => setForm(current)}
                >
                  <PencilLine size={15} /> 수정
                </button>
                <button className="button" type="button" onClick={duplicate}>
                  <Copy size={15} /> 복제
                </button>
                <button
                  className="button danger"
                  type="button"
                  onClick={() => {
                    edit(pieces.filter((piece) => piece.id !== selected));
                    setSelected(null);
                  }}
                >
                  <Trash2 size={15} /> 삭제
                </button>
              </div>
            </>
          ) : (
            <p>✧ 조각을 눌러 선택하고 끌어서 이동해요</p>
          )}
        </section>
        <div className="zoom-toolbar">
          <span>방향키로도 조각을 이동할 수 있어요</span>
          <div>
            <button
              className="icon-button"
              type="button"
              aria-label="축소"
              disabled={zoom <= 1}
              onClick={() => changeZoom(Math.max(1, zoom - 0.5))}
            >
              <Minus size={17} />
            </button>
            <output>{fit ? "전체" : `${Math.round(zoom * 100)}%`}</output>
            <button
              className="icon-button"
              type="button"
              aria-label="확대"
              disabled={zoom >= 3}
              onClick={() => changeZoom(Math.min(3, zoom + 0.5))}
            >
              <Plus size={17} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label="전체보기"
              onClick={() => {
                changeZoom(1);
                setFit(true);
                scrollRef.current?.scrollTo({ left: 0 });
              }}
            >
              <Maximize size={17} />
            </button>
          </div>
        </div>
      </div>
      {form && (
        <PieceForm
          piece={form === "new" ? undefined : form}
          onClose={() => setForm(null)}
          onSave={(piece) => {
            edit(
              form === "new"
                ? [...pieces, piece]
                : pieces.map((p) => (p.id === piece.id ? piece : p)),
            );
            setSelected(piece.id);
            setForm(null);
          }}
        />
      )}
    </main>
  );
}
