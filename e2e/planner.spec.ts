import { expect, test } from "@playwright/test";

test("landing, login UI, board navigation and missing plan", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "나만의 다음 장",
  );
  await expect(page.locator("body")).not.toContainText("이 브라우저에 저장됨");
  await page.getByRole("link", { name: "로그인", exact: true }).click();
  await page.getByLabel("이메일", { exact: true }).fill("hello@example.com");
  await page.getByLabel("비밀번호", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("로그인 연동은 준비 중");
  await page.getByRole("link", { name: "라이프 보드 둘러보기" }).click();
  await expect(page.locator(".plan-card")).toHaveCount(3);
  await expect(page.getByRole("meter")).toHaveCount(12);
  await page.getByRole("link", { name: "Plan C" }).click();
  await expect(page).toHaveURL(/#plan-c$/);
  await page.goto("/board/missing/edit");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "아직 그려지지 않은 페이지예요",
  );
});

test("editor supports create, update, duplicate, movement, history and discard on exit", async ({
  page,
}) => {
  await page.goto("/board/a/edit");
  await page.getByRole("button", { name: "조각 추가", exact: true }).click();
  await page.getByLabel("제목", { exact: false }).fill("사이드 프로젝트 런칭");
  await page.getByLabel("내용", { exact: false }).fill("첫 번째 MVP 출시");
  await page.getByLabel("타임라인 위치", { exact: false }).selectOption("1");
  await page.getByRole("button", { name: "추가하기", exact: true }).click();
  const added = page.getByRole("button", { name: /일: 사이드 프로젝트 런칭/ });
  await expect(added).toHaveAttribute("aria-pressed", "true");
  await added.focus();
  await page.keyboard.press("ArrowRight");
  await expect(added).toHaveAccessibleName(/1.1년차/);
  await page.getByRole("button", { name: "수정", exact: true }).click();
  await page.getByLabel("제목", { exact: false }).fill("제품 출시");
  await page.getByRole("button", { name: "수정하기", exact: true }).click();
  await page.getByRole("button", { name: "복제", exact: true }).click();
  await expect(page.locator(".editor-piece")).toHaveCount(7);
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.locator(".editor-piece")).toHaveCount(6);
  await page.getByRole("button", { name: "실행 취소", exact: true }).click();
  await expect(page.locator(".editor-piece")).toHaveCount(7);
  await page.getByRole("button", { name: "다시 실행", exact: true }).click();
  await expect(page.locator(".editor-piece")).toHaveCount(6);
  await page.getByRole("button", { name: "확대", exact: true }).click();
  await expect(page.locator("output")).toHaveText("150%");
  await page.getByRole("button", { name: "전체보기", exact: true }).click();
  expect(
    await page
      .locator(".editor-scroll")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.getByRole("link", { name: "완료", exact: true }).click();
  await page
    .locator("#plan-a")
    .getByRole("link", { name: "편집", exact: true })
    .click();
  await expect(page.locator(".editor-piece")).toHaveCount(5);
  await expect(page.getByRole("button", { name: /일: 제품 출시/ })).toHaveCount(
    0,
  );
});

test("real browser microphone supports mute, question progression and releases tracks", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    const streams: MediaStream[] = [];
    Object.assign(window, { __streams: streams });
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      streams.push(stream);
      return stream;
    };
  });
  await page.goto("/interview");
  await page.getByRole("button", { name: "마이크 켜고 시작하기" }).click();
  await expect(
    page.getByRole("button", { name: "마이크 끄기", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "마이크 끄기", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /답변 완료|질문 읽기 건너뛰기/ }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "마이크 켜기", exact: true }).click();
  for (let index = 0; index < 5; index++) {
    await expect(page.locator(".interview-header")).toContainText(
      `질문 ${index + 1}`,
    );
    const skip = page.getByRole("button", { name: "질문 읽기 건너뛰기" });
    if (await skip.isVisible()) await skip.click();
    await page.getByRole("button", { name: "답변 완료", exact: true }).click();
  }
  await expect(
    page.getByRole("link", { name: "세 가지 미래 보기" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      (window as unknown as { __streams: MediaStream[] }).__streams.every(
        (stream) =>
          stream.getTracks().every((track) => track.readyState === "ended"),
      ),
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "세 가지 미래 보기" }).click();
  await expect(page.locator(".plan-card")).toHaveCount(3);
});

test("microphone denial displays actionable error and supports retry", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let calls = 0;
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      calls++;
      if (calls === 1)
        throw new DOMException("Permission denied", "NotAllowedError");
      return original(constraints);
    };
  });
  await page.context().grantPermissions(["microphone"]);
  await page.goto("/interview");
  await page.getByRole("button", { name: "마이크 켜고 시작하기" }).click();
  await expect(
    page.getByRole("heading", { name: "마이크를 사용할 수 없어요" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "마이크 끄기", exact: true }),
  ).toBeVisible();
});
