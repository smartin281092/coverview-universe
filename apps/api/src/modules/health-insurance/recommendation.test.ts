import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  evidenceCatalogSchema,
  recommendationInputSchema,
} from "@coverview/contracts/health-recommendation";
import { recommend } from "./recommendation.engine.js";
import { validateCatalog } from "./recommendation.repository.js";
import { financialScenario } from "./recommendation.cost.js";
import {
  answer,
  profile,
  offer,
  context,
  benefit,
  benefitType,
} from "./recommendation.fixtures.js";
describe("adaptive recommendation acceptance", () => {
  it("reuses the birth date and region already supplied without a tariff confirmation", () => {
    const input = profile();
    input.tariffKnown = { birth: true, locality: false, region: true };
    const result = recommend(input, context());
    expect(result.nextQuestion?.id).not.toBe("tariff");
    expect(result.questionStates.find((q) => q.id === "tariff")).toMatchObject({
      responseStatus: "answered",
      display: "inactive",
    });
    input.tariffKnown.birth = false;
    expect(recommend(input, context()).nextQuestion?.id).toBe("tariff");
  });
  it("inactivates sex-specific questions and answers without changing the premium or losing answers", () => {
    const input = profile(),
      ctx = context();
    ctx.catalog.benefits = [
      benefit("model_b", {
        questionAudience: "female",
        financial: {
          kind: "eligible_care_waiver",
          deductible: true,
          copay: true,
          careGroup: "care_fixture",
        },
      }),
    ];
    input.answers.priority = answer("annual");
    input.answers.care = answer("1500");
    input.answers.prevention = answer("screening");
    input.answers["usage:benefit_fixture"] = answer("planned");
    input.answers["eligible:benefit_fixture"] = answer("yes");
    input.answers["caregroup:care_fixture"] = { ...answer("exact"), amountMinor: 150000 };
    input.sex = "female";
    expect(recommend(input, ctx).leaders.preferred).toEqual(["b"]);
    input.sex = "male";
    const male = recommend(input, ctx);
    expect(male.leaders.preferred).toEqual(["a"]);
    expect(male.questionStates.find((q) => q.id === "usage:benefit_fixture")?.display).toBe(
      "inactive",
    );
    expect(male.nextQuestion?.id ?? "").not.toContain("benefit_fixture");
    expect(input.answers["usage:benefit_fixture"]?.values).toEqual(["planned"]);
    expect(ctx.offers.map((o) => o.monthlyPremiumMinor)).toEqual([10000, 11000]);
    input.sex = "female";
    expect(recommend(input, ctx).leaders.preferred).toEqual(["b"]);
  });
  it("joint non-monetary services are considered when each isolated answer would leave the leader unchanged", () => {
    const input = profile(),
      ctx = context();
    input.answers.priority = answer("balance");
    input.answers.care = answer("0");
    input.answers.extra_cost = { ...answer("exact"), amountMinor: 10000 };
    ctx.offers[0]!.category = "BASE";
    ctx.catalog.benefits = Array.from({ length: 3 }, (_, i) =>
      benefit("model_b", { id: `group_benefit_${i}`, equivalenceGroup: `service_${i}` }),
    );
    const result = recommend(input, ctx);
    expect(result.leaders.preferred).toEqual(["a"]);
    expect(result.nextQuestion?.reason).toBe("dependent_benefit");
    expect(result.nextQuestion?.sensitivity.changesLeader).toBe(true);
  });
  it("planned care missing from the estimate replaces the total and never adds a forfait", () => {
    const input = profile();
    input.answers.priority = answer("annual");
    input.answers.care = { ...answer("300"), confirmedAtVersion: 2 };
    input.answers.treatment = { ...answer("planned"), confirmedAtVersion: 3 };
    input.answers.treatment_included = { ...answer("no"), confirmedAtVersion: 4 };
    let result = recommend(input, context());
    expect(result.ranked[0]?.annualInsuranceCareMinor).toBeNull();
    expect(result.nextQuestion?.id).toBe("care_revised");
    input.answers.care_revised = { ...answer("1500"), confirmedAtVersion: 5 };
    result = recommend(input, context());
    expect(result.ranked[0]?.costShareMinor).toBe(42000);
    expect(result.ranked[0]?.costScenarios[0]?.careMinor).toBe(150000);
    input.answers.treatment.confirmedAtVersion = 6;
    expect(recommend(input, context()).nextQuestion?.id).toBe("care_revised");
    input.answers.treatment = answer("none");
    expect(recommend(input, context()).ranked[0]?.costScenarios[0]?.careMinor).toBe(30000);
  });
  it("removing a benefit preference preserves dependent answers but removes their effect", () => {
    const input = profile(),
      ctx = context();
    ctx.catalog.benefits = [
      benefit("model_b", {
        financial: {
          kind: "eligible_care_waiver",
          deductible: true,
          copay: true,
          careGroup: "care_fixture",
        },
      }),
    ];
    input.answers.priority = answer("annual");
    input.answers.care = answer("1500");
    input.answers.prevention = answer("screening");
    input.answers["usage:benefit_fixture"] = answer("planned");
    input.answers["eligible:benefit_fixture"] = answer("yes");
    input.answers["caregroup:care_fixture"] = { ...answer("exact"), amountMinor: 150000 };
    expect(recommend(input, ctx).leaders.preferred).toEqual(["b"]);
    input.answers.prevention = answer("none");
    const result = recommend(input, ctx);
    expect(result.leaders.preferred).toEqual(["a"]);
    expect(result.questionStates.find((q) => q.id === "usage:benefit_fixture")?.display).toBe(
      "inactive",
    );
    expect(input.answers["usage:benefit_fixture"]?.values).toEqual(["planned"]);
  });
  it("common vaccine deductible exemption is never counted again as a model saving", () => {
    const input = profile();
    input.answers["caregroup:opas12a_vaccination"] = { ...answer("exact"), amountMinor: 30000 };
    input.answers["eligible:benefit_fixture"] = answer("yes");
    const fact = benefit("model_b", {
      financial: {
        kind: "eligible_care_waiver",
        deductible: true,
        copay: true,
        careGroup: "opas12a_vaccination",
      },
    });
    expect(financialScenario(10000, 2500, 30000, false, [], input)?.costShareMinor).toBe(3000);
    expect(financialScenario(10000, 2500, 30000, false, [fact], input)?.costShareMinor).toBe(0);
    expect(financialScenario(10000, 2500, 1030000, false, [fact], input)?.costShareMinor).toBe(
      financialScenario(10000, 2500, 1030000, false, [], input)?.costShareMinor,
    );
  });
  it("1 short premium journey reuses zero-care and asks no comfort questions", () => {
    const input = profile();
    input.answers.care = answer("0");
    const result = recommend(input, context());
    expect(result.outcome).toBe("established");
    expect(result.nextQuestion).toBeNull();
    expect(result.leaders.premium).toEqual(result.leaders.preferred);
  });
  it("2 low reserve warns without excluding the cheapest high deductible", () => {
    const input = profile();
    input.scope = "optimize_deductible";
    input.answers.reserve = answer("below500");
    const result = recommend(input, context([offer("a", 10000, 2500), offer("b", 12000, 300)]));
    expect(result.ranked[0]?.offer.id).toBe("a");
    expect(result.ranked[0]?.affordability).toBe("insufficient");
    expect(result.ranked[0]?.reasons).toContain("ordinary_reserve_shortfall");
  });
  it("3 essential incompatible doctor cannot be offset by benefits", () => {
    const input = profile(),
      ctx = context();
    input.answers.professionals = answer("gp");
    input.answers["importance:gp"] = answer("required");
    input.answers["professional:gp"] = answer("official_123");
    ctx.catalog.models[0]!.access.professionalAdmission.official_123 = "incompatible";
    ctx.catalog.models[1]!.access.professionalAdmission.official_123 = "compatible";
    const result = recommend(input, ctx);
    expect(result.leaders.preferred).toEqual(["b"]);
    expect(result.ranked.find((row) => row.offer.id === "a")?.compatibility).toBe("incompatible");
  });
  it("4 unknown network remains verify and exposes operator control", () => {
    const input = profile(),
      ctx = context();
    ctx.catalog.models[0]!.access.verifiedYear = false;
    ctx.catalog.cases.push({
      id: "review_network",
      insurerId: 97,
      insurerName: "Fixture a",
      modelIds: ["model_a"],
      modelNames: ["Modèle fictif a"],
      year: 2027,
      regions: ["VD-1"],
      rule: "Réseau",
      confirmed: "",
      missing: "Réseau2027",
      sourceIds: ["source_fixture"],
      impact: "compatibilité",
      provisionalTreatment: "verify",
      question: "Quel réseau ?",
      action: "Vérifier",
      priority: "blocking",
      status: "open",
      owner: null,
      revision: 0,
      history: [],
    });
    const result = recommend(input, ctx);
    expect(result.outcome).toBe("provisional");
    expect(result.ranked[0]?.operatorCaseIds).toContain("review_network");
  });
  it("5 answer without effect recalculates without artificial reordering", () => {
    const input = profile(),
      ctx = context(),
      before = recommend(input, ctx);
    input.profileVersion++;
    input.answers.subsidy = answer("already");
    const after = recommend(input, ctx);
    expect(after.ranked).toEqual(before.ranked);
    expect(after.profileVersion).toBe(2);
  });
  it("6 changing the goal reactivates useful branches without repeating valid answers", () => {
    const input = profile(),
      ctx = context();
    expect(recommend(input, ctx).nextQuestion).toBeNull();
    input.answers.priority = answer("annual");
    expect(recommend(input, ctx).nextQuestion?.id).toBe("care");
    input.answers.care = answer("0");
    expect(recommend(input, ctx).nextQuestion?.id).not.toBe("access");
  });
  it("8 absent benefits never create an automatic benefit question", () => {
    const input = profile();
    input.answers.priority = answer("annual");
    input.answers.care = answer("4000");
    expect(recommend(input, context()).nextQuestion).toBeNull();
  });
  it("9 dependent medical allocation detects an initially more expensive candidate", () => {
    const input = profile(),
      ctx = context([offer("a"), offer("b", 10500)]);
    input.answers.priority = answer("annual");
    input.answers.care = answer("1500");
    ctx.catalog.benefits = [
      benefit("model_b", {
        utility: "none",
        financial: {
          kind: "eligible_care_waiver",
          deductible: true,
          copay: true,
          careGroup: "testcare",
        },
      }),
    ];
    const result = recommend(input, ctx);
    expect(result.outcome).toBe("continue");
    expect(result.nextQuestion?.reason).toBe("dependent_benefit");
    input.answers.prevention = answer("screening");
    input.answers["usage:benefit_fixture"] = answer("planned");
    input.answers["existing:benefit_fixture"] = answer("no");
    input.answers["eligible:benefit_fixture"] = answer("yes");
    expect(recommend(input, ctx).nextQuestion?.id).toBe("caregroup:testcare");
    input.answers["caregroup:testcare"] = { ...answer("exact"), amountMinor: 150000 };
    expect(recommend(input, ctx).leaders.preferred).toEqual(["b"]);
  });
  it("10 deductible-only telemedicine retains applicable copay", () => {
    const input = profile();
    input.answers["eligible:benefit_fixture"] = answer("yes");
    input.answers["caregroup:telemedicine"] = { ...answer("exact"), amountMinor: 100000 };
    const fact = benefit("model_b", {
      telemedicine: "deductible_only",
      financial: {
        kind: "eligible_care_waiver",
        deductible: true,
        copay: false,
        careGroup: "telemedicine",
      },
    });
    expect(financialScenario(10000, 300, 100000, false, [fact], input)?.costShareMinor).toBe(10000);
  });
  it("11 supplementary conditions cannot produce a certain benefit when absent or unknown", () => {
    const input = profile(),
      ctx = context();
    input.answers.priority = answer("balance");
    input.answers.care = answer("0");
    input.answers.lifestyle = answer("fitness");
    input.answers["usage:benefit_fixture"] = answer("planned");
    input.answers["eligible:benefit_fixture"] = answer("yes");
    ctx.catalog.benefits = [benefit("model_b", { requiresSupplementary: true })];
    let result = recommend(input, ctx);
    expect(result.ranked.find((row) => row.offer.id === "b")?.benefits[0]?.status).toBe(
      "conditional",
    );
    input.answers.supplementary = answer("none");
    result = recommend(input, ctx);
    expect(result.ranked.find((row) => row.offer.id === "b")?.benefits[0]?.status).toBe(
      "ineligible",
    );
  });
  it("12 benefit retained independently gives no differential utility", () => {
    const input = profile(),
      ctx = context();
    input.answers.priority = answer("balance");
    input.answers.care = answer("0");
    input.answers.lifestyle = answer("fitness");
    input.answers["usage:benefit_fixture"] = answer("planned");
    input.answers["existing:benefit_fixture"] = answer("yes");
    input.answers["eligible:benefit_fixture"] = answer("yes");
    ctx.catalog.benefits = [benefit("model_b")];
    expect(recommend(input, ctx).ranked.find((row) => row.offer.id === "b")?.utility.services).toBe(
      0,
    );
  });
  it.each([
    [0, 2500, false, 0],
    [29900, 300, false, 29900],
    [30000, 300, false, 30000],
    [200000, 300, false, 47000],
    [730000, 300, false, 100000],
    [950000, 2500, false, 320000],
    [350000, 0, true, 35000],
    [410000, 600, true, 95000],
  ])("13 financial threshold %s", (care, deductible, child, expected) => {
    expect(
      financialScenario(10000, Number(deductible), Number(care), Boolean(child), [], profile())
        ?.costShareMinor,
    ).toBe(expected);
  });
  it("13 combined caps and equivalent waivers do not subtract maxima twice", () => {
    const input = profile();
    input.answers["eligible:benefit_fixture"] = answer("yes");
    const cap = benefit("model_b", { financial: { kind: "copay_cap", capMinor: 30000 } });
    expect(financialScenario(10000, 300, 100000, false, [cap, cap], input)?.costShareMinor).toBe(
      37000,
    );
    expect(financialScenario(10000, 300, 1000000, false, [cap, cap], input)?.costShareMinor).toBe(
      60000,
    );
  });
  it("14 skipped unknown declined and negative remain distinct", () => {
    const input = profile();
    input.answers.prevention = { version: 2, status: "declined", values: [] };
    input.answers.medication = { version: 2, status: "skipped", values: [] };
    input.answers.supplementary = { version: 2, status: "unknown", values: [] };
    input.answers.lifestyle = answer("none");
    const states = recommend(input, context()).questionStates;
    expect(states.find((q) => q.id === "prevention")?.responseStatus).toBe("declined");
    expect(states.find((q) => q.id === "medication")?.responseStatus).toBe("skipped");
    expect(states.find((q) => q.id === "supplementary")?.responseStatus).toBe("unknown");
    expect(states.find((q) => q.id === "lifestyle")?.responseStatus).toBe("answered");
  });
  it("15 unrelated candidate does not renormalize utility", () => {
    const input = profile(),
      ctx = context();
    input.answers.priority = answer("freedom");
    input.answers.care = answer("0");
    const before = recommend(input, ctx).ranked[0]!.utility;
    const other = context([offer("c", 99000)]);
    ctx.offers.push(...other.offers);
    ctx.catalog.models.push(...other.catalog.models);
    expect(recommend(input, ctx).ranked.find((row) => row.offer.id === "a")?.utility).toEqual(
      before,
    );
  });
  it("16 contradictory sources remain operator matters, never eligibility questions", () => {
    const input = profile(),
      ctx = context();
    input.answers.priority = answer("annual");
    input.answers.care = answer("4000");
    ctx.catalog.benefits = [benefit("model_b", { verification: "contradictory" })];
    expect(recommend(input, ctx).nextQuestion).toBeNull();
    expect(
      recommend(input, ctx).ranked.find((row) => row.offer.id === "b")?.benefits[0]
        ?.certainSavingMinor,
    ).toBe(0);
  });
  it("17 mismatched model years cannot be published or add utility", () => {
    const input = profile(),
      ctx = context();
    ctx.catalog.models[0]!.year = 2026;
    input.answers.access_preference = answer("gp");
    expect(() => validateCatalog(ctx.catalog)).toThrow();
    expect(
      recommend(input, ctx).ranked.find((row) => row.offer.id === "a")?.utility.practical,
    ).toBe(0);
  });
  it("19 notes are rejected by the strict server input contract", () => {
    expect(
      recommendationInputSchema.safeParse({ ...profile(), notes: "private medical text" }).success,
    ).toBe(false);
  });
  it("20 distinguishes established, tradeoff and source verification outcomes", () => {
    const input = profile(),
      ctx = context();
    expect(recommend(input, ctx).outcome).toBe("established");
    input.answers.priority = answer("balance");
    input.answers.care = answer("0");
    ctx.offers[1]!.category = "BASE";
    input.answers.extra_cost = { version: 2, status: "unknown", values: [] };
    expect(recommend(input, ctx).outcome).toBe("tradeoff");
    ctx.catalog.models[0]!.access.verifiedYear = false;
    input.answers.priority = answer("premium");
    expect(recommend(input, ctx).outcome).toBe("provisional");
  });
  it("retains benefit answers inactive after the geographic catalogue changes", () => {
    const input = profile();
    input.answers.lifestyle = answer("fitness");
    expect(() => recommend(input, context())).not.toThrow();
  });
  it("supports more than 100 generated questions without dropping candidates", () => {
    const ctx = context();
    ctx.catalog.benefits = Array.from({ length: 30 }, (_, i) =>
      benefit("model_b", { id: `benefit_${i}`, equivalenceGroup: `group_${i}` }),
    );
    expect(recommend(profile(), ctx).questionStates.length).toBeGreaterThan(100);
  });
  it("unknown choice never means an incompatible care channel", () => {
    const input = profile();
    input.answers.access = answer("unknown");
    expect(recommend(input, context()).ranked.every((row) => row.compatibility === "verify")).toBe(
      true,
    );
  });
  it("zero-effect waiver has zero effect", () => {
    const input = profile();
    input.answers["eligible:benefit_fixture"] = answer("yes");
    input.answers["caregroup:empty"] = { ...answer("exact"), amountMinor: 20000 };
    expect(
      financialScenario(
        10000,
        300,
        20000,
        false,
        [
          benefit("model_b", {
            financial: {
              kind: "eligible_care_waiver",
              deductible: false,
              copay: false,
              careGroup: "empty",
            },
          }),
        ],
        input,
      )?.costShareMinor,
    ).toBe(20000);
  });
  it("a dominated offer does not require a monetary tradeoff", () => {
    const input = profile(),
      ctx = context();
    input.answers.priority = answer("balance");
    input.answers.care = answer("0");
    ctx.offers[0]!.category = "BASE";
    expect(recommend(input, ctx).nextQuestion).toBeNull();
  });
  it("budget and leader are checked across separate nonlinear cost scenarios", () => {
    const input = profile(),
      ctx = context([offer("a", 15000, 2500), offer("b", 10000, 300)]);
    ctx.offers[0]!.category = "BASE";
    input.answers.priority = answer("balance");
    input.answers.care = { ...answer("exact"), amountMinor: 0, upperMinor: 1000000 };
    input.answers.extra_cost = { ...answer("exact"), amountMinor: 10000 };
    expect(recommend(input, ctx).outcome).toBe("tradeoff");
    expect(recommend(input, ctx).leaders.preferred).toEqual(expect.arrayContaining(["a", "b"]));
  });
  it("counts a preferred benefit type once whatever the insurer's synonyms", () => {
    const input = profile(),
      ctx = context();
    ctx.catalog.benefitTypes = [benefitType("remote_care", { family: "telemedicine" })];
    ctx.catalog.benefits = ["Téléconsultation A", "Médecin vidéo B"].map((title, index) =>
      benefit("model_b", {
        id: `synonym_${index}`,
        title,
        equivalenceGroup: "remote_care",
        category: "telemedicine",
      }),
    );
    input.answers.priority = answer("balance");
    input.answers.care = answer("0");
    input.answers.benefit_types = answer("remote_care");
    const row = recommend(input, ctx).ranked.find((value) => value.offer.id === "b")!;
    expect(row.utility.services).toBeCloseTo(35 / 3);
    expect(row.preferredBenefits).toEqual([
      { type: "remote_care", status: "counted", benefitIds: ["synonym_0", "synonym_1"] },
    ]);
  });
  it("asks the benefit type question with offered types only and lets it change the balance leader", () => {
    const input = profile(),
      ctx = context();
    ctx.catalog.benefitTypes = [benefitType("coaching"), benefitType("unused_type")];
    ctx.catalog.benefits = [benefit("model_b", { equivalenceGroup: "coaching" })];
    input.answers.priority = answer("balance");
    input.answers.care = answer("0");
    input.answers.extra_cost = { ...answer("exact"), amountMinor: 10000 };
    let result = recommend(input, ctx);
    expect(result.leaders.preferred).toEqual(["a"]);
    expect(result.nextQuestion?.id).toBe("benefit_types");
    expect(result.nextQuestion?.reason).toBe("dependent_benefit");
    expect(result.nextQuestion?.options.map((option) => option.value)).toEqual([
      "coaching",
      "none",
      "unknown",
    ]);
    expect(result.questionStates.some((state) => state.id === "lifestyle")).toBe(false);
    input.answers.benefit_types = answer("coaching");
    result = recommend(input, ctx);
    expect(result.leaders.preferred).toEqual(["b"]);
    expect(result.outcome).toBe("established");
    input.answers.priority = answer("premium");
    result = recommend(input, ctx);
    expect(result.ranked.every((row) => row.utility.services === 0)).toBe(true);
    expect(result.questionStates.find((state) => state.id === "benefit_types")?.display).toBe(
      "inactive",
    );
  });
  it("does not ask about a benefit type that cannot change the current leader", () => {
    const input = profile(),
      ctx = context();
    ctx.catalog.benefitTypes = [benefitType("coaching")];
    ctx.catalog.benefits = [benefit("model_a", { equivalenceGroup: "coaching", insurerId: 97 })];
    input.answers.priority = answer("balance");
    input.answers.care = answer("0");
    input.answers.extra_cost = { ...answer("exact"), amountMinor: 10000 };
    const result = recommend(input, ctx);
    expect(result.leaders.preferred).toEqual(["a"]);
    expect(result.nextQuestion?.id).not.toBe("benefit_types");
    expect(result.questionStates.find((state) => state.id === "benefit_types")?.display).toBe(
      "available",
    );
  });
  it("keeps announced services provisional only when they decide the leader", () => {
    const input = profile(),
      ctx = context();
    const announced = {
      equivalenceGroup: "coaching",
      yearConfirmed: false,
      verification: "partial" as const,
      validFrom: null,
      validUntil: null,
    };
    ctx.catalog.benefitTypes = [benefitType("coaching")];
    ctx.catalog.benefits = [benefit("model_b", announced)];
    input.answers.priority = answer("balance");
    input.answers.care = answer("0");
    input.answers.extra_cost = { ...answer("exact"), amountMinor: 10000 };
    input.answers.benefit_types = answer("coaching");
    let result = recommend(input, ctx);
    expect(result.leaders.preferred).toEqual(["b"]);
    expect(result.ranked[0]?.preferredBenefits[0]?.status).toBe("counted_unconfirmed");
    expect(result.outcome).toBe("provisional");
    expect(result.decisiveMissing).toContain("benefit_evidence_unconfirmed");
    expect(result.messages).toContain("benefit_evidence_unconfirmed");
    ctx.catalog.benefits.push(benefit("model_a", { ...announced, id: "same_on_a", insurerId: 97 }));
    result = recommend(input, ctx);
    expect(result.leaders.preferred).toEqual(["a"]);
    expect(result.decisiveMissing).not.toContain("benefit_evidence_unconfirmed");
    expect(result.outcome).toBe("established");
    ctx.catalog.benefits.pop();
    ctx.rules.serviceEvidence = "verified";
    result = recommend(input, ctx);
    expect(result.leaders.preferred).toEqual(["a"]);
    expect(result.ranked.find((row) => row.offer.id === "b")?.preferredBenefits[0]?.status).toBe(
      "conditional",
    );
  });
  it("never values paid, supplementary, independent or contradictory facts; undocumented is not absent", () => {
    const input = profile(),
      ctx = context();
    ctx.catalog.benefitTypes = [benefitType("coaching")];
    ctx.catalog.benefits = [
      benefit("model_b", { id: "paid", equivalenceGroup: "coaching", extraCostMinor: 14900 }),
      benefit("model_b", {
        id: "supplementary",
        equivalenceGroup: "coaching",
        requiresSupplementary: true,
      }),
      benefit("model_b", { id: "anyone", equivalenceGroup: "coaching", requiresSameBase: false }),
      benefit("model_b", {
        id: "expired",
        equivalenceGroup: "coaching",
        yearConfirmed: false,
        verification: "partial",
        validFrom: "2025-01-01",
        validUntil: "2026-08-31",
      }),
      benefit("model_b", {
        id: "contradictory",
        equivalenceGroup: "coaching",
        verification: "contradictory",
        operatorCaseIds: [],
      }),
    ];
    input.answers.priority = answer("balance");
    input.answers.care = answer("0");
    input.answers.benefit_types = answer("coaching");
    const result = recommend(input, ctx);
    const b = result.ranked.find((row) => row.offer.id === "b")!;
    expect(b.utility.services).toBe(0);
    expect(b.preferredBenefits[0]?.status).toBe("conditional");
    expect(result.ranked.find((row) => row.offer.id === "a")?.preferredBenefits[0]?.status).toBe(
      "not_documented",
    );
  });
  it("publishes a taxonomy only when every fact uses a canonical key of the same family", () => {
    const ctx = context();
    ctx.catalog.benefitTypes = [benefitType("coaching")];
    ctx.catalog.benefits = [benefit("model_b", { equivalenceGroup: "coaching" })];
    expect(() => validateCatalog(ctx.catalog)).not.toThrow();
    ctx.catalog.benefits[0]!.equivalenceGroup = "free_text_group";
    expect(() => validateCatalog(ctx.catalog)).toThrow();
    ctx.catalog.benefits[0]!.equivalenceGroup = "coaching";
    ctx.catalog.benefits[0]!.category = "members";
    expect(() => validateCatalog(ctx.catalog)).toThrow();
    ctx.catalog.benefits[0]!.category = "prevention";
    ctx.catalog.benefitTypes.push(benefitType("telemedicine_free"));
    expect(() => validateCatalog(ctx.catalog)).toThrow();
  });
  it("real research covers exactly the full official model inventory and contradictions have cases", () => {
    const catalog = evidenceCatalogSchema.parse(
      JSON.parse(
        readFileSync(
          new URL(
            "../../../../../data/health-insurance/2027/recommendation-catalog.json",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    );
    validateCatalog(catalog);
    expect(catalog.insurers).toHaveLength(32);
    expect(catalog.models).toHaveLength(153);
    expect(catalog.models.filter((model) => model.status === "not_researched")).toHaveLength(0);
    for (const fact of catalog.benefits.filter((fact) => fact.verification === "contradictory"))
      expect(fact.operatorCaseIds.length).toBeGreaterThan(0);
  });
});
