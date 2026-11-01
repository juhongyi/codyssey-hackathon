import { expect, test } from "./fixtures";

test("overview renders exact time intervals and separate lanes without clipping", async ({
  page,
}) => {
  await page.goto("/board");
  const timeline = page.locator("#plan-A .board-timeline");
  await expect(timeline).toBeVisible();
  const full = await timeline
    .getByLabel("5년 활동 · 0~60개월 · 60개월")
    .boundingBox();
  const last = await timeline
    .getByLabel("마지막 달 실험 · 59~60개월 · 1개월")
    .boundingBox();
  const parallel = await timeline
    .getByLabel("병행 활동 · 0~60개월 · 60개월")
    .boundingBox();
  const bounds = await timeline.boundingBox();
  if (!full || !last || !parallel || !bounds)
    throw new Error("Missing timeline bounds");
  expect(last.x - full.x).toBeCloseTo((full.width * 59) / 60, 0);
  expect(last.width).toBeCloseTo(full.width / 60, 0);
  expect(last.x + last.width).toBeCloseTo(full.x + full.width, 0);
  expect(parallel.y).toBeGreaterThan(full.y + full.height);
  expect(last.y + last.height).toBeLessThan(bounds.y + bounds.height);
});

test("saved edits retain the same month interval in overview, editor and minimap", async ({
  page,
}) => {
  await page.goto("/board/A/edit");
  await page.getByRole("button", { name: /5년 활동/ }).press("Enter");
  await page.getByRole("button", { name: "수정", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("제목").fill("저장한 마지막 달 활동");
  await dialog.getByLabel("타임라인 위치(년차)").selectOption("4");
  await dialog.getByText("세부 배치", { exact: true }).click();
  await dialog.getByLabel("시작 월 (상대)").selectOption("11");
  await dialog.getByLabel("기간 (개월)").fill("1");
  await dialog.getByLabel("배치 줄").selectOption("2");
  await dialog.getByRole("button", { name: "수정하기" }).click();
  await page.getByRole("button", { name: "보드로 돌아가기" }).click();
  await expect(page).toHaveURL(/\/board$/);
  const piece = page
    .locator("#plan-A")
    .getByLabel("저장한 마지막 달 활동 · 59~60개월 · 1개월");
  await expect(piece).toHaveCSS("top", "257px");
  const interval = await piece.evaluate((element) => ({
    left: (element as HTMLElement).style.left,
    width: (element as HTMLElement).style.width,
  }));
  await page.reload();
  await expect(piece).toBeVisible();
  await page.locator("#plan-A").getByRole("link", { name: "편집" }).click();
  const editor = page
    .locator(".editor-piece")
    .filter({ hasText: "저장한 마지막 달 활동" });
  await expect(editor).toHaveCSS("top", "366px");
  expect(
    await editor.evaluate((element) => ({
      left: (element as HTMLElement).style.left,
      width: (element as HTMLElement).style.width,
    })),
  ).toEqual(interval);
  const minimap = page.locator(".minimap-piece").first();
  await expect(minimap).toHaveCSS("top", "15px");
  expect(
    await minimap.evaluate((element) => ({
      left: (element as HTMLElement).style.left,
      width: (element as HTMLElement).style.width,
    })),
  ).toEqual(interval);
});
