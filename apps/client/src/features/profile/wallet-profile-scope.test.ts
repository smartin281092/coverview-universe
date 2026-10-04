import { describe, expect, it } from "vitest";
import { retainWalletProfileScope, walletProfileScope } from "./wallet-profile-scope";

const child = "prf_11111111-1111-4111-8111-111111111111";
describe("Wallet profile navigation", () => {
  it("consolidates by default and preserves the selected profile across pages", () => {
    expect(walletProfileScope({})).toBe("all");
    expect(retainWalletProfileScope({ profile: child }, { tab: "documents" })).toEqual({
      profile: child,
      tab: "documents",
    });
  });
  it("honors existing deep links and carries their subject to the next page", () => {
    expect(walletProfileScope({ profile: "all", person: child })).toBe(child);
    expect(retainWalletProfileScope({ person: child }, {})).toEqual({ profile: child });
  });
  it("allows explicit selection of all profiles or the account holder", () => {
    expect(retainWalletProfileScope({ profile: child }, { profile: "all" }).profile).toBe("all");
    expect(retainWalletProfileScope({ profile: child }, { person: "self" }).profile).toBe("self");
  });
  it("never uses malformed input as a profile identifier", () => {
    expect(walletProfileScope({ profile: "someone-else", person: "bad" })).toBe("all");
  });
  it("keeps the account holder as the subject of an authentication continuation", () => {
    expect(retainWalletProfileScope({ continue: "1" }, { continue: "1" }).profile).toBe("self");
    expect(walletProfileScope({ view: "choices" })).toBe("self");
    expect(walletProfileScope({ profile: child, continue: "1" })).toBe(child);
  });
});
