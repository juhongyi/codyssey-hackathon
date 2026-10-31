import { expect, it } from "vitest";
import { SaveQueue } from "./save-queue";

it("serializes writes and coalesces newer edits while an earlier write is in flight", async () => {
  let release: () => void = () => {};
  const sent: number[] = [];
  const queue = new SaveQueue<number>(async (value) => {
    sent.push(value);
    if (value === 1)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
  });
  queue.set(1);
  const saving = queue.flush();
  queue.set(2);
  queue.set(3);
  expect(sent).toEqual([1]);
  release();
  await saving;
  expect(sent).toEqual([1, 3]);
});

it("retains the latest edit after failure so retry cannot restore a stale plan", async () => {
  const sent: number[] = [];
  let failing = true;
  const queue = new SaveQueue<number>(async (value) => {
    sent.push(value);
    if (failing) throw new Error("offline");
  });
  queue.set(1);
  await expect(queue.flush()).rejects.toThrow("offline");
  queue.set(2);
  failing = false;
  await queue.flush();
  expect(sent).toEqual([1, 2]);
});
