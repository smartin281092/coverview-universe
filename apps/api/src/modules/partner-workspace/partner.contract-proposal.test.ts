import { describe, expect, it } from "vitest";
import type { ContractCandidate } from "@coverview/contracts/partner";
import { proposeCurrentContract, referenceToken } from "./partner.contract-proposal.js";

// Only the fields read by the proposal: the document projection carries many others.
const candidate = (
  documentId: string,
  domain: string | null,
  policyNumber: string | null,
  insuredSubject: string | null,
) =>
  ({
    documentId,
    contract: { domain, policyNumber, insuredSubject, title: "Police" },
    facts: {
      domain,
      policyNumber: policyNumber ? { value: policyNumber } : null,
      insuredSubject: insuredSubject ? { value: insuredSubject } : null,
    },
  }) as unknown as ContractCandidate;

describe("current contract proposal", () => {
  it("keeps only distinctive references", () => {
    expect(referenceToken("pol. 12-34-56")).toBe("POL123456");
    expect(referenceToken("GE 123")).toBe("GE123");
    expect(referenceToken("Voiture")).toBeNull();
    expect(referenceToken("1234")).toBeNull();
  });

  it("proposes the single compatible policy carrying the reference", () => {
    const items = [
      candidate("motor-a", "motor", "POL-123456", "Tesla Model Y, GE 123456"),
      candidate("motor-b", "motor", "POL-999999", "Fiat 500, VD 777"),
      candidate("home", "household", "POL-123456", "Ménage"),
    ];
    expect(proposeCurrentContract("vehicle", "pol 123456", items)).toEqual({
      compatible: ["motor-a", "motor-b"],
      proposal: { documentId: "motor-a", reason: "policy_number" },
    });
    expect(proposeCurrentContract("vehicle", "GE 123456", items).proposal).toEqual({
      documentId: "motor-a",
      reason: "insured_object",
    });
    // A household policy with the same number never answers a vehicle need.
    expect(proposeCurrentContract("household", "POL-123456", items).proposal).toEqual({
      documentId: "home",
      reason: "policy_number",
    });
  });

  it("proposes nothing on a generic, ambiguous or unmapped reference", () => {
    const items = [
      candidate("motor-a", "motor", "POL-123456", "Voiture 1"),
      candidate("motor-b", "motor", "POL-1234567", "Voiture 2"),
    ];
    expect(proposeCurrentContract("vehicle", "Voiture", items).proposal).toBeNull();
    expect(proposeCurrentContract("vehicle", "", items).proposal).toBeNull();
    // Both subjects contain no token, but both policy numbers start with it: no exact single match.
    expect(proposeCurrentContract("vehicle", "POL-12345", items).proposal).toBeNull();
    expect(proposeCurrentContract("business", "POL-123456", items)).toEqual({
      compatible: [],
      proposal: null,
    });
  });
});
