export type Category = "work" | "creative" | "relationship" | "rest";
export type Piece = {
  id: string;
  title: string;
  description: string;
  category: Category;
  startMonth: number;
  durationMonths: number;
  lane: number;
};
export type Plan = {
  id: "A" | "B" | "C";
  label: string;
  title: string;
  description: string;
  pieces: Piece[];
  scores: Record<string, number>;
};
export type Board = {
  id: string;
  interviewId: string;
  createdAt: string;
  plans: Plan[];
};
export type Interview = {
  id: string;
  status: "ready" | "active" | "completed" | "generating" | "generated";
  question: string | null;
  questionNumber: number;
  maxQuestions: number;
  answeredCount: number;
  boardId?: string;
};
export const categories: Record<Category, string> = {
  work: "일",
  creative: "창작",
  relationship: "관계",
  rest: "휴식",
};
