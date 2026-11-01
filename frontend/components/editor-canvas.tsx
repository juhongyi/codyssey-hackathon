"use client";
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  constrainPiece,
  findOverlappingPieces,
  getNextOverlappingPieceId,
  resizePiece,
} from "../lib/editor-state";
import type { Piece } from "../lib/types";
import { MinimapBar } from "./minimap-bar";
import { NoteCard } from "./note-card";

type Gesture = {
  piece: Piece;
  mode: "move" | "start" | "end";
  x: number;
  y: number;
  width: number;
  next: Piece;
  hasMoved: boolean;
  wasSelected: boolean;
};
export function EditorCanvas({
  pieces,
  selected,
  onSelect,
  onChange,
  zoom,
  onZoom,
  createdAt,
}: {
  pieces: Piece[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onChange: (piece: Piece) => void;
  zoom: number;
  onZoom: (zoom: number) => void;
  createdAt: string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const lastGesture = useRef<Gesture | null>(null);
  const [preview, setPreview] = useState<Piece | null>(null);
  const [view, setView] = useState({ start: 0, span: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const pan = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = () =>
      setView({
        start: element.scrollLeft / element.scrollWidth,
        span: element.clientWidth / element.scrollWidth,
      });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (canvas.current) observer.observe(canvas.current);
    element.addEventListener("scroll", update);
    update();
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, []);
  function begin(
    event: ReactPointerEvent<HTMLElement>,
    piece: Piece,
    mode: Gesture["mode"],
  ) {
    if (pointers.current.size > 1) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const wasSelected = selected === piece.id;
    onSelect(piece.id);
    gesture.current = {
      piece,
      mode,
      x: event.clientX,
      y: event.clientY,
      width: canvas.current?.clientWidth || 1,
      next: piece,
      hasMoved: false,
      wasSelected,
    };
  }
  function move(event: ReactPointerEvent<HTMLElement>) {
    const active = gesture.current;
    if (!active) return;
    const dist = Math.hypot(event.clientX - active.x, event.clientY - active.y);
    if (dist > 5) {
      active.hasMoved = true;
    }
    const delta = Math.round(((event.clientX - active.x) / active.width) * 60);
    let next = { ...active.piece };
    if (active.mode === "move")
      next = constrainPiece({
        ...next,
        startMonth: next.startMonth + delta,
        lane: next.lane + Math.round((event.clientY - active.y) / 128),
      });
    if (active.mode !== "move")
      next = resizePiece(active.piece, active.mode, delta);
    active.next = next;
    if (active.hasMoved) {
      setPreview(next);
    }
  }
  function finish(cancel = false) {
    if (gesture.current && !cancel && gesture.current.hasMoved) {
      onChange(gesture.current.next);
    }
    lastGesture.current = gesture.current;
    gesture.current = null;
    setPreview(null);
  }
  function handleClick(piece: Piece) {
    const g = lastGesture.current;
    if (g && g.piece.id === piece.id && g.hasMoved) {
      return;
    }
    const isAlreadySelected =
      g && g.piece.id === piece.id ? g.wasSelected : selected === piece.id;
    if (isAlreadySelected) {
      const nextId = getNextOverlappingPieceId(piece.id, pieces);
      onSelect(nextId);
    } else {
      onSelect(piece.id);
    }
  }
  const base = new Date(createdAt);
  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (pointers.current.size === 2) {
      finish(true);
      pan.current = null;
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    } else if (!(event.target as HTMLElement).closest(".editor-piece")) {
      pan.current = {
        x: event.clientX,
        y: event.clientY,
        left: event.currentTarget.scrollLeft,
        top: event.currentTarget.scrollTop,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      onSelect(null);
    }
  }
  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      onZoom(
        Math.max(
          1,
          Math.min(
            4,
            (pinch.current.zoom * Math.hypot(a.x - b.x, a.y - b.y)) /
              Math.max(1, pinch.current.distance),
          ),
        ),
      );
    } else if (pan.current && viewport.current) {
      viewport.current.scrollLeft =
        pan.current.left - (event.clientX - pan.current.x);
      viewport.current.scrollTop =
        pan.current.top - (event.clientY - pan.current.y);
    }
  }
  function pointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    pinch.current = null;
    pan.current = null;
  }
  return (
    <>
      <MinimapBar
        pieces={pieces}
        {...view}
        onNavigate={(fraction) => {
          if (viewport.current)
            viewport.current.scrollLeft =
              fraction * viewport.current.scrollWidth;
        }}
      />
      <div
        ref={viewport}
        className="editor-viewport"
        onPointerDownCapture={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerEnd}
        onPointerCancel={pointerEnd}
      >
        <section
          ref={canvas}
          className="editor-canvas"
          style={{ width: `${zoom * 100}%` }}
          aria-label="타임라인 캔버스"
        >
          <div className="editor-years">
            {[0, 1, 2, 3, 4, 5].map((year) => (
              <div key={year} style={{ left: `${year * 20}%` }}>
                <span>{year}</span>
                <small>
                  {base.getFullYear() + year}.
                  {String(base.getMonth() + 1).padStart(2, "0")}
                </small>
              </div>
            ))}
          </div>
          <div className="editor-baseline" />
          {pieces.map((original) => {
            const piece = preview?.id === original.id ? preview : original;
            const isSelected = selected === piece.id;
            const overlaps = findOverlappingPieces(piece, pieces);
            return (
              <div
                key={piece.id}
                className={`editor-piece ${piece.category} ${isSelected ? "selected" : ""}`}
                style={{
                  left: `${(piece.startMonth / 60) * 100}%`,
                  width: `${(piece.durationMonths / 60) * 100}%`,
                  top: `${110 + piece.lane * 128}px`,
                }}
              >
                <button
                  type="button"
                  className="piece-body"
                  aria-pressed={isSelected}
                  onClick={() => handleClick(piece)}
                  onPointerDown={(event) => begin(event, piece, "move")}
                  onPointerMove={move}
                  onPointerUp={() => finish()}
                  onPointerCancel={() => finish(true)}
                >
                  <NoteCard piece={piece} />
                  {overlaps.length > 1 && (
                    <span className="piece-overlap-badge">
                      중첩 {overlaps.length}
                    </span>
                  )}
                </button>
                {isSelected && (
                  <>
                    <button
                      type="button"
                      className="resize-handle resize-start"
                      aria-label={`${piece.title} 시작 한 달 앞당기기, 끌어서 시작 조절`}
                      onClick={(event) => {
                        if (event.detail === 0 && piece.startMonth > 0)
                          onChange(resizePiece(piece, "start", -1));
                      }}
                      onPointerDown={(event) => begin(event, piece, "start")}
                      onPointerMove={move}
                      onPointerUp={() => finish()}
                      onPointerCancel={() => finish(true)}
                    />
                    <button
                      type="button"
                      className="resize-handle resize-end"
                      aria-label={`${piece.title} 기간 한 달 늘리기, 끌어서 기간 조절`}
                      onClick={(event) => {
                        if (event.detail === 0)
                          onChange(resizePiece(piece, "end", 1));
                      }}
                      onPointerDown={(event) => begin(event, piece, "end")}
                      onPointerMove={move}
                      onPointerUp={() => finish()}
                      onPointerCancel={() => finish(true)}
                    />
                  </>
                )}
              </div>
            );
          })}
        </section>
      </div>
      <nav className="pan-controls" aria-label="타임라인 이동">
        <button
          type="button"
          onClick={() =>
            viewport.current?.scrollBy({ left: -180, behavior: "smooth" })
          }
        >
          ← 이전 구간
        </button>
        <span>빈 곳을 끌어 이동</span>
        <button
          type="button"
          onClick={() =>
            viewport.current?.scrollBy({ left: 180, behavior: "smooth" })
          }
        >
          다음 구간 →
        </button>
      </nav>
    </>
  );
}
