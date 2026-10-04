import { z } from "zod";

// The need categories of a Lead, repeated here because partner.ts imports this catalog (no cycle).
// Callers pass a Lead category: the typecheck fails if the two lists drift apart.
type LeadCategory = "health" | "vehicle" | "pension" | "household" | "legal" | "business" | "other";

// Normalized benefits (benefit-catalog-v1, brief III.8). Insurers name comparable benefits
// differently; a reviewed benefit keeps its own label, value, conditions and source, and is grouped
// under one of these categories for comparison. "higher"/"lower" say which structured amount is
// better; "coverage" compares inclusion only; "text" is never compared numerically.
export const benefitCatalogVersion = "benefit-catalog-v1";
export const benefitCategorySchema = z.enum([
  "deductible",
  "liability",
  "collision",
  "partial_casco",
  "glass",
  "theft",
  "natural_hazards",
  "marten",
  "parking",
  "assistance",
  "replacement_vehicle",
  "personal_effects",
  "occupants",
  "gross_negligence",
  "bonus_protection",
  "hospital",
  "alternative_medicine",
  "dental",
  "glasses",
  "abroad",
  "prevention",
  "transport_rescue",
  "daily_allowance",
  "contents",
  "water_damage",
  "legal_private",
  "legal_traffic",
  "legal_work",
  "legal_housing",
  "sum_insured",
  "waiting_period",
  "death",
  "disability",
  "premium_waiver",
  "guaranteed_capital",
  "business_interruption",
  "cyber",
  "fees",
  "exclusions",
  "other",
]);
export type BenefitCategory = z.infer<typeof benefitCategorySchema>;
export type BenefitMode = "coverage" | "higher" | "lower" | "text";

const all: LeadCategory[] = [
  "health",
  "vehicle",
  "pension",
  "household",
  "legal",
  "business",
  "other",
];
export const benefitCatalog: Record<BenefitCategory, { mode: BenefitMode; needs: LeadCategory[] }> =
  {
    deductible: { mode: "lower", needs: ["vehicle", "health", "household", "legal", "business"] },
    liability: { mode: "higher", needs: ["vehicle", "household", "business"] },
    collision: { mode: "coverage", needs: ["vehicle"] },
    partial_casco: { mode: "coverage", needs: ["vehicle"] },
    glass: { mode: "coverage", needs: ["vehicle", "household"] },
    theft: { mode: "higher", needs: ["vehicle", "household", "business"] },
    natural_hazards: { mode: "coverage", needs: ["vehicle", "household", "business"] },
    marten: { mode: "higher", needs: ["vehicle"] },
    parking: { mode: "higher", needs: ["vehicle"] },
    assistance: { mode: "coverage", needs: ["vehicle", "health"] },
    replacement_vehicle: { mode: "higher", needs: ["vehicle"] },
    personal_effects: { mode: "higher", needs: ["vehicle", "household"] },
    occupants: { mode: "higher", needs: ["vehicle"] },
    gross_negligence: { mode: "coverage", needs: ["vehicle", "household"] },
    bonus_protection: { mode: "coverage", needs: ["vehicle"] },
    hospital: { mode: "text", needs: ["health"] },
    alternative_medicine: { mode: "higher", needs: ["health"] },
    dental: { mode: "higher", needs: ["health"] },
    glasses: { mode: "higher", needs: ["health"] },
    abroad: { mode: "coverage", needs: ["health"] },
    prevention: { mode: "higher", needs: ["health"] },
    transport_rescue: { mode: "higher", needs: ["health"] },
    daily_allowance: { mode: "higher", needs: ["health", "business"] },
    contents: { mode: "higher", needs: ["household"] },
    water_damage: { mode: "coverage", needs: ["household", "business"] },
    legal_private: { mode: "coverage", needs: ["legal"] },
    legal_traffic: { mode: "coverage", needs: ["legal", "vehicle"] },
    legal_work: { mode: "coverage", needs: ["legal"] },
    legal_housing: { mode: "coverage", needs: ["legal"] },
    sum_insured: { mode: "higher", needs: ["legal", "household", "business", "other"] },
    waiting_period: { mode: "lower", needs: ["legal", "health", "pension"] },
    death: { mode: "higher", needs: ["pension"] },
    disability: { mode: "higher", needs: ["pension"] },
    premium_waiver: { mode: "coverage", needs: ["pension"] },
    guaranteed_capital: { mode: "higher", needs: ["pension"] },
    business_interruption: { mode: "coverage", needs: ["business"] },
    cyber: { mode: "coverage", needs: ["business", "household"] },
    fees: { mode: "lower", needs: all },
    exclusions: { mode: "text", needs: all },
    other: { mode: "text", needs: all },
  };

// Structured amount, only when the source states one. CHF in centimes, percent in hundredths of a
// percent, days as whole days. Two amounts compare only with the same unit and period.
export const benefitLimitSchema = z
  .object({
    value: z.number().int().nonnegative().max(100_000_000_000),
    unit: z.enum(["chf", "percent", "days"]),
    period: z.enum(["event", "day", "year", "total"]),
  })
  .strict();
export type BenefitLimit = z.infer<typeof benefitLimitSchema>;

// Keys used before the catalog. A feature without category is grouped through this table.
const legacy: Record<string, BenefitCategory> = {
  deductible: "deductible",
  collision: "collision",
  parking: "parking",
  assistance: "assistance",
  replacement_vehicle: "replacement_vehicle",
  hospitalization: "hospital",
  dental: "dental",
  death: "death",
  disability: "disability",
  fees: "fees",
  exclusions: "exclusions",
  other: "other",
};
export function benefitCategoryOf(feature: {
  key: string;
  category?: BenefitCategory | undefined;
}) {
  return feature.category ?? legacy[feature.key] ?? "other";
}

// Deterministic suggestion from the insurer's label; the reviewer confirms or corrects it. An
// ambiguous label (two categories match) suggests nothing.
const words: [BenefitCategory, RegExp][] = [
  ["replacement_vehicle", /(vehicule|voiture) de remplacement|ersatzfahrzeug|veicolo sostitutivo/u],
  ["parking", /parking|parcage|parkschaden|parcheggio/u],
  ["assistance", /assistance|depannage|mobilite|pannenhilfe|soccorso stradale/u],
  ["collision", /collision|casco complete|vollkasko|casco totale/u],
  ["partial_casco", /casco partielle|teilkasko|casco parziale/u],
  ["glass", /bris de glace|vitrage|glasbruch|rottura vetri/u],
  ["theft", /\bvol\b|diebstahl|furto/u],
  ["natural_hazards", /elements naturels|forces de la nature|elementar|forze della natura/u],
  ["marten", /fouine|marder|martora/u],
  ["personal_effects", /effets personnels|bagages|personliche gegenstande|effetti personali/u],
  ["occupants", /occupants|insassen|occupanti/u],
  ["gross_negligence", /faute grave|grobfahrlassig|colpa grave/u],
  ["bonus_protection", /protection du bonus|bonusschutz|protezione del bonus/u],
  ["deductible", /franchise|selbstbehalt|franchigia/u],
  ["liability", /responsabilite civile|\brc\b|haftpflicht|responsabilita civile/u],
  ["hospital", /hospitalisation|hopital|division (commune|semi-privee|privee)|spital|ospedal/u],
  [
    "alternative_medicine",
    /medecines? (complementaire|alternative|naturelle)|komplementar|medicina complementare/u,
  ],
  ["dental", /dentaire|dentist|zahn|dentale/u],
  ["glasses", /lunettes|lentilles|brille|occhiali/u],
  ["abroad", /etranger|voyage|ausland|estero/u],
  ["prevention", /prevention|fitness|pravention/u],
  ["transport_rescue", /transport|sauvetage|rettung|salvataggio/u],
  ["daily_allowance", /indemnite journaliere|taggeld|indennita giornaliera/u],
  ["contents", /mobilier|hausrat|economia domestica/u],
  ["water_damage", /degats d.eau|wasserschaden|danni causati dall.acqua/u],
  ["legal_traffic", /protection juridique.*(circulation|vehicule)|verkehrsrechtsschutz/u],
  ["legal_work", /protection juridique.*travail|arbeitsrechtsschutz/u],
  ["legal_housing", /protection juridique.*(logement|bail)|mietrechtsschutz/u],
  ["legal_private", /protection juridique privee|privatrechtsschutz|protezione giuridica privata/u],
  ["sum_insured", /somme d.assurance|versicherungssumme|somma assicurata/u],
  ["waiting_period", /delai d.attente|karenz|wartefrist|periodo di attesa/u],
  ["death", /deces|todesfall|decesso/u],
  ["disability", /incapacite|invalidite|erwerbsunfahigkeit|invalidita/u],
  ["premium_waiver", /liberation du paiement|pramienbefreiung|esonero dal pagamento/u],
  ["guaranteed_capital", /capital garanti|garantiertes kapital|capitale garantito/u],
  ["business_interruption", /perte d.exploitation|betriebsunterbruch|interruzione d.esercizio/u],
  ["cyber", /cyber/u],
  ["fees", /\bfrais\b|kosten|spese/u],
  ["exclusions", /exclusion|ausschluss|esclusion/u],
];
export function suggestBenefitCategory(label: string, need: LeadCategory): BenefitCategory | null {
  const text = label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const found = words
    .filter(
      ([category, pattern]) => benefitCatalog[category].needs.includes(need) && pattern.test(text),
    )
    .map(([category]) => category);
  return found.length === 1 ? found[0]! : null;
}
