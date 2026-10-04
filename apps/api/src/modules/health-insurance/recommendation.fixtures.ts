import {
  evidenceCatalogSchema,
  recommendationInputSchema,
  type EvidenceBenefit,
} from "@coverview/contracts/health-recommendation";
import type { HealthOffer } from "@coverview/contracts/health-insurance";
import { defaultRecommendationRules, type RecommendationContext } from "./recommendation.engine.js";
export const answer = (...values: string[]) => ({
  version: 2 as const,
  status: "answered" as const,
  values,
});
export function profile() {
  return recommendationInputSchema.parse({
    profileVersion: 1,
    tariff: {
      year: 2027,
      birthYear: 1990,
      accident: true,
      deductible: 300,
      regionId: "VD-1",
      municipalityId: 5586,
    },
    tariffKnown: { birth: true, locality: true },
    scope: "same_deductible",
    answers: {
      priority: answer("premium"),
      access: answer("any"),
      access_flex: answer("none"),
      obligations: answer("yes"),
      professionals: answer("none"),
    },
    optIn: true,
  });
}
export function offer(id: string, monthlyPremiumMinor = 10000, deductible = 300): HealthOffer {
  return {
    id,
    modelId: `model_${id}`,
    insurerId: id.charCodeAt(0),
    insurerName: `Fixture ${id}`,
    name: `Modèle fictif ${id}`,
    category: "PRAXIS",
    regionId: "VD-1",
    monthlyPremiumMinor,
    deductible,
    accident: true,
    ageGroup: "adult",
    restricted: false,
    eligibility: "region",
  };
}
export function context(offers = [offer("a"), offer("b", 11000)]): RecommendationContext {
  const catalog = evidenceCatalogSchema.parse({
    id: "catalog_fixture",
    year: 2027,
    datasetId: "dataset_fixture",
    checkedAt: "2026-10-01",
    insurers: offers.map((row) => ({
      id: row.insurerId,
      legalName: row.insurerName,
      brand: row.insurerName,
      groupName: null,
      aliases: [],
    })),
    models: offers.map((row) => ({
      id: row.modelId,
      insurerId: row.insurerId,
      insurerName: row.insurerName,
      name: row.name,
      tariffCode: row.id,
      year: 2027,
      category: row.category,
      regions: ["VD-1"],
      status: "verified",
      sourceIds: ["source_fixture"],
      confirmed: "Fixture, données synthétiques",
      missing: "",
      access: {
        contacts: ["gp"],
        multipleEntry: false,
        mandatory: true,
        verifiedYear: true,
        obligations: "Médecin en premier",
        networkUrl: null,
      },
    })),
    benefits: [],
    sources: [
      {
        id: "source_fixture",
        url: "https://example.org/fictional-2027",
        title: "Preuve fictive réservée aux tests",
        passage: "Conditions synthétiques 2027",
        page: 1,
        checkedAt: "2026-10-01",
        quality: "contract",
        yearExplicit: true,
      },
    ],
    cases: [],
  });
  return {
    offers,
    catalog,
    rules: structuredClone(defaultRecommendationRules),
    rulesVersion: "fixture-v1",
  };
}
export function benefit(
  modelId: string,
  overrides: Partial<EvidenceBenefit> = {},
): EvidenceBenefit {
  return {
    id: "benefit_fixture",
    insurerId: 98,
    modelIds: [modelId],
    year: 2027,
    title: "Service fictif",
    equivalenceGroup: "fictional_service",
    classification: "base_service",
    category: "prevention",
    effect: "Service de test",
    conditions: "Conditions vérifiées dans la fixture",
    exclusions: "Aucun achat supplémentaire",
    activation: "Activation prévue",
    geography: ["VD-1"],
    beneficiary: "person",
    frequency: null,
    capMinor: null,
    extraCostMinor: 0,
    validFrom: "2027-01-01",
    validUntil: "2027-12-31",
    yearConfirmed: true,
    requiresSameBase: true,
    requiresSupplementary: false,
    supplementaryProducts: [],
    verification: "verified",
    sourceIds: ["source_fixture"],
    operatorCaseIds: [],
    financial: { kind: "none" },
    utility: "services",
    telemedicine: "not_applicable",
    ...overrides,
  };
}
