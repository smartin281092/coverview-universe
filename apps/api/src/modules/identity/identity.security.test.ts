import { describe, expect, it } from "vitest";
import { IdentityError, identityFailureDiagnostic } from "./identity.security.js";

describe("callback diagnostic confidentiality", () => {
  it("retains only controlled diagnostic fields and never serializes an upstream cause", () => {
    const upstream = Object.assign(new Error("private provider response"), {
      status: 401,
      accessToken: "private token",
      email: "private@example.test",
    });
    const error = new IdentityError("IDENTITY_UNAVAILABLE", 503, {
      cause: upstream,
      diagnostic: Object.assign(identityFailureDiagnostic(upstream, "code_exchange"), {
        accessToken: upstream.accessToken,
        email: upstream.email,
      }),
    });
    expect(error.cause).toBe(upstream);
    expect(identityFailureDiagnostic(error, "persistence")).toEqual({
      stage: "code_exchange",
      reason: "operation_failed",
      providerStatus: 401,
    });
  });

  it("rejects arbitrary diagnostic strings and status values instead of logging them", () => {
    const error = new IdentityError("IDENTITY_UNAVAILABLE", 503);
    Object.assign(error, {
      diagnostic: { stage: "private token", reason: "private@example.test" },
      status: "private status",
    });
    expect(identityFailureDiagnostic(error, "persistence")).toEqual({
      stage: "persistence",
      reason: "operation_failed",
    });
  });
});
