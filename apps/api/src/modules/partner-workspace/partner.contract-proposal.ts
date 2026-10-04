import type { ContractCandidate, LeadDetail } from "@coverview/contracts/partner";

// Insurance domains a current contract may have for each need (brief III.7). Business and other
// needs have no reliable mapping: nothing is ever proposed for them.
const domains: Record<LeadDetail["category"], string[]> = {
  vehicle: ["motor"],
  health: ["health", "accident"],
  household: ["household", "personal_liability", "building"],
  legal: ["legal_protection"],
  pension: ["pension_3a", "pension_3b", "pension", "life"],
  business: [],
  other: [],
};
const letters = (value: string) =>
  value
    .normalize("NFKD")
    .toUpperCase()
    .replace(/[^A-Z0-9]/gu, "");
// Only a distinctive token identifies an object: a policy, plate or chassis number, at least five
// letters or digits including a digit. "Voiture" or a model name never does.
export const referenceToken = (value: string) => {
  const token = letters(value);
  return token.length >= 5 && /\d/u.test(token) ? token : null;
};

// The current contract is proposed only when exactly one policy of the exact profile, of a
// compatible domain, carries the same reference; the owner still confirms object and sharing.
export function proposeCurrentContract(
  category: LeadDetail["category"],
  objectReference: string,
  candidates: ContractCandidate[],
) {
  const compatible = candidates
    .filter((candidate) => {
      const domain = candidate.contract.domain ?? candidate.facts.domain;
      return !!domain && domains[category].includes(domain);
    })
    .map((candidate) => candidate.documentId);
  const token = referenceToken(objectReference);
  if (!token) return { compatible, proposal: null };
  const matches = candidates
    .filter((candidate) => compatible.includes(candidate.documentId))
    .flatMap((candidate): { documentId: string; reason: "policy_number" | "insured_object" }[] => {
      const policy = candidate.facts.policyNumber?.value ?? candidate.contract.policyNumber;
      if (policy && letters(policy) === token)
        return [{ documentId: candidate.documentId, reason: "policy_number" as const }];
      const subject = candidate.facts.insuredSubject?.value ?? candidate.contract.insuredSubject;
      return subject && letters(subject).includes(token)
        ? [{ documentId: candidate.documentId, reason: "insured_object" as const }]
        : [];
    });
  return { compatible, proposal: matches.length === 1 ? matches[0]! : null };
}
