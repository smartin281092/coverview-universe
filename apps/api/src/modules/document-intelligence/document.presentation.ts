import type { DocumentAnalysis, DocumentSummary } from "@coverview/contracts";

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

export function normalizeDocumentSearch(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("fr");
}

export function documentPresentation(row: {
  category: DocumentSummary["category"];
  categoryCorrected: boolean;
  analysis: Pick<DocumentAnalysis, "title" | "classification" | "pages"> | null;
}) {
  const heading = row.analysis?.pages[0]?.text
    .split(/\r?\n/u)
    .slice(0, 80)
    .map((line) => line.replace(/^[#*\s]+|[*\s]+$/gu, "").trim())
    .find(
      (line) =>
        line.length >= 5 &&
        line.length <= 140 &&
        /^(?:offre|proposition|police|contrat|certificat|attestation|procuration|mandat|facture|formulaire|demande|décompte|relevé|bulletin|carte d.identité|passeport)\b/iu.test(
          line,
        ),
    );
  const title = row.analysis?.title ?? heading ?? null;
  let classification: NonNullable<DocumentSummary["classification"]> =
    row.analysis?.classification ?? row.category;
  if (!row.analysis?.classification && title) {
    const text = normalizeDocumentSearch(title);
    if (/^procuration\b/u.test(text)) classification = "power_of_attorney";
    else if (/^mandat (?:de gestion|de courtage)\b/u.test(text))
      classification = "management_mandate";
    else if (row.category === "insurance" && /^(?:offre|proposition)\b/u.test(text))
      classification = "insurance_offer";
    else if (row.category === "insurance" && /^(?:contrat|police)\b/u.test(text))
      classification = "insurance_policy";
  }
  if (row.categoryCorrected) classification = row.category;
  return { title, classification };
}
