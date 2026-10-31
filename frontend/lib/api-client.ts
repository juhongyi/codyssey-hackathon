import type { Board, Interview, Plan } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      body?.detail || "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.",
      response.status,
    );
  }
  return response.json();
}
export const api = {
  config: () => request<{ maxQuestions: number }>("/config"),
  createInterview: () => request<Interview>("/interviews", { method: "POST" }),
  interview: (id: string) =>
    request<Interview>(`/interviews/${encodeURIComponent(id)}`),
  answer: (id: string, questionNumber: number, audio: Blob) =>
    request<Interview>(`/interviews/${encodeURIComponent(id)}/answers`, {
      method: "POST",
      headers: {
        "Content-Type": audio.type,
        "X-Question-Number": String(questionNumber),
      },
      body: audio,
    }),
  generate: (id: string) =>
    request<Board>(`/interviews/${encodeURIComponent(id)}/board`, {
      method: "POST",
    }),
  board: () => request<Board>("/boards/current"),
  savePlan: (boardId: string, plan: Plan) =>
    request<Board>(`/boards/${encodeURIComponent(boardId)}/plans/${plan.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(plan),
    }),
};
