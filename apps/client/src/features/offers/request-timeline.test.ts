import { expect, it } from "vitest";
import { timeline } from "./request-timeline";

const at = (id: string, day: number) => ({ id, at: Date.UTC(2026, 9, day) });

it("mixes Wallet and comparator requests newest first", () => {
  const result = timeline([
    { items: [at("lead-9", 9), at("lead-2", 2)], more: false },
    { items: [at("health-5", 5), at("health-1", 1)], more: false },
  ]);
  expect(result.items.map((item) => item.id)).toEqual(["lead-9", "health-5", "lead-2", "health-1"]);
  expect(result.more).toBe(false);
});

it("holds back what an unloaded page could still precede", () => {
  const result = timeline([
    { items: [at("lead-9", 9), at("lead-2", 2)], more: false },
    { items: [at("health-7", 7), at("health-5", 5)], more: true },
  ]);
  // The comparator's next page may hold requests from the 3rd or 4th: the lead of the 2nd waits.
  expect(result.items.map((item) => item.id)).toEqual(["lead-9", "health-7", "health-5"]);
  expect(result.more).toBe(true);
});
