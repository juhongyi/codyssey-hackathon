"use client";
import { Check, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { type Category, categories, type Piece } from "../lib/types";

export function PieceForm({
  piece,
  onClose,
  onSave,
}: {
  piece?: Piece;
  onClose: () => void;
  onSave: (piece: Piece) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="piece-dialog"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      aria-labelledby="piece-form-title"
    >
      <div className="sheet-handle" />
      <header className="sheet-header">
        <div>
          <h2 id="piece-form-title">조각 {piece ? "수정" : "추가"}</h2>
          <p>새로운 계획을 직접 적어보세요</p>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={onClose}
          aria-label="닫기"
        >
          <X size={20} />
        </button>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          onSave({
            id: piece?.id ?? crypto.randomUUID(),
            category: values.get("category") as Category,
            title: String(values.get("title")).trim(),
            description: String(values.get("description")).trim(),
            year: Number(values.get("year")),
            lane:
              piece?.lane ??
              (values.get("category") === "creative" ||
              values.get("category") === "relationship"
                ? 2
                : 0),
          });
        }}
      >
        <div className="sheet-body">
          <fieldset>
            <legend>
              카테고리 <em>*</em>
            </legend>
            <div className="category-options">
              {Object.entries(categories).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="radio"
                    name="category"
                    value={key}
                    defaultChecked={key === (piece?.category ?? "work")}
                  />
                  <span>
                    {label}
                    <Check size={12} />
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label htmlFor="piece-title">
            제목 <em>*</em>
          </label>
          <input
            id="piece-title"
            name="title"
            placeholder="예: 사이드 프로젝트 런칭"
            defaultValue={piece?.title}
            required
            maxLength={40}
            pattern=".*\S.*"
          />
          <label htmlFor="piece-description">
            내용 <span className="optional">(선택)</span>
          </label>
          <textarea
            id="piece-description"
            name="description"
            placeholder="어떤 미래의 조각인가요?"
            defaultValue={piece?.description}
            rows={3}
            maxLength={300}
          />
          <label htmlFor="piece-year">
            타임라인 위치 (년차) <em>*</em>
          </label>
          <select id="piece-year" name="year" defaultValue={piece?.year ?? 0}>
            {[
              0,
              0.3,
              0.5,
              1,
              1.2,
              1.5,
              2,
              2.5,
              3,
              3.2,
              3.5,
              4,
              4.4,
              4.5,
              5,
              ...(piece &&
              ![
                0, 0.3, 0.5, 1, 1.2, 1.5, 2, 2.5, 3, 3.2, 3.5, 4, 4.4, 4.5, 5,
              ].includes(piece.year)
                ? [piece.year]
                : []),
            ]
              .sort((a, b) => a - b)
              .map((year) => (
                <option key={year} value={year}>
                  {year}년차{year === 0 ? " (현재 · 2026.10)" : ""}
                </option>
              ))}
          </select>
        </div>
        <footer className="sheet-footer">
          <button className="button" type="button" onClick={onClose}>
            취소
          </button>
          <button className="button primary" type="submit">
            <Check size={18} />
            {piece ? "수정하기" : "추가하기"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
