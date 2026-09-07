import type { DocumentAnalysis, DocumentSummary } from "@coverview/contracts";
import { companyLabels } from "./document.companies.js";
import { insuranceDomainLabels, insuranceFacts } from "./document.insurance.js";
import { normalizeDocumentSearch } from "./document.search.js";
export { normalizeDocumentSearch } from "./document.search.js";

export const classificationLabels = {
  identity: "Pièce d’identité",
  insurance: "Document d’assurance",
  insurance_offer: "Offre d’assurance",
  insurance_policy: "Contrat d’assurance",
  pension: "Prévoyance et retraite",
  invoice: "Facture",
  correspondence: "Courrier",
  power_of_attorney: "Procuration",
  management_mandate: "Mandat de gestion",
  unknown: "Document à classer",
} as const;

export function documentPresentation(row: {
  category: DocumentSummary["category"];
  categoryCorrected: boolean;
  analysis: Pick<DocumentAnalysis, "title" | "classification" | "pages" | "insurance"> | null;
}) {
  const heading = row.analysis?.pages[0]?.text
    .slice(0, 12000)
    .split(/\r?\n/u)
    .slice(0, 80)
    .map((line) => line.replace(/^[#*\s]+|[*\s]+$/gu, "").trim())
    .find(
      (line) =>
        line.length >= 5 &&
        line.length <= 140 &&
        !/^(?:offre valable|(?:police|contrat|demande)\s*(?:n[°ºo]|numéro|:))/iu.test(line) &&
        /^(?:modèle d.offre|profil d.investisseur|questionnaire|offre|proposition|police|contrat|certificat|attestation|procuration|mandat|facture|formulaire|demande|décompte|relevé|bulletin|carte d.identité|passeport)\b/iu.test(
          line,
        ),
    );
  let title = row.analysis?.title ?? heading ?? null;
  let classification: NonNullable<DocumentSummary["classification"]> =
    row.analysis?.classification ?? row.category;
  if (!row.analysis?.classification && title) {
    const text = normalizeDocumentSearch(title);
    if (/^procuration\b/u.test(text)) classification = "power_of_attorney";
    else if (/^mandat (?:de gestion|de courtage)\b/u.test(text))
      classification = "management_mandate";
    else if (row.category === "insurance" && /^(?:modele d.offre|offre|proposition)\b/u.test(text))
      classification = "insurance_offer";
    else if (row.category === "insurance" && /^(?:contrat|police)\b/u.test(text))
      classification = "insurance_policy";
  }
  if (row.categoryCorrected) classification = row.category;
  const facts = insuranceFacts(row.analysis);
  if (
    facts.companyId &&
    ["insurance", "pension", "invoice", "correspondence"].includes(row.category)
  ) {
    const purpose =
      classification === "insurance_offer"
        ? "Offre"
        : classification === "insurance_policy"
          ? "Contrat"
          : (title ?? classificationLabels[classification]);
    title = [
      facts.domain ? insuranceDomainLabels[facts.domain] : null,
      companyLabels[facts.companyId],
      purpose,
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 140);
  }
  return { title, classification, companyId: facts.companyId, insuranceDomain: facts.domain };
}
