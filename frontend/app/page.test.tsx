import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import Home from "./page";

it("previews all three distinct futures with sample timelines and ratings", () => {
  const html = renderToStaticMarkup(<Home />);
  const cards = [
    ...html.matchAll(
      /<article\b[^>]*class="[^"]*sample-plan-card[^"]*"[^>]*>[\s\S]*?<\/article>/g,
    ),
  ].map(([card]) => card);

  expect(cards).toHaveLength(3);
  for (const [index, card] of cards.entries()) {
    expect(card).toContain(`Plan ${index + 1}`);
    expect(card).toContain("sample-plan-card");
    expect(card).toContain('aria-label="5년 타임라인"');
    expect(card).toContain("자원");
    expect(card).not.toContain("편집");
  }
  const titles = cards.map((card) => card.match(/<h2>(.*?)<\/h2>/)?.[1]);
  expect(titles.every(Boolean)).toBe(true);
  expect(new Set(titles).size).toBe(3);
});
