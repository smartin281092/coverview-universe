import type { InsuranceCompanyId } from "@coverview/contracts";
import { normalizeDocumentSearch } from "./document.presentation.js";

// Names on a document are references, never proof of affiliation or permission.
const names: Record<InsuranceCompanyId, readonly string[]> = {
  allianz: ["allianz"],
  assura: ["assura"],
  automate: ["automate insurance", "automate sa", "automate.ch"],
  axa: ["axa", "winterthur"],
  baloise: ["baloise", "basler"],
  css: ["css"],
  generali: ["generali"],
  "groupe-mutuel": [
    "groupe mutuel",
    "mutuel assurance",
    "avenir assurance",
    "easy sana",
    "supra 1846",
    "philos assurance",
  ],
  helsana: ["helsana"],
  "liechtenstein-life": ["liechtenstein life", "liechtensteinlife"],
  tsm: ["tsm"],
};
export function referencedCompanyIds(texts: readonly string[]): InsuranceCompanyId[] {
  const text = ` ${normalizeDocumentSearch(texts.join("\n")).replace(/[^a-z0-9]+/g, " ")} `;
  return (Object.entries(names) as [InsuranceCompanyId, readonly string[]][])
    .filter(([, aliases]) =>
      aliases.some((alias) => text.includes(` ${alias.replace(/[^a-z0-9]+/g, " ")} `)),
    )
    .map(([id]) => id);
}
