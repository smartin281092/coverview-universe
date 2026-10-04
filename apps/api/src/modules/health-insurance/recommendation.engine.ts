import type { HealthOffer } from "@coverview/contracts/health-insurance";
import {
  recommendationResultSchema,
  type EvidenceCatalog,
  type RecommendationInput,
  type RecommendationQuestion,
  type RecommendationRules,
  type RankedRecommendation,
  type EvidenceBenefit,
  type ResearchModel,
} from "@coverview/contracts/health-recommendation";
import { answerValues, hasAnswer, compatibility } from "./recommendation.compatibility.js";
import {
  careScenarios,
  financialScenario,
  reserveRange,
  usableEvidence,
  revisedCareCurrent,
} from "./recommendation.cost.js";
import {
  assessUtility,
  benefitCategory,
  benefitBranchInactive,
  benefitAudienceInactive,
  legacyBenefitFilterKeys,
  typeQualification,
} from "./recommendation.utility.js";
import {
  baseQuestion,
  benefitTypesQuestion,
  recommendationQuestions,
  usageQuestion,
} from "./recommendation.questions.fr.js";

export const defaultRecommendationRules: RecommendationRules = {
  schemaVersion: 1,
  year: 2027,
  activation: "opt_in",
  weights: { freedom: 25, practical: 25, simplicity: 15, services: 35 },
  serviceContributionCap: 3,
  serviceEvidence: "official",
  meaningfulAnnualDifferenceMinor: 1200,
  tieAnnualMinor: 1,
  researchReviewDays: 90,
  rationale:
    "Hypothèse d’expertise v1 : 25 liberté, 25 parcours préféré, 15 entrées au choix souhaitées, 35 services à usage prévu (trois types de prestations au maximum, synonymes regroupés). Une prestation annoncée par une source officielle compte comme service ; si ce choix change le meneur sans confirmation 2027, le résultat reste provisoire. Aucun montant sans preuve contractuelle confirmée. Aucun point converti en francs ; aucun coefficient commercial. Une différence de 12 CHF/an déclenche une question financière, sans probabilité de réponse.",
};
export type RecommendationContext = {
  offers: HealthOffer[];
  catalog: EvidenceCatalog;
  rules: RecommendationRules;
  rulesVersion: string;
};
const metricCost = (row: RankedRecommendation) =>
  row.annualInsuranceCareMinor ?? row.annualPremiumMinor;
const stable = (a: RankedRecommendation, b: RankedRecommendation) =>
  a.offer.insurerId - b.offer.insurerId ||
  a.offer.modelId.localeCompare(b.offer.modelId) ||
  a.offer.id.localeCompare(b.offer.id);
const relevantToAnswers = (input: RecommendationInput, benefit: EvidenceBenefit) =>
  answerValues(input, "lifestyle").includes(benefitCategory(benefit)) ||
  answerValues(input, "benefit_types").includes(benefit.equivalenceGroup) ||
  (benefit.category === "prevention" &&
    answerValues(input, "prevention").some((value) => value !== "none")) ||
  (["pharmacy", "cost_sharing"].includes(benefit.category) &&
    answerValues(input, "medication").some((value) => value !== "none"));
type EvaluationIndex = {
  models: Map<string, ResearchModel>;
  facts: Map<string, EvidenceBenefit[]>;
  cases: Map<string, string[]>;
};
function evaluate(
  input: RecommendationInput,
  context: RecommendationContext,
  index: EvaluationIndex,
) {
  const care = careScenarios(input),
    reserve = reserveRange(input);
  const objective = answerValues(input, "priority")[0] ?? "premium";
  const rows: RankedRecommendation[] = context.offers.map((offer) => {
    const model = index.models.get(offer.modelId);
    const facts = index.facts.get(offer.modelId) ?? [];
    const match = compatibility(offer, model, input);
    for (const key of input.tariff.benefitKeys) {
      const matching = facts.filter(
        (fact) =>
          fact.equivalenceGroup === key ||
          (key === "telemedicine_free" && fact.telemedicine === "free_consultation"),
      );
      // A canonical type filter is met by a verified fact; an announced one remains to be verified.
      if (
        !legacyBenefitFilterKeys.includes(key) &&
        context.catalog.benefitTypes.some((type) => type.key === key)
      ) {
        const levels = matching.map((fact) => typeQualification(fact, input, context.rules));
        if (levels.includes("counted")) continue;
        match.uncertainties.push(
          levels.includes("counted_unconfirmed")
            ? "required_benefit_unconfirmed"
            : "required_benefit_unverified",
        );
        if (match.compatibility !== "incompatible") match.compatibility = "verify";
        continue;
      }
      if (
        !matching.some(
          (fact) =>
            usableEvidence(fact, input.tariff.year) &&
            fact.requiresSupplementary === false &&
            fact.requiresSameBase === true &&
            answerValues(input, `eligible:${fact.id}`).includes("yes"),
        )
      ) {
        match.uncertainties.push("required_benefit_unverified");
        if (match.compatibility !== "incompatible") match.compatibility = "verify";
      }
    }
    const special =
      answerValues(input, "maternity").includes("yes") &&
      (input.sex !== "male" || input.explore.includes("maternity"));
    const scenarios = special
      ? []
      : care.map((amount) =>
          financialScenario(
            offer.monthlyPremiumMinor,
            offer.deductible,
            amount,
            offer.ageGroup === "child",
            facts.filter((fact) => !benefitBranchInactive(input, fact)),
            input,
          ),
        );
    const valid = scenarios.every((value) => value !== null);
    const costScenarios = valid ? scenarios.filter((value) => value !== null) : [];
    if (special) match.uncertainties.push("maternity_specific_costs");
    if (
      answerValues(input, "treatment").some((value) =>
        ["regular", "planned", "other"].includes(value),
      ) &&
      !care.length
    )
      match.uncertainties.push("care_estimate_incomplete");
    if (!valid) match.uncertainties.push("medical_benefits_interaction_unresolved");
    const ordinaryExposureMinor =
      offer.deductible * 100 + (offer.ageGroup === "child" ? 35000 : 70000);
    const affordability: RankedRecommendation["affordability"] = !reserve
      ? "unknown"
      : reserve[0] >= ordinaryExposureMinor
        ? "sufficient"
        : reserve[1] !== null && reserve[1] < ordinaryExposureMinor
          ? "insufficient"
          : "uncertain";
    if (affordability === "insufficient") match.reasons.push("ordinary_reserve_shortfall");
    const operatorCaseIds = index.cases.get(offer.modelId) ?? [];
    return {
      offer,
      year: input.tariff.year,
      ...match,
      reasons: [...new Set(match.reasons)],
      uncertainties: [...new Set(match.uncertainties)],
      annualPremiumMinor: offer.monthlyPremiumMinor * 12,
      costShareMinor: costScenarios[0]?.costShareMinor ?? null,
      annualInsuranceCareMinor: costScenarios[0]?.annualMinor ?? null,
      costScenarios,
      ordinaryExposureMinor,
      affordability,
      ...assessUtility(offer, model, facts, input, context.rules),
      operatorCaseIds,
      tied: false,
    } satisfies RankedRecommendation;
  });
  const viable = rows.filter((row) => row.compatibility !== "incompatible");
  const baseline = Math.min(...viable.map(metricCost));
  const extraAnswer = input.answers.extra_cost;
  const extra =
    answerValues(input, "extra_cost")[0] === "0"
      ? 0
      : answerValues(input, "extra_cost")[0] === "exact"
        ? extraAnswer?.amountMinor
        : undefined;
  const preferred = viable.filter(
    (row) =>
      objective !== "balance" || extra === undefined || metricCost(row) <= baseline + extra * 12,
  );
  function compare(a: RankedRecommendation, b: RankedRecommendation) {
    if (objective === "premium") return a.offer.monthlyPremiumMinor - b.offer.monthlyPremiumMinor;
    if (objective === "freedom")
      return b.utility.freedom - a.utility.freedom || metricCost(a) - metricCost(b);
    if (objective === "balance")
      return b.utility.total - a.utility.total || metricCost(a) - metricCost(b);
    return metricCost(a) - metricCost(b);
  }
  preferred.sort((a, b) => compare(a, b) || stable(a, b));
  const remaining = rows
    .filter((row) => !preferred.includes(row))
    .sort(
      (a, b) =>
        (a.compatibility === "incompatible" ? 1 : 0) -
          (b.compatibility === "incompatible" ? 1 : 0) ||
        a.offer.monthlyPremiumMinor - b.offer.monthlyPremiumMinor ||
        stable(a, b),
    );
  const ranked = [...preferred, ...remaining];
  const leader = preferred[0];
  const tiedWith = (
    row: RankedRecommendation,
    first: RankedRecommendation,
    cost: (value: RankedRecommendation) => number,
  ) =>
    objective === "premium"
      ? row.offer.monthlyPremiumMinor === first.offer.monthlyPremiumMinor
      : (objective !== "freedom" || row.utility.freedom === first.utility.freedom) &&
        (objective !== "balance" || row.utility.total === first.utility.total) &&
        Math.abs(cost(row) - cost(first)) <= context.rules.tieAnnualMinor;
  const preferredIds = leader
    ? preferred.filter((row) => tiedWith(row, leader, metricCost)).map((row) => row.offer.id)
    : [];
  const scenarioPreferred: string[][] = [];
  for (let index = 0; index < care.length; index++) {
    const scenarioCost = (row: RankedRecommendation) =>
      row.costScenarios[index]?.annualMinor ?? Infinity;
    const minimum = Math.min(...viable.map(scenarioCost));
    const candidates = viable.filter(
      (row) =>
        Number.isFinite(scenarioCost(row)) &&
        (objective !== "balance" ||
          extra === undefined ||
          scenarioCost(row) <= minimum + extra * 12),
    );
    candidates.sort((a, b) =>
      objective === "premium"
        ? a.offer.monthlyPremiumMinor - b.offer.monthlyPremiumMinor || stable(a, b)
        : (objective === "balance"
            ? b.utility.total - a.utility.total
            : objective === "freedom"
              ? b.utility.freedom - a.utility.freedom
              : 0) ||
          scenarioCost(a) - scenarioCost(b) ||
          stable(a, b),
    );
    const first = candidates[0];
    scenarioPreferred.push(
      first
        ? candidates.filter((row) => tiedWith(row, first, scenarioCost)).map((row) => row.offer.id)
        : [],
    );
  }
  const scenarioDisagreement =
    new Set(scenarioPreferred.map((ids) => [...ids].sort().join())).size > 1;
  if (scenarioDisagreement)
    for (const ids of scenarioPreferred)
      for (const id of ids) if (!preferredIds.includes(id)) preferredIds.push(id);
  ranked.forEach((row) => {
    row.tied = preferredIds.length > 1 && preferredIds.includes(row.offer.id);
  });
  const premium = Math.min(...viable.map((row) => row.offer.monthlyPremiumMinor));
  const annualLeaders = new Set<string>();
  for (let index = 0; index < care.length; index++) {
    const min = Math.min(...viable.map((row) => row.costScenarios[index]?.annualMinor ?? Infinity));
    for (const row of viable)
      if (
        row.costScenarios[index] &&
        Math.abs(row.costScenarios[index]!.annualMinor - min) <= context.rules.tieAnnualMinor
      )
        annualLeaders.add(row.offer.id);
  }
  return {
    ranked,
    preferred,
    scenarioDisagreement,
    leaders: {
      premium: viable
        .filter((row) => row.offer.monthlyPremiumMinor === premium)
        .map((row) => row.offer.id),
      annual: [...annualLeaders],
      preferred: preferredIds,
    },
    objective,
    extra,
  };
}
function benefitQuestions(benefit: EvidenceBenefit): RecommendationQuestion[] {
  const usage = usageQuestion(benefit.id, benefit.title);
  const eligible: RecommendationQuestion = {
    ...usage,
    id: `eligible:${benefit.id}`,
    title: "Les conditions d’accès à cet avantage sont-elles remplies ?",
    help: `${benefit.title} : ${benefit.conditions} ${benefit.activation}`,
    options: [
      {
        value: "yes",
        label: "Oui, ces conditions sont remplies et l’activation est prévue.",
        exclusive: false,
      },
      { value: "no", label: "Non.", exclusive: false },
      { value: "unknown", label: "Je dois vérifier.", exclusive: true },
    ],
  };
  const existing: RecommendationQuestion = {
    ...usage,
    id: `existing:${benefit.id}`,
    title: "Avez-vous déjà accès à cet avantage indépendamment de cette assurance de base ?",
    help: benefit.title,
    options: [
      { value: "yes", label: "Oui, je le conserve déjà.", exclusive: false },
      { value: "no", label: "Non.", exclusive: false },
      { value: "unknown", label: "Je ne sais pas.", exclusive: true },
    ],
  };
  const spending: RecommendationQuestion = {
    ...usage,
    id: `spending:${benefit.id}`,
    title:
      "Quel montant dépenserez-vous déjà dans le panier éligible, sans acheter davantage pour obtenir le rabais ?",
    help: `${benefit.title} · ${benefit.financial.kind === "purchase_discount" ? benefit.financial.basket : ""}. ${benefit.exclusions}`,
    amount: "spending",
    options: [
      { value: "exact", label: "Saisir ma dépense annuelle éligible.", exclusive: false },
      { value: "unknown", label: "Je ne sais pas.", exclusive: true },
    ],
  };
  const allocation: RecommendationQuestion = {
    ...spending,
    id: `caregroup:${benefit.financial.kind === "eligible_care_waiver" ? benefit.financial.careGroup : benefit.id}`,
    title: "Quelle part de votre estimation de soins concerne ce panier éligible ?",
    help: `${benefit.title}. ${benefit.conditions} ${benefit.exclusions} Ce montant est déjà inclus dans l’estimation annuelle ; ne comptez pas les mêmes soins dans deux paniers.`,
    amount: "spending",
  };
  return [
    usage,
    existing,
    eligible,
    ...(benefit.financial.kind === "purchase_discount"
      ? [spending]
      : benefit.financial.kind === "eligible_care_waiver"
        ? [allocation]
        : []),
  ];
}
function validateAnswers(input: RecommendationInput, questions: RecommendationQuestion[]) {
  for (const [id, answer] of Object.entries(input.answers)) {
    const q = questions.find((value) => value.id === id);
    if (!q) {
      // Structured professional references and eligible-care allocations are bounded and never interpreted as diagnoses.
      if (/^(professional:|caregroup:)/.test(id)) continue;
      throw Object.assign(new Error("HEALTH_RECOMMENDATION_INVALID_ANSWER"), { statusCode: 400 });
    }
    if (answer.status !== "answered") {
      if (
        answer.values.length ||
        answer.amountMinor !== undefined ||
        answer.upperMinor !== undefined
      )
        throw Object.assign(new Error("HEALTH_RECOMMENDATION_INVALID_ANSWER"), { statusCode: 400 });
      continue;
    }
    const selected = q.options.filter((option) => answer.values.includes(option.value));
    if (
      selected.length !== answer.values.length ||
      new Set(answer.values).size !== answer.values.length ||
      (!q.multiple && answer.values.length !== 1) ||
      (selected.some((option) => option.exclusive) && selected.length > 1) ||
      (answer.values.includes("exact") && answer.amountMinor === undefined)
    )
      throw Object.assign(new Error("HEALTH_RECOMMENDATION_INVALID_ANSWER"), { statusCode: 400 });
  }
}
export function recommend(input: RecommendationInput, context: RecommendationContext) {
  if (input.tariff.year !== context.catalog.year || input.tariff.year !== context.rules.year)
    throw Object.assign(new Error("HEALTH_RECOMMENDATION_YEAR_MISMATCH"), { statusCode: 422 });
  // Immutable catalogue joins are shared across every sensitivity scenario in this request.
  // No personal profile or answer is retained between requests.
  const index: EvaluationIndex = {
    models: new Map(context.catalog.models.map((model) => [model.id, model])),
    facts: new Map(),
    cases: new Map(),
  };
  for (const offer of context.offers) {
    if (index.facts.has(offer.modelId)) continue;
    index.facts.set(
      offer.modelId,
      context.catalog.benefits.filter(
        (benefit) =>
          benefit.modelIds.includes(offer.modelId) ||
          (!benefit.modelIds.length && benefit.insurerId === offer.insurerId),
      ),
    );
    index.cases.set(
      offer.modelId,
      context.catalog.cases
        .filter((record) => record.modelIds.includes(offer.modelId) && record.status !== "resolved")
        .map((record) => record.id),
    );
  }
  const relevantFacts = context.catalog.benefits.filter(
    (benefit) =>
      !benefitAudienceInactive(input, benefit) &&
      context.offers.some(
        (offer) =>
          benefit.modelIds.includes(offer.modelId) ||
          (!benefit.modelIds.length && benefit.insurerId === offer.insurerId),
      ),
  );
  const importance = ["gp", "specialist"].map((kind) => ({
    ...baseQuestion("professional_importance"),
    id: `importance:${kind}`,
    title:
      kind === "gp"
        ? "Conserver votre médecin habituel est-il indispensable ?"
        : "Conserver vos spécialistes est-il indispensable ?",
  }));
  // A catalogue with a canonical taxonomy asks preferences per benefit type; older catalogues keep
  // the category question so that their published answers and behaviour remain unchanged.
  const preferableTypes = context.catalog.benefitTypes.filter((type) =>
    ["service", "financial"].includes(type.valuation),
  );
  const taxonomy = preferableTypes.length > 0;
  const allQuestions = [
    ...recommendationQuestions
      .filter(
        (definition) =>
          definition.id !== "professional_importance" && definition.id !== "benefit_types",
      )
      .map((definition) => baseQuestion(definition.id)),
    ...(taxonomy ? [benefitTypesQuestion(preferableTypes)] : []),
    {
      ...baseQuestion("care"),
      id: "care_revised",
      title: "Quelle est votre nouvelle estimation annuelle, tous ces soins compris ?",
      help: "Ce total remplace votre estimation précédente. Il ne s’y ajoute pas. Incluez les soins réguliers ou prévus, sans compter les primes.",
    },
    ...importance,
    ...context.catalog.benefits.flatMap(benefitQuestions),
  ];
  validateAnswers(input, allQuestions);
  const questions = [
    ...new Map(
      allQuestions
        .filter(
          (question) =>
            (!question.subjectId ||
              relevantFacts.some((fact) => fact.id === question.subjectId) ||
              hasAnswer(input, question.id)) &&
            !(taxonomy && question.id === "lifestyle" && !hasAnswer(input, "lifestyle")),
        )
        .map((question) => [question.id, question]),
    ).values(),
  ];
  const categories = new Set<string>(
    relevantFacts.filter((fact) => fact.classification !== "legal_common").map(benefitCategory),
  );
  const lifestyle = questions.find((q) => q.id === "lifestyle");
  if (lifestyle)
    lifestyle.options = lifestyle.options.filter(
      (option) => option.exclusive || categories.has(option.value),
    );
  // Only types that at least one candidate offer can actually honour are proposed; a previous
  // choice stays visible so that it can be withdrawn.
  const offerableTypes = new Set(
    relevantFacts
      .filter((fact) =>
        ["counted", "counted_unconfirmed"].includes(typeQualification(fact, input, context.rules)),
      )
      .map((fact) => fact.equivalenceGroup),
  );
  const typeQuestion = questions.find((q) => q.id === "benefit_types");
  if (typeQuestion)
    typeQuestion.options = typeQuestion.options.filter(
      (option) =>
        option.exclusive ||
        offerableTypes.has(option.value) ||
        answerValues(input, "benefit_types").includes(option.value),
    );
  const typeChoices = typeQuestion?.options.filter((option) => !option.exclusive) ?? [];
  const evaluated = evaluate(input, context, index);
  const evaluatedById = new Map(evaluated.ranked.map((row) => [row.offer.id, row]));
  let examinedScenarios = 1;
  const eligible = (id: string) =>
    !hasAnswer(input, id) || (id === "care_revised" && !revisedCareCurrent(input));
  const candidates: { question: RecommendationQuestion; priority: number }[] = [];
  function required(
    id: string,
    when: boolean,
    reason: RecommendationQuestion["reason"],
    priority: number,
  ) {
    if (!when || !eligible(id)) return;
    const question = questions.find((q) => q.id === id);
    if (!question) return;
    candidates.push({ question: { ...question, reason }, priority });
  }
  required("priority", true, "constraint", 0);
  const tariffComplete =
    input.tariffKnown.birth && (input.tariffKnown.locality || input.tariffKnown.region);
  required("tariff", !tariffComplete, "tariff", 1);
  required("accident", !input.tariff.accident, "tariff", 2);
  required("access", true, "constraint", 3);
  const restrictedCandidates = evaluated.preferred.some((row) => row.offer.category !== "BASE");
  required(
    "obligations",
    restrictedCandidates && !answerValues(input, "access").includes("free"),
    "constraint",
    4,
  );
  required("professionals", true, "constraint", 5);
  for (const kind of ["gp", "specialist"])
    required(
      `importance:${kind}`,
      answerValues(input, "professionals").includes(kind),
      "constraint",
      6,
    );
  required("reserve", input.scope === "optimize_deductible", "constraint", 7);
  required("care", evaluated.objective !== "premium", "cost_sensitivity", 8);
  if (evaluated.objective !== "premium") {
    const supported = relevantFacts.filter(
      (fact) =>
        usableEvidence(fact, input.tariff.year) &&
        !["legal_common", "public_service"].includes(fact.classification) &&
        fact.requiresSameBase !== false,
    );
    // With a taxonomy, the type question is the single entry point for benefit preferences; the
    // category questions stay available on request and keep their answers.
    const possibleIds = [
      "access_preference",
      "access_flex",
      ...(!taxonomy && supported.some((f) => f.category === "prevention") ? ["prevention"] : []),
      ...(!taxonomy && supported.some((f) => ["cost_sharing", "pharmacy"].includes(f.category))
        ? ["medication"]
        : []),
      ...(taxonomy
        ? typeChoices.length
          ? ["benefit_types"]
          : []
        : supported.length
          ? ["lifestyle"]
          : []),
    ];
    for (const id of possibleIds) {
      if (!eligible(id)) continue;
      const q = questions.find((value) => value.id === id);
      if (!q) continue;
      let changesLeader = false,
        changesCost = false,
        changesCompatibility = false,
        alternatives = 0;
      const options = q.options
        .filter((value) => !value.exclusive || value.value === "free")
        .map((value) => value.value);
      // A type offered by every current leader raises them as much as any rival: it cannot change
      // the leader alone. Outside the balance objective, only verified amounts can matter.
      const leaderFacts = evaluated.preferred
        .filter((row) => evaluated.leaders.preferred.includes(row.offer.id))
        .map((row) => index.facts.get(row.offer.modelId) ?? []);
      const decisive = (type: string) =>
        supported.some((fact) => fact.equivalenceGroup === type) ||
        (evaluated.objective === "balance" &&
          !(
            leaderFacts.length &&
            leaderFacts.every((facts) =>
              facts.some(
                (fact) =>
                  fact.equivalenceGroup === type &&
                  ["counted", "counted_unconfirmed"].includes(
                    typeQualification(fact, input, context.rules),
                  ),
              ),
            )
          ));
      const single = options
        .filter((value) => id !== "benefit_types" || decisive(value))
        .map((value) => [value]);
      // Benefit types are also probed together first: several services may matter only jointly.
      const choices = id === "benefit_types" && options.length > 1 ? [options, ...single] : single;
      // Once the leader changes, more benefit probes cannot raise the priority of the question
      // (compatibility only depends on them through a required benefit filter).
      const settled = () =>
        id === "benefit_types" && changesLeader && !input.tariff.benefitKeys.length;
      for (const values of choices) {
        if (settled()) break;
        const originalVariant: RecommendationInput = {
          ...input,
          answers: {
            ...input.answers,
            [id]: { version: 2, status: "answered", values },
          },
        };
        // Probe dependent answers together, explicitly as scenarios, never response probabilities.
        const dependencies = supported.filter(
          (value) =>
            !relevantToAnswers(input, value) &&
            values.some(
              (choice) =>
                (id !== "benefit_types" && benefitCategory(value) === choice) ||
                (id === "benefit_types" && value.equivalenceGroup === choice) ||
                (id === "prevention" && value.category === "prevention") ||
                (id === "medication" && ["pharmacy", "cost_sharing"].includes(value.category)),
            ),
        );
        const variants = [originalVariant];
        const combined = structuredClone(originalVariant);
        for (const fact of dependencies) {
          const variant = structuredClone(originalVariant);
          for (const [prefix, value] of [
            ["usage", "planned"],
            ["eligible", "yes"],
            ["existing", "no"],
          ])
            if (!hasAnswer(input, `${prefix}:${fact.id}`))
              variant.answers[`${prefix}:${fact.id}`] = {
                version: 2,
                status: "answered",
                values: [value!],
              };
          for (const [key, value] of Object.entries(variant.answers))
            if (!hasAnswer(input, key)) combined.answers[key] = value;
          if (
            fact.financial.kind === "eligible_care_waiver" &&
            !hasAnswer(input, `caregroup:${fact.financial.careGroup}`)
          )
            variant.answers[`caregroup:${fact.financial.careGroup}`] = {
              version: 2,
              status: "answered",
              values: ["exact"],
              amountMinor: careScenarios(input)[0] ?? 0,
            };
          variants.push(variant);
        }
        // Separate services can jointly matter even when none can overcome the current tradeoff alone.
        // Medical buckets are partitioned in this joint probe, never each assigned the whole budget.
        const careGroups = [
          ...new Set(
            dependencies.flatMap((fact) =>
              fact.financial.kind === "eligible_care_waiver" ? [fact.financial.careGroup] : [],
            ),
          ),
        ];
        for (const group of careGroups)
          if (!hasAnswer(input, `caregroup:${group}`))
            combined.answers[`caregroup:${group}`] = {
              version: 2,
              status: "answered",
              values: ["exact"],
              amountMinor: Math.floor((careScenarios(input)[0] ?? 0) / careGroups.length),
            };
        if (dependencies.length > 1) variants.push(combined);
        for (const variant of variants) {
          const simulation = evaluate(variant, context, index);
          examinedScenarios++;
          alternatives++;
          changesLeader ||=
            simulation.leaders.preferred.join() !== evaluated.leaders.preferred.join();
          changesCompatibility ||= simulation.ranked.some(
            (row) => row.compatibility !== evaluatedById.get(row.offer.id)?.compatibility,
          );
          changesCost ||= simulation.ranked.some(
            (row) =>
              Math.abs(metricCost(row) - metricCost(evaluatedById.get(row.offer.id)!)) >=
              context.rules.meaningfulAnnualDifferenceMinor,
          );
          if (settled()) break;
        }
      }
      if (changesLeader || changesCost)
        candidates.push({
          question: {
            ...q,
            reason: ["lifestyle", "benefit_types", "prevention", "medication"].includes(id)
              ? "dependent_benefit"
              : "ranking_sensitivity",
            sensitivity: {
              examinedAlternatives: alternatives,
              changesLeader,
              changesCompatibility,
              changesCost,
            },
          },
          priority: changesCompatibility ? 9 : changesLeader ? 10 : 12,
        });
    }
    for (const benefit of supported) {
      const typed = answerValues(input, "benefit_types").includes(benefit.equivalenceGroup);
      const relevant =
        typed ||
        answerValues(input, "lifestyle").includes(benefitCategory(benefit)) ||
        (benefit.category === "prevention" &&
          answerValues(input, "prevention").some((x) => x !== "none")) ||
        (["pharmacy", "cost_sharing"].includes(benefit.category) &&
          answerValues(input, "medication").some((x) => x !== "none"));
      if (!relevant) continue;
      // The type preference already states the planned use; only amounts still need conditions.
      if (typed && benefit.financial.kind === "none") continue;
      required(`usage:${benefit.id}`, !typed, "dependent_benefit", 13);
      if (
        typed ||
        answerValues(input, `usage:${benefit.id}`).some((value) =>
          ["current", "planned"].includes(value),
        )
      ) {
        required(`existing:${benefit.id}`, !typed, "dependent_benefit", 14);
        required(
          `eligible:${benefit.id}`,
          !answerValues(input, `existing:${benefit.id}`).includes("yes"),
          "dependent_benefit",
          15,
        );
        required(
          `spending:${benefit.id}`,
          benefit.financial.kind === "purchase_discount" &&
            answerValues(input, `eligible:${benefit.id}`).includes("yes"),
          "cost_sensitivity",
          16,
        );
        if (benefit.financial.kind === "eligible_care_waiver")
          required(
            `caregroup:${benefit.financial.careGroup}`,
            answerValues(input, `eligible:${benefit.id}`).includes("yes"),
            "cost_sensitivity",
            16,
          );
      }
    }
  }
  const bestUtility = evaluated.preferred[0];
  const costUtilityTradeoff =
    evaluated.objective === "balance" &&
    !!bestUtility &&
    evaluated.preferred.some(
      (row) =>
        row.utility.total < bestUtility.utility.total && metricCost(row) < metricCost(bestUtility),
    );
  required(
    "extra_cost",
    costUtilityTradeoff && evaluated.extra === undefined,
    "ranking_sensitivity",
    11,
  );
  for (const id of input.explore)
    required(id === "lifestyle" && taxonomy ? "benefit_types" : id, true, "requested", 20);
  required(
    "treatment_included",
    answerValues(input, "treatment").some((x) => ["regular", "planned", "other"].includes(x)),
    "cost_sensitivity",
    21,
  );
  required(
    "care_revised",
    answerValues(input, "treatment").some((value) =>
      ["regular", "planned", "other"].includes(value),
    ) && answerValues(input, "treatment_included").includes("no"),
    "cost_sensitivity",
    8,
  );
  candidates.sort(
    (a, b) =>
      a.priority - b.priority ||
      a.question.options.length - b.question.options.length ||
      a.question.id.localeCompare(b.question.id),
  );
  const nextQuestion = candidates[0]?.question ?? null;
  const decisiveMissing = new Set<string>();
  for (const id of ["priority", "access", "professionals"])
    if (!answerValues(input, id).length) decisiveMissing.add(id);
  if (!tariffComplete) decisiveMissing.add("tariff");
  if (input.scope === "optimize_deductible" && !reserveRange(input)) decisiveMissing.add("reserve");
  if (evaluated.objective !== "premium" && !careScenarios(input).length)
    decisiveMissing.add("care");
  for (const row of evaluated.preferred.filter((row) =>
    evaluated.leaders.preferred.includes(row.offer.id),
  ))
    row.uncertainties.forEach((value) => decisiveMissing.add(value));
  if (
    context.catalog.cases.some(
      (record) =>
        record.status !== "resolved" &&
        record.priority === "blocking" &&
        (!context.catalog.benefits.some((fact) => fact.operatorCaseIds.includes(record.id)) ||
          context.catalog.benefits.some(
            (fact) =>
              fact.operatorCaseIds.includes(record.id) &&
              ((evaluated.objective !== "premium" && relevantToAnswers(input, fact)) ||
                input.tariff.benefitKeys.includes(fact.equivalenceGroup)),
          )) &&
        evaluated.preferred.some(
          (row) =>
            evaluated.leaders.preferred.includes(row.offer.id) &&
            record.modelIds.includes(row.offer.modelId),
        ),
    )
  )
    decisiveMissing.add("documentary_verification");
  // Announced but not year-confirmed services only make the result provisional when they decide it.
  if (
    context.rules.serviceEvidence === "official" &&
    evaluated.preferred.some(
      (row) =>
        evaluated.leaders.preferred.includes(row.offer.id) &&
        row.preferredBenefits.some((item) => item.status === "counted_unconfirmed"),
    )
  ) {
    const strict = evaluate(
      input,
      { ...context, rules: { ...context.rules, serviceEvidence: "verified" } },
      index,
    );
    examinedScenarios++;
    if (strict.leaders.preferred.join() !== evaluated.leaders.preferred.join())
      decisiveMissing.add("benefit_evidence_unconfirmed");
  }
  const rangeAmbiguous = evaluated.scenarioDisagreement;
  const active =
    context.rules.activation === "on" || (context.rules.activation === "opt_in" && input.optIn);
  const outcome = !active
    ? "disabled"
    : !input.stop && nextQuestion
      ? "continue"
      : decisiveMissing.size
        ? "provisional"
        : (costUtilityTradeoff && evaluated.extra === undefined) || rangeAmbiguous
          ? "tradeoff"
          : evaluated.preferred.length
            ? "established"
            : "provisional";
  const messages = ["ordinary_costs_only", "before_unverified_subsidy", "no_commercial_ranking"];
  if (rangeAmbiguous) messages.push("care_range_changes_leader");
  if (input.legacyAnswers.length) messages.push("legacy_answers_require_confirmation");
  if (!evaluated.preferred.length) messages.push("no_compatible_candidates");
  if (answerValues(input, "household").some((value) => value !== "individual"))
    messages.push("individual_costs_only");
  if (outcome === "established") messages.push("enough_information");
  if (outcome === "tradeoff") messages.push("cost_utility_tradeoff");
  if (decisiveMissing.has("benefit_evidence_unconfirmed"))
    messages.push("benefit_evidence_unconfirmed");
  const researched = context.catalog.models.filter(
    (model) => model.status !== "not_researched",
  ).length;
  return recommendationResultSchema.parse({
    profileVersion: input.profileVersion,
    rulesVersion: context.rulesVersion,
    catalogVersion: context.catalog.id,
    year: input.tariff.year,
    scope: input.scope,
    subsidy: "before_unverified_subsidy",
    active,
    outcome,
    ranked: evaluated.ranked,
    unevaluable: evaluated.ranked
      .filter((row) => row.annualInsuranceCareMinor === null)
      .map((row) => row.offer.id),
    leaders: evaluated.leaders,
    nextQuestion: active && !input.stop ? nextQuestion : null,
    questionStates: questions.map((question) => ({
      id: question.id,
      responseStatus:
        question.id === "tariff" && tariffComplete
          ? "answered"
          : (input.answers[question.id]?.status ?? "not_asked"),
      display:
        (question.id === "tariff" && tariffComplete) ||
        (question.id === "maternity" &&
          input.sex === "male" &&
          !input.explore.includes("maternity")) ||
        (question.subjectId !== null &&
          (!relevantFacts.some((fact) => fact.id === question.subjectId) ||
            context.catalog.benefits.some(
              (fact) => fact.id === question.subjectId && benefitBranchInactive(input, fact),
            ))) ||
        (question.id.startsWith("importance:") &&
          !answerValues(input, "professionals").includes(question.id.split(":")[1]!)) ||
        (question.id === "care_revised" &&
          !answerValues(input, "treatment_included").includes("no")) ||
        (question.id === "treatment_included" &&
          !answerValues(input, "treatment").some((value) =>
            ["regular", "planned", "other"].includes(value),
          )) ||
        (evaluated.objective === "premium" &&
          [
            "prevention",
            "medication",
            "lifestyle",
            "benefit_types",
            "extra_cost",
            "care",
            "supplementary",
          ].includes(question.id) &&
          !input.explore.includes(
            (question.id === "benefit_types"
              ? "lifestyle"
              : question.id) as RecommendationInput["explore"][number],
          ))
          ? "inactive"
          : candidates.some((candidate) => candidate.question.id === question.id) ||
              hasAnswer(input, question.id)
            ? "active"
            : "available",
      question,
    })),
    messages,
    decisiveMissing: [...decisiveMissing],
    examinedCandidateCount: context.offers.length,
    examinedScenarios,
    evidenceCounts: {
      models: context.catalog.models.length,
      researched,
      verified: context.catalog.models.filter((model) => model.status === "verified").length,
      remaining: context.catalog.models.length - researched,
    },
  });
}
