import type {
  SupplementaryAssistantInput,
  SupplementaryAssistantQuestion,
  SupplementaryAssistantResult,
  SupplementaryCanton,
  SupplementarySex,
} from "@coverview/contracts/supplementary-insurance";
import { fold, quoteYear, type Interpretation } from "./supplementary.interpret.js";
import { quotePrices, type PremiumRecord } from "./supplementary.quote.js";
import { rankProducts, type CatalogIndex, type RankedProduct } from "./supplementary.ranking.js";

// Assistant of the comparator (19 November 2026): profile, ranking and at most one question,
// asked only when its possible answers change the set of the first three results. Nothing is kept.

export type AssistantDependencies = {
  index: CatalogIndex;
  // Premium rows of the current catalogue for these (birth year, postal code) pairs.
  premiums: (pairs: Array<{ birthYear: number; postalCode: string }>) => Promise<PremiumRecord[]>;
  interpret: (
    message: string,
  ) => Promise<{ engine: "llm" | "rules"; interpretation: Interpretation }>;
};
type Profile = { birthYear: number; sex: SupplementarySex | null; canton: SupplementaryCanton };
type Need = Pick<Interpretation, "tags" | "categories" | "insurers" | "maxMonthlyMinor">;

const defaults = { birthYear: 1990, childBirthYear: quoteYear - 10, canton: "VD" as const };
const cantonNames: Record<SupplementaryCanton, string> = {
  VD: "Vaud",
  GE: "Genève",
  FR: "Fribourg",
  VS: "Valais",
  NE: "Neuchâtel",
  JU: "Jura",
};
const ageOptions = [
  { value: String(quoteYear - 12), label: "Moins de 19 ans" },
  { value: String(quoteYear - 22), label: "19 à 25 ans" },
  { value: String(quoteYear - 31), label: "26 à 35 ans" },
  { value: String(quoteYear - 43), label: "36 à 50 ans" },
  { value: String(quoteYear - 58), label: "51 à 65 ans" },
  { value: String(quoteYear - 72), label: "66 ans ou plus" },
];
const childOptions = [
  { value: String(quoteYear - 2), label: "0 à 3 ans" },
  { value: String(quoteYear - 7), label: "4 à 9 ans" },
  { value: String(quoteYear - 12), label: "10 à 14 ans" },
  { value: String(quoteYear - 16), label: "15 à 18 ans" },
];
const budgetOptions = [
  { value: "20", label: "Jusqu’à CHF 20" },
  { value: "50", label: "Jusqu’à CHF 50" },
  { value: "100", label: "Jusqu’à CHF 100" },
  { value: "200", label: "Jusqu’à CHF 200" },
  { value: "none", label: "Pas de limite" },
];
const price = new Intl.NumberFormat("fr-CH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const chf = (minor: number) => `CHF ${price.format(minor / 100)}`;

function answerYear(value: string | undefined): number | null {
  if (!value) return null;
  const year = /\b(19\d\d|20[0-2]\d)\b/u.exec(value);
  if (year && Number(year[1]) <= quoteYear - 1) return Number(year[1]);
  const age = /\b(\d{1,3})\b/u.exec(value);
  return age && Number(age[1]) <= 110 ? quoteYear - Math.max(1, Number(age[1])) : null;
}
function answerSex(value: string | undefined): SupplementarySex | null {
  const folded = fold(value ?? "");
  return /^(female|femme|f)$/u.test(folded)
    ? "female"
    : /^(male|homme|h|m)$/u.test(folded)
      ? "male"
      : null;
}
function answerCanton(value: string | undefined): SupplementaryCanton | null {
  if (!value) return null;
  const folded = fold(value).trim();
  const entry = (Object.entries(cantonNames) as Array<[SupplementaryCanton, string]>).find(
    ([code, name]) => folded === code.toLowerCase() || folded === fold(name),
  );
  return entry ? entry[0] : null;
}
function answerBudget(value: string | undefined): number | null | undefined {
  if (!value) return undefined;
  if (/^(none|aucun|pas de limite)$/u.test(fold(value).trim())) return null;
  const amount = /(\d{1,5})(?:[.,](\d{1,2}))?/u.exec(value);
  return amount ? Number(amount[1]) * 100 + Number((amount[2] ?? "").padEnd(2, "0")) : undefined;
}

export async function runAssistant(
  input: SupplementaryAssistantInput,
  deps: AssistantDependencies,
): Promise<SupplementaryAssistantResult> {
  const { engine, interpretation } = await deps.interpret(input.message);
  const answers = input.answers;
  const child = interpretation.child;
  // A child named in the message is the person to insure: an adult's birth year or sex received
  // with the page profile does not describe them.
  const received = {
    birthYear:
      input.profile.birthYear !== null && (!child || quoteYear - input.profile.birthYear <= 18)
        ? input.profile.birthYear
        : null,
    sex: child ? null : input.profile.sex,
    canton: input.profile.canton,
  };
  const birthYear =
    received.birthYear ??
    answerYear(answers.child_age) ??
    answerYear(answers.birth_year) ??
    interpretation.birthYear;
  const sex = received.sex ?? answerSex(answers.sex) ?? interpretation.sex;
  const canton = received.canton ?? answerCanton(answers.canton) ?? interpretation.canton;
  const answeredBudget = answerBudget(answers.budget);
  const need: Need = {
    tags: interpretation.tags.filter((tag) => deps.index.tagLabels.has(tag)).slice(0, 30),
    categories: interpretation.categories.slice(0, 15),
    insurers: interpretation.insurers.slice(0, 15),
    maxMonthlyMinor: answeredBudget === undefined ? interpretation.maxMonthlyMinor : answeredBudget,
  };
  const childNeed = child || need.tags.includes("orthodontics");
  const profile: Profile = {
    birthYear: birthYear ?? (child ? defaults.childBirthYear : defaults.birthYear),
    sex,
    canton: canton ?? defaults.canton,
  };
  const postal = (code: SupplementaryCanton) =>
    deps.index.catalog.localities.find((locality) => locality.canton === code)!;

  // Candidate questions, in order, for what is still unknown.
  const ageQuestion: SupplementaryAssistantQuestion = childNeed
    ? {
        id: "child_age",
        text: child ? "Quel âge a l’enfant ?" : "Quel âge a la personne à assurer ?",
        options: child
          ? childOptions
          : [...childOptions, { value: String(quoteYear - 37), label: "19 ans ou plus" }],
        allowCustom: true,
      }
    : {
        id: "birth_year",
        text: "Quel âge a la personne à assurer ?",
        options: ageOptions,
        allowCustom: true,
      };
  const candidates: Array<{
    question: SupplementaryAssistantQuestion;
    apply: (value: string) => [Profile, Need];
  }> = [];
  if (birthYear === null && !(ageQuestion.id in answers))
    candidates.push({
      question: ageQuestion,
      apply: (value) => [{ ...profile, birthYear: Number(value) }, need],
    });
  if (sex === null && !("sex" in answers))
    candidates.push({
      question: {
        id: "sex",
        text: "La personne à assurer est-elle une femme ou un homme ?",
        options: [
          { value: "female", label: "Femme" },
          { value: "male", label: "Homme" },
        ],
        allowCustom: false,
      },
      apply: (value) => [{ ...profile, sex: value as SupplementarySex }, need],
    });
  if (canton === null && !("canton" in answers))
    candidates.push({
      question: {
        id: "canton",
        text: "Dans quel canton habite la personne à assurer ?",
        options: deps.index.catalog.localities.map((locality) => ({
          value: locality.canton,
          label: cantonNames[locality.canton],
        })),
        allowCustom: false,
      },
      apply: (value) => [{ ...profile, canton: value as SupplementaryCanton }, need],
    });

  // Premium rows of every profile the questions may need, read in one query.
  const pairs = new Map<string, { birthYear: number; postalCode: string }>();
  const want = (year: number, code: SupplementaryCanton) =>
    pairs.set(`${year}:${code}`, { birthYear: year, postalCode: postal(code).postalCode });
  want(profile.birthYear, profile.canton);
  for (const candidate of candidates)
    for (const option of candidate.question.options) {
      const [next] = candidate.apply(option.value);
      want(next.birthYear, next.canton);
    }
  const rows = await deps.premiums([...pairs.values()]);
  const rank = (who: Profile, what: Need): RankedProduct[] =>
    rankProducts(
      deps.index,
      what,
      quotePrices(
        rows.filter((row) => row.postalCode === postal(who.canton).postalCode),
        who.birthYear,
        who.sex,
      ),
      quoteYear - who.birthYear,
    );
  const understood =
    need.tags.length + need.categories.length + need.insurers.length > 0 ||
    need.maxMonthlyMinor !== null;
  const ranked = understood ? rank(profile, need) : [];
  if (
    understood &&
    need.maxMonthlyMinor === null &&
    answeredBudget === undefined &&
    ranked.length > 8
  )
    candidates.push({
      question: {
        id: "budget",
        text: "Quel budget mensuel visez-vous ?",
        options: budgetOptions,
        allowCustom: true,
      },
      apply: (value) => [
        profile,
        { ...need, maxMonthlyMinor: value === "none" ? null : Number(value) * 100 },
      ],
    });

  // The first question whose possible answers lead to different first three results.
  const top = (list: RankedProduct[]) =>
    list
      .slice(0, 3)
      .map((item) => `${item.productKey}|${item.variant ?? ""}`)
      .sort()
      .join(",");
  let question: SupplementaryAssistantQuestion | null = null;
  if (understood)
    for (const candidate of candidates) {
      const outcomes = new Set([top(ranked)]);
      for (const option of candidate.question.options)
        outcomes.add(top(rank(...candidate.apply(option.value))));
      if (outcomes.size > 1) {
        question = candidate.question;
        break;
      }
    }

  const reference = postal(profile.canton);
  const assumptions: string[] = [];
  if (birthYear === null)
    assumptions.push(
      child
        ? `Âge supposé de l’enfant : ${quoteYear - profile.birthYear} ans`
        : `Âge supposé : ${quoteYear - profile.birthYear} ans`,
    );
  if (sex === null) assumptions.push("Prix affichés en fourchette femme–homme");
  if (canton === null) assumptions.push(`Canton supposé : ${cantonNames[profile.canton]}`);
  assumptions.push(
    `Localité de référence des prix : ${reference.postalCode} ${reference.locality}`,
  );

  const results = ranked.slice(0, 8);
  return {
    engine,
    interpretation: {
      tags: need.tags,
      categories: need.categories,
      insurers: need.insurers,
      maxMonthlyMinor: need.maxMonthlyMinor,
    },
    profile: {
      year: quoteYear,
      birthYear: profile.birthYear,
      sex: profile.sex,
      canton: profile.canton,
    },
    assumptions,
    summary: summary(deps.index, need, ranked, profile.sex === null, understood),
    question,
    results: results.map((item) => ({
      productKey: item.productKey,
      variant: item.variant,
      monthlyMinor: item.monthlyMinor,
      score: item.score,
      matchedTags: item.matchedTags,
      reasons: item.reasons,
    })),
  };
}

function summary(
  index: CatalogIndex,
  need: Need,
  ranked: RankedProduct[],
  range: boolean,
  understood: boolean,
): string {
  if (!understood)
    return "Je n’ai pas reconnu de prestation précise. Décrivez votre besoin, par exemple « lunettes et dentaire » ou « hôpital demi-privé ».";
  if (!ranked.length) return "Aucun produit ne correspond à ces critères pour ce profil.";
  const first = ranked[0]!;
  const product = index.products.get(first.productKey)!;
  const variant = product.variants.find((item) => item.key === first.variant);
  const name = `${product.name}${variant ? ` (${variant.name})` : ""}, ${index.insurerNames.get(product.insurer) ?? product.insurer}`;
  const cost =
    first.monthlyMinor === null
      ? "prix sur demande"
      : `${range ? "dès " : ""}${chf(first.monthlyMinor)} par mois`;
  const labels = need.tags.map((tag) => index.tagLabels.get(tag)!).slice(0, 4);
  const subject = labels.length ? `pour ${labels.join(", ").toLowerCase()}` : "selon vos critères";
  const count = `${ranked.length} produit${ranked.length > 1 ? "s" : ""}`;
  if (need.maxMonthlyMinor !== null && ranked.every((item) => !item.withinBudget))
    return `Aucun produit ne tient dans un budget de ${chf(need.maxMonthlyMinor)} par mois ${subject} ; parmi les ${count} trouvés, en tête : ${name}, ${cost}.`;
  return `${count} ${subject} ; en tête : ${name}, ${cost}.`;
}
