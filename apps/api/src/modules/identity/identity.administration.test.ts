import { afterEach, expect, it, vi } from "vitest";
import { requireAdministration } from "./identity.service.js";

afterEach(() => vi.useRealTimers());

it("accepts administrative MFA for 24 hours and requires verification at the boundary", () => {
  const now = new Date("2026-09-11T12:00:00Z");
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const verified = (age: number) => ({
    hasAdminPermission: true,
    mfaVerifiedAt: new Date(+now - age),
  });
  expect(() => requireAdministration(verified(23 * 3600_000 + 59 * 60_000 + 59999))).not.toThrow();
  expect(() => requireAdministration(verified(24 * 3600_000))).toThrow("IDENTITY_MFA_REQUIRED");
  expect(() => requireAdministration(verified(-1))).toThrow("IDENTITY_MFA_REQUIRED");
  expect(() => requireAdministration({ hasAdminPermission: true, mfaVerifiedAt: null })).toThrow(
    "IDENTITY_MFA_REQUIRED",
  );
  expect(() => requireAdministration({ hasAdminPermission: false, mfaVerifiedAt: now })).toThrow(
    "IDENTITY_ACCESS_DENIED",
  );
});
