"use client";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { constrainPiece } from "../lib/editor-state";
import { type Category, categories, type Piece } from "../lib/types";

export function PieceSheet({
  piece,
  createdAt,
  onSave,
  onClose,
}: {
  piece: Piece | null;
  createdAt: string;
  onSave: (piece: Piece) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Piece>(
    () =>
      piece || {
        id: crypto.randomUUID(),
        title: "",
        description: "",
        category: "work",
        startMonth: 0,
        durationMonths: 6,
        lane: 0,
      },
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    opener.current = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return () => {
      opener.current?.focus();
    };
  }, []);
  const baseline = new Date(createdAt);
  const baseYear = baseline.getFullYear();
  const baseMonth = String(baseline.getMonth() + 1).padStart(2, "0");
  return (
    <dialog
      ref={dialog}
      className="piece-sheet"
      onCancel={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.title.trim())
            onSave(constrainPiece({ ...draft, title: draft.title.trim() }));
        }}
      >
        <div className="sheet-grip" />
        <header>
          <div>
            <h2>{piece ? "조각 수정" : "조각 추가"}</h2>
            <p>새로운 계획을 직접 적어보세요</p>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={21} />
          </button>
        </header>
        <fieldset>
          <legend>
            카테고리 <span aria-hidden="true">*</span>
          </legend>
          <div className="category-options">
            {(Object.entries(categories) as [Category, string][]).map(
              ([key, label]) => (
                <label
                  className={`${key} ${draft.category === key ? "checked" : ""}`}
                  key={key}
                >
                  <input
                    type="radio"
                    name="category"
                    value={key}
                    checked={draft.category === key}
                    onChange={() => setDraft({ ...draft, category: key })}
                  />
                  {label}
                </label>
              ),
            )}
          </div>
        </fieldset>
        <label className="field-label" htmlFor="piece-title">
          제목 <span aria-hidden="true">*</span>
        </label>
        <input
          id="piece-title"
          required
          pattern=".*\S.*"
          title="공백이 아닌 조각 이름을 입력해 주세요."
          maxLength={100}
          value={draft.title}
          onChange={(event) =>
            setDraft({ ...draft, title: event.target.value })
          }
          placeholder="예: 나만의 작은 작업실 열기"
        />
        <label className="field-label" htmlFor="piece-description">
          내용 <span>(선택)</span>
        </label>
        <textarea
          id="piece-description"
          rows={3}
          maxLength={2000}
          value={draft.description}
          onChange={(event) =>
            setDraft({ ...draft, description: event.target.value })
          }
          placeholder="어떤 모습일지, 자유롭게 적어보세요."
        />
        <label className="field-label" htmlFor="piece-year">
          타임라인 위치(년차) <span aria-hidden="true">*</span>
        </label>
        <select
          id="piece-year"
          required
          value={Math.floor(draft.startMonth / 12)}
          onChange={(event) =>
            setDraft({
              ...draft,
              startMonth:
                Number(event.target.value) * 12 + (draft.startMonth % 12),
              durationMonths: Math.min(
                draft.durationMonths,
                60 -
                  (Number(event.target.value) * 12 + (draft.startMonth % 12)),
              ),
            })
          }
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <option key={baseYear + i} value={i}>
              {i}년차 ({i === 0 ? "현재 · " : ""}
              {baseYear + i}.{baseMonth})
            </option>
          ))}
        </select>
        <details className="placement-details">
          <summary>세부 배치</summary>
          <div className="form-grid">
            <label>
              시작 월 (상대)
              <select
                value={draft.startMonth % 12}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    startMonth:
                      Math.floor(draft.startMonth / 12) * 12 +
                      Number(event.target.value),
                    durationMonths: Math.min(
                      draft.durationMonths,
                      60 -
                        (Math.floor(draft.startMonth / 12) * 12 +
                          Number(event.target.value)),
                    ),
                  })
                }
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
                  <option key={i + 1} value={i}>
                    {i + 1}개월째
                  </option>
                ))}
              </select>
            </label>
            <label>
              기간 (개월)
              <input
                type="number"
                min={1}
                max={60 - draft.startMonth}
                required
                value={draft.durationMonths}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    durationMonths: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              배치 줄
              <select
                value={draft.lane}
                onChange={(event) =>
                  setDraft({ ...draft, lane: Number(event.target.value) })
                }
              >
                {[0, 1, 2, 3].map((lane) => (
                  <option key={lane} value={lane}>
                    {lane + 1}번째 줄
                  </option>
                ))}
              </select>
            </label>
          </div>
        </details>
        <footer className="sheet-actions">
          <button className="button" type="button" onClick={onClose}>
            취소
          </button>
          <button className="button primary" type="submit">
            {piece ? "수정하기" : "추가하기"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
