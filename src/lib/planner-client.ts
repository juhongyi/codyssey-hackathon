import { plans, questions } from "./mock-data";
import type { Plan, Question } from "./types";

// UI-facing contract. Replace this adapter with fetch + response mapping when APIs exist.
// Authentication and persistence intentionally aren't simulated here.
export interface PlannerClient {
  getPlans(): Promise<Plan[]>;
  getPlan(id: string): Promise<Plan | null>;
  getQuestions(): Promise<Question[]>;
}
export const plannerClient: PlannerClient = {
  async getPlans() {
    return structuredClone(plans);
  },
  async getPlan(id) {
    return structuredClone(plans.find((plan) => plan.id === id) ?? null);
  },
  async getQuestions() {
    return structuredClone(questions);
  },
};
