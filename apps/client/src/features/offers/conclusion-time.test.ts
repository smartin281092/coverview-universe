import { expect, it } from "vitest";
import { parseZurichDateTime, formatZurichDateTime } from "@coverview/ui";
it("preserves second precision for an actual signature follow-up independently of browser timezone", () => {
  expect(parseZurichDateTime("2026-01-05T10:00:17")).toBe("2026-01-05T09:00:17.000Z");
  expect(formatZurichDateTime("2026-07-05T08:12:37.000Z", true)).toBe("2026-07-05T10:12:37");
  expect(parseZurichDateTime("2026-07-05T10:12")).toBe("2026-07-05T08:12:00.000Z");
});
it("rejects ambiguous, nonexistent and malformed civil times including seconds", () => {
  for (const value of [
    "2026-10-25T02:30:17",
    "2026-03-29T02:30:17",
    "2026-01-05T10:00:99",
    "2026-02-31T10:00:17",
  ])
    expect(() => parseZurichDateTime(value)).toThrow();
});
