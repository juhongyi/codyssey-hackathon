import { board, expect, test } from "./fixtures";

test("completed interview generates three plans and every editor returns to the board", async ({
  page,
}) => {
  await page.goto("/interview");
  await page.getByRole("button", { name: "나의 세 가지 미래 만들기" }).click();
  await page.getByRole("link", { name: "세 가지 미래 보기" }).click();
  await expect(page).toHaveURL(/\/board$/);
  for (const [index, plan] of board.plans.entries()) {
    await expect(
      page.getByRole("heading", { name: plan.title, exact: true }),
    ).toBeVisible();
    await page
      .locator(`#plan-${plan.id}`)
      .getByRole("link", { name: "편집" })
      .click();
    await expect(page).toHaveURL(new RegExp(`/board/${plan.id}/edit$`));
    await expect(
      page.getByRole("heading", { name: `Plan ${index + 1} · ${plan.title}` }),
    ).toBeVisible();
    await page.getByRole("button", { name: "보드로 돌아가기" }).click();
    await expect(page).toHaveURL(/\/board$/);
  }
});

test("shows generation progress and retries a failed generation", async ({
  page,
}) => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let attempts = 0;
  await page.route("**/api/interviews/interview/board", async (route) => {
    attempts++;
    if (attempts === 1) {
      await waiting;
      return route.fulfill({ status: 503, json: { detail: "생성 일시 실패" } });
    }
    return route.fulfill({ json: board });
  });
  await page.goto("/interview");
  await page.getByRole("button", { name: "나의 세 가지 미래 만들기" }).click();
  await expect(
    page.getByRole("heading", { name: "이야기를 마무리하고 있어요" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "조금만 기다려 주세요…" }),
  ).toBeDisabled();
  release();
  await expect(
    page.getByRole("alert").filter({ hasText: "생성 일시 실패" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "다시 시도하기" }).click();
  await expect(
    page.getByRole("link", { name: "세 가지 미래 보기" }),
  ).toBeVisible();
  expect(attempts).toBe(2);
});

test("board not created links to an interview", async ({ page }) => {
  await page.route("**/api/boards/current", (route) =>
    route.fulfill({ status: 404, json: { detail: "No board" } }),
  );
  await page.goto("/board");
  await expect(
    page.getByRole("heading", { name: "첫 번째 이야기를 기다려요" }),
  ).toBeVisible();
  await expect(page.locator(".board-plan-card")).toHaveCount(0);
  await page.getByRole("link", { name: "내 이야기 시작하기" }).click();
  await expect(page).toHaveURL(/\/interview$/);
  await expect(
    page.getByRole("button", { name: "나의 세 가지 미래 만들기" }),
  ).toBeVisible();
});
