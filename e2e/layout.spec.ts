import { expect, test } from "@playwright/test";

for (const width of [360, 390, 430, 480, 1440]) {
  test(`mobile-first layout stays inside a centered 480px column at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 884 });
    for (const path of [
      "/",
      "/login",
      "/interview",
      "/board",
      "/board/a/edit",
      "/missing",
    ]) {
      await page.goto(path);
      const bounds = await page.locator("body").boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds?.width).toBe(Math.min(width, 480));
      expect(bounds?.x).toBe((width - Math.min(width, 480)) / 2);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      if (path === "/") {
        const button = page
          .getByRole("link", { name: "내 이야기 시작하기" })
          .first();
        expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(56);
      }
      if (path === "/interview") {
        const action = await page
          .getByRole("button", { name: "마이크 켜고 시작하기" })
          .boundingBox();
        expect(action && action.y + action.height).toBeLessThanOrEqual(884);
      }
      if (path === "/board") {
        await expect(page.locator(".plan-card")).toHaveCount(3);
        const cards = await page.locator(".plan-card").all();
        const first = await cards[0].boundingBox();
        const second = await cards[1].boundingBox();
        expect(second?.x).toBe(first?.x);
        expect(second?.y).toBeGreaterThan(
          (first?.y ?? 0) + (first?.height ?? 0),
        );
      }
      if (path === "/board/a/edit") {
        await page
          .getByRole("button", { name: "조각 추가", exact: true })
          .click();
        const sheet = await page.getByRole("dialog").boundingBox();
        expect(sheet?.width).toBe(Math.min(width, 480));
        expect(sheet?.x).toBe(bounds?.x);
        expect(sheet && sheet.y + sheet.height).toBeLessThanOrEqual(884);
        const input = page.getByLabel("제목", { exact: false });
        expect(
          await input.evaluate((el) =>
            Number.parseFloat(getComputedStyle(el).fontSize),
          ),
        ).toBeGreaterThanOrEqual(16);
      }
    }
  });
}
