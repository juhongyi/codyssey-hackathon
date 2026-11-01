import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { Piece } from "../lib/types";
import { Timeline } from "./timeline";

it("renders actual month intervals and saved lanes, including the last month", () => {
  const pieces: Piece[] = [
    {
      id: "full",
      title: "전체",
      description: "",
      category: "work",
      startMonth: 0,
      durationMonths: 60,
      lane: 0,
    },
    {
      id: "last",
      title: "마지막",
      description: "",
      category: "rest",
      startMonth: 59,
      durationMonths: 1,
      lane: 3,
    },
    {
      id: "parallel",
      title: "병행",
      description: "",
      category: "creative",
      startMonth: 0,
      durationMonths: 60,
      lane: 1,
    },
  ];
  const html = renderToStaticMarkup(
    <Timeline pieces={pieces} createdAt="2026-10-01" variant="board" />,
  );
  expect(html).toContain("left:0%;width:100%;top:49px");
  expect(html).toContain(
    `left:${(59 / 60) * 100}%;width:${(1 / 60) * 100}%;top:361px`,
  );
  expect(html).toContain("left:0%;width:100%;top:153px");
  expect(html).toContain("height:494px");
  expect(html).toContain("59~60개월 · 1개월");
});
