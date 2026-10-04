import { expect, it } from "vitest";
import { parseZurichDateTime } from "@coverview/ui";

it("keeps civil deadlines independent of machine timezone and refuses nonexistent or duplicated DST times", () => {
  expect(parseZurichDateTime("2026-06-04T14:00")).toBe("2026-06-04T12:00:00.000Z");
  expect(parseZurichDateTime("2026-12-04T14:00")).toBe("2026-12-04T13:00:00.000Z");
  expect(() => parseZurichDateTime("2026-03-29T02:30")).toThrow();
  expect(() => parseZurichDateTime("2026-10-25T02:30")).toThrow();
  expect(() => parseZurichDateTime("2026-02-30T14:00")).toThrow();
});
