import { test as base } from "@playwright/test";

export const board = {
  id: "board",
  interviewId: "interview",
  createdAt: "2026-10-01T00:00:00Z",
  plans: ["현재의 일 발전", "새로운 창작 경로", "휴식 중심의 삶"].map(
    (title, index) => ({
      id: "ABC"[index],
      label: `Plan ${"ABC"[index]}`,
      title,
      description: `${title}의 구체적인 단계`,
      scores: {},
      pieces: [
        {
          id: `${index}-full`,
          title: "5년 활동",
          description: "활동",
          category: "work",
          startMonth: 0,
          durationMonths: 60,
          lane: 0,
        },
        {
          id: `${index}-last`,
          title: "마지막 달 실험",
          description: "실험",
          category: "rest",
          startMonth: 59,
          durationMonths: 1,
          lane: 3,
        },
        {
          id: `${index}-parallel`,
          title: "병행 활동",
          description: "병행",
          category: "creative",
          startMonth: 0,
          durationMonths: 60,
          lane: 1,
        },
      ],
    }),
  ),
};

export const test = base.extend({
  page: async ({ page }, use) => {
    const stored = structuredClone(board);
    await page.addInitScript(() =>
      localStorage.setItem("odyssey.interview", "interview"),
    );
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/config")
        return route.fulfill({ json: { maxQuestions: 10 } });
      if (path === "/api/interviews/interview")
        return route.fulfill({
          json: {
            id: "interview",
            status: "completed",
            question: null,
            questionNumber: 3,
            answeredCount: 3,
            maxQuestions: 10,
          },
        });
      if (path === "/api/boards/current")
        return route.fulfill({ json: stored });
      if (
        path.startsWith("/api/boards/board/plans/") &&
        route.request().method() === "PUT"
      ) {
        const plan = route.request().postDataJSON();
        const index = stored.plans.findIndex((item) => item.id === plan.id);
        if (index < 0) throw new Error(`Unknown plan: ${plan.id}`);
        stored.plans[index] = plan;
        return route.fulfill({ json: stored });
      }
      if (path === "/api/interviews/interview/board")
        return route.fulfill({ json: board });
      throw new Error(
        `Unexpected API call: ${route.request().method()} ${path}`,
      );
    });
    await use(page);
  },
});
export { expect } from "@playwright/test";
