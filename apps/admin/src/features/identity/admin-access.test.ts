import { describe, expect, it } from "vitest";
import { adminPageDecision, isSignedIn, type AdminAccess } from "./admin-access";

describe("Admin pages by access (20 October 2026)", () => {
  const adminPages = ["/users", "/partner", "/insurance-requests", "/notifications", "/unknown"];
  const accountPages = ["/", "/account", "/mfa", "/authenticator", "/authenticator/cancel"];
  it("opens every page once the administrative access is verified", () => {
    for (const page of [...adminPages, ...accountPages])
      expect(adminPageDecision("granted", page)).toBe("show");
  });
  it("sends an administrator still to verify to the verification, never to an Admin page", () => {
    for (const page of adminPages) expect(adminPageDecision("mfa", page)).toBe("/mfa");
    for (const page of accountPages) expect(adminPageDecision("mfa", page)).toBe("show");
  });
  it("keeps every Admin page out of reach without the permission, signed out or on failure", () => {
    for (const access of ["denied", "signed_out", "unavailable", "error"] as AdminAccess[]) {
      for (const page of adminPages) expect(adminPageDecision(access, page)).toBe("/");
      for (const page of accountPages) expect(adminPageDecision(access, page)).toBe("show");
    }
    for (const page of adminPages) expect(adminPageDecision("loading", page)).toBe("wait");
  });
  it("counts as signed in only a known session", () => {
    expect(
      (
        ["loading", "error", "unavailable", "signed_out", "denied", "mfa", "granted"] as const
      ).filter(isSignedIn),
    ).toEqual(["denied", "mfa", "granted"]);
  });
});
