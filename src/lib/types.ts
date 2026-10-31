export type Category = "work" | "creative" | "relationship" | "rest";
export const categories: Record<Category, string> = {
  work: "일",
  creative: "창작",
  relationship: "관계",
  rest: "휴식",
};
export interface Piece {
  id: string;
  category: Category;
  title: string;
  description: string;
  year: number;
  lane: number;
}
export interface Plan {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  description: string;
  startDate: string;
  pieces: Piece[];
  scores: {
    resource: number;
    interest: number;
    confidence: number;
    coherence: number;
  };
}
export interface Question {
  id: string;
  title: string;
  hint: string;
}
