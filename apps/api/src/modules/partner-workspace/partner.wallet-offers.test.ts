import { expect, it } from "vitest";
import { PartnerError } from "./partner.policy.js";
import { retryConflicts } from "./partner.wallet-offers.js";

it("retries a read aborted by a serialization conflict, and nothing else", async () => {
  let calls = 0;
  const flaky = () => {
    calls += 1;
    return calls < 3
      ? Promise.reject(new PartnerError("PARTNER_CONFLICT", 409))
      : Promise.resolve("offers");
  };
  await expect(retryConflicts(flaky)).resolves.toBe("offers");
  expect(calls).toBe(3);

  // Other failures surface at once; a conflict that persists surfaces after the last attempt.
  let denied = 0;
  await expect(
    retryConflicts(() => {
      denied += 1;
      return Promise.reject(new PartnerError("PARTNER_ACCESS_DENIED", 403));
    }),
  ).rejects.toMatchObject({ statusCode: 403 });
  expect(denied).toBe(1);
  let conflicts = 0;
  await expect(
    retryConflicts(() => {
      conflicts += 1;
      return Promise.reject(new PartnerError("PARTNER_CONFLICT", 409));
    }),
  ).rejects.toMatchObject({ statusCode: 409 });
  expect(conflicts).toBe(3);
});
