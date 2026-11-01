import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Ratings } from "./rating-bar";

let root: ReactTestRenderer;
beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

it("shows every dimension in fixed order with fixed colors, distinguishing zero from unassessed", async () => {
  await act(async () => {
    root = create(<Ratings scores={{ coherence: 7, resources: 0 }} />);
  });
  const ratings = root.root.findAllByProps({ className: "rating" });
  expect(ratings).toHaveLength(4);
  expect(
    ratings.map((item) => item.findAllByType("span")[0].children[0]),
  ).toEqual(["자원", "호감", "자신감", "일관성"]);
  expect(ratings[0].findByType("small").children[0]).toBe("0");
  expect(ratings[1].findByType("small").children).toEqual(["미평가"]);
  expect(
    ratings.map((item) => item.findByType("i").props.style.background),
  ).toEqual(["#D8B54A", "#F2AAA0", "#DDE7D3", "#DBE3EF"]);
});

it("does not assign defaults and allows explicit zero before slider edits", async () => {
  const onChange = vi.fn();
  await act(async () => {
    root = create(<Ratings scores={{ confidence: 8 }} onChange={onChange} />);
  });
  expect(onChange).not.toHaveBeenCalled();
  const sliders = root.root.findAllByType("input");
  expect(sliders).toHaveLength(4);
  expect(sliders[0].props).toMatchObject({
    min: 0,
    max: 10,
    step: 1,
    disabled: true,
    "aria-label": "자원",
  });
  await act(async () => root.root.findAllByType("button")[0].props.onClick());
  expect(onChange).toHaveBeenLastCalledWith({ confidence: 8, resources: 0 });
  await act(async () => sliders[2].props.onChange({ target: { value: "10" } }));
  expect(onChange).toHaveBeenLastCalledWith({ confidence: 10 });
});
