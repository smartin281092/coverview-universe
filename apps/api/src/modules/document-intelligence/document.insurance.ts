import { z } from "zod";
import {
  insuranceCompanyDetailsSchema,
  type DocumentAnalysis,
  type DocumentInsurance,
  type DocumentSource,
  type DocumentSummary,
  type InsuranceCompanyId,
  type InsuranceDomain,
  type InsuranceContract,
} from "@coverview/contracts";
import { referencedCompanyIds } from "./document.companies.js";
import { normalizeDocumentSearch } from "./document.search.js";

export const insuranceDomainLabels: Record<InsuranceDomain, string> = {
  motor: "Voiture",
  household: "Ménage",
  personal_liability: "Responsabilité civile",
  building: "Bâtiment",
  legal_protection: "Protection juridique",
  health: "Santé",
  accident: "Accidents",
  life: "Assurance vie",
  pension_3a: "Prévoyance 3A",
  pension_3b: "Prévoyance 3B",
  pension: "Prévoyance",
  travel: "Voyage",
  pet: "Animaux",
  other: "Assurance",
};
const domainPatterns: Partial<Record<InsuranceDomain, RegExp>> = {
  motor: /\b(?:assurance (?:auto(?:mobile)?|voiture|vehicules? a moteur)|vehicule assure)\b/u,
  household: /\b(?:assurance menage|inventaire du menage)\b/u,
  personal_liability: /\b(?:responsabilite civile privee|rc privee)\b/u,
  building: /\bassurance (?:batiment|immeuble)\b/u,
  legal_protection: /\bprotection juridique\b/u,
  health: /\b(?:assurance maladie|caisse maladie|lamal)\b/u,
  accident: /\bassurance accidents?\b/u,
  life: /\bassurance(?:\s*[- ]\s*| sur la )vie\b/u,
  pension_3a: /\b(?:(?:pilier|prevoyance(?: liee)?|assurance)\s*3\s*a|prosperity\s*3a)\b/u,
  pension_3b: /\b(?:(?:pilier|prevoyance(?: libre)?|assurance)\s*3\s*b|prosperity\s*3b)\b/u,
  pension: /\b(?:prevoyance|retraite|pension)\b/u,
  travel: /\bassurance voyage\b/u,
  pet: /\bassurance (?:animaux|animal|chien|chat)\b/u,
};
export function detectedInsuranceDomain(text: string): InsuranceDomain | null {
  const normalized = normalizeDocumentSearch(text);
  let domains = Object.entries(domainPatterns)
    .filter(([, pattern]) => pattern.test(normalized))
    .map(([domain]) => domain as InsuranceDomain);
  if (domains.some((domain) => domain === "pension_3a" || domain === "pension_3b"))
    domains = domains.filter((domain) => domain !== "life" && domain !== "pension");
  else if (domains.includes("life")) domains = domains.filter((domain) => domain !== "pension");
  return domains.length === 1 ? domains[0]! : null;
}
const emptyFacts = (): DocumentInsurance => ({
  companyId: null,
  companySource: null,
  domain: null,
  domainSource: null,
  policyNumber: null,
  insuredSubject: null,
  startsOn: null,
  endsOn: null,
  premium: null,
});
const money = "(?:[0-9]{1,3}(?:['’ ][0-9]{3})+|[0-9]+)(?:[.,][0-9]{2})?";
export function quotedPremium(
  text: string,
): Omit<NonNullable<DocumentInsurance["premium"]>, "source"> | null {
  const normalized = normalizeDocumentSearch(text).replaceAll("**", "").trim();
  const match = new RegExp(
    `^(?:prime(?: d'assurance)?(?: totale| annuelle| mensuelle| trimestrielle| semestrielle| unique)?|total des primes)\\s*:?\\s*(?:(CHF|EUR|USD)\\s*)?(${money})\\s*(CHF|EUR|USD)?(?:\\s|$)`,
    "iu",
  ).exec(normalized);
  if (!match || !(match[1] || match[3]) || (match[1] && match[3] && match[1] !== match[3]))
    return null;
  const amount = match[2]!.replace(/['’ ]/gu, "").replace(",", ".");
  const [units, cents = "00"] = amount.split(".");
  const minor = BigInt(units!) * 100n + BigInt(cents);
  if (minor > 100000000000n) return null;
  const periods = (
    [
      ["month", /\b(?:mensuell?e?s?|par mois)\b|\/\s*mois/u],
      ["quarter", /\b(?:trimestriell?e?s?|par trimestre)\b/u],
      ["half_year", /\b(?:semestriell?e?s?|par semestre)\b/u],
      ["year", /\b(?:annuell?e?s?|par an)\b|\/\s*an\b/u],
      ["once", /\bunique\b/u],
    ] as const
  ).filter(([, pattern]) => pattern.test(normalized));
  if (periods.length > 1) return null;
  return {
    amountMinor: Number(minor),
    currency: (match[1] || match[3])!.toUpperCase() as "CHF" | "EUR" | "USD",
    period: periods[0]?.[0] ?? "unknown",
  };
}
function isoDate(value: string) {
  const match = /^(\d{2})[./](\d{2})[./](\d{4})$/u.exec(value);
  const candidate = match ? `${match[3]}-${match[2]}-${match[1]}` : value;
  return z.iso.date().safeParse(candidate).success ? candidate : null;
}
export function insuranceFacts(
  analysis: Pick<DocumentAnalysis, "pages" | "insurance"> | null,
): DocumentInsurance {
  // An explicit structured null records abstention; do not overwrite it with a legacy guess.
  if (analysis && Object.hasOwn(analysis, "insurance")) return analysis.insurance ?? emptyFacts();
  const result = emptyFacts();
  const page = analysis?.pages[0];
  if (!page) return result;
  const text = page.text.slice(0, 12000);
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const source = (quote: string): DocumentSource => ({
    page: page.page,
    text: quote.slice(0, 1000),
    method: page.method,
    version: page.version,
    confidence: null,
    box: null,
  });
  const companies = referencedCompanyIds([text]);
  if (companies.length === 1) {
    result.companyId = companies[0]!;
    const line = lines.find((value) => referencedCompanyIds([value]).includes(result.companyId!));
    if (line) result.companySource = source(line);
  }
  // Prefer the prominent heading area; a document comparing two products remains ambiguous.
  result.domain = detectedInsuranceDomain(lines.slice(0, 40).join("\n"));
  if (result.domain) {
    const line = lines.find((value) => detectedInsuranceDomain(value) === result.domain);
    if (line) result.domainSource = source(line);
  }
  function labelled(
    pattern: RegExp,
    transform: (value: string) => string | null = (value) => value,
  ) {
    const found = lines.flatMap((line) => {
      const match = pattern.exec(line.replaceAll("**", ""));
      const value = match?.[1] ? transform(match[1].trim()) : null;
      return value && value.length <= 240 ? [{ value, source: source(line) }] : [];
    });
    return new Set(found.map((item) => item.value)).size === 1 ? found[0]! : null;
  }
  result.policyNumber = labelled(
    /^(?:numéro de (?:police|contrat)|(?:police|contrat)\s*(?:n[°ºo.]|numéro))\s*:?\s*([A-Z0-9][A-Z0-9 ./-]{1,79})$/iu,
  );
  result.insuredSubject = labelled(
    /^(?:personne assurée|objet assuré|véhicule assuré|adresse du (?:risque|bien assuré))\s*:\s*(.{2,240})$/iu,
  );
  const date = "(\\d{4}-\\d{2}-\\d{2}|\\d{2}[./]\\d{2}[./]\\d{4})";
  result.startsOn = labelled(
    new RegExp(
      `^(?:début (?:du contrat|de (?:la )?couverture|d'assurance)|prise d'effet)\\s*:\\s*${date}$`,
      "iu",
    ),
    isoDate,
  );
  result.endsOn = labelled(
    new RegExp(
      `^(?:fin (?:du contrat|de (?:la )?couverture|d'assurance)|échéance du contrat)\\s*:\\s*${date}$`,
      "iu",
    ),
    isoDate,
  );
  const premiums = lines.flatMap((line) => {
    const premium = quotedPremium(line);
    return premium ? [{ ...premium, source: source(line) }] : [];
  });
  if (
    new Set(
      premiums.map(({ amountMinor, currency, period }) =>
        JSON.stringify({ amountMinor, currency, period }),
      ),
    ).size === 1
  )
    result.premium = premiums[0]!;
  return result;
}

type Entry = { document: DocumentSummary; analysis: DocumentAnalysis | null };
function consensus<T>(values: (T | null)[]): T | null {
  const present = values.filter((value): value is T & {} => value !== null);
  return present.length && new Set(present.map((value) => JSON.stringify(value))).size === 1
    ? present[0]!
    : null;
}
export function companyOverview(companyId: InsuranceCompanyId, entries: Entry[], now = new Date()) {
  const related = entries.filter(({ document }) => document.companyId === companyId);
  const groups = new Map<string, Entry[]>();
  for (const entry of related) {
    if (
      entry.document.purpose === "lead_offer" ||
      entry.document.purpose === "partner_competence" ||
      entry.document.classification !== "insurance_policy"
    )
      continue;
    // An OCR category alone does not turn a quote/application into an issued policy.
    const header =
      entry.analysis?.pages[0]?.text.slice(0, 12000).split(/\r?\n/u).slice(0, 12).join("\n") ?? "";
    const heading = normalizeDocumentSearch(`${entry.analysis?.title ?? ""}\n${header}`);
    if (
      /\b(?:offre|proposition|demande|questionnaire|profil d.investisseur|contrat souhaite|modele|exemple)\b/u.test(
        heading,
      )
    )
      continue;
    if (
      !/^(?:[#*\s]*)(?:police|contrat)(?:\s+d.assurance|\s+assurance|\s+automobile|\s+de prevoyance)\b/mu.test(
        heading,
      )
    )
      continue;
    const facts = insuranceFacts(entry.analysis);
    if (/\bconditions (?:generales|particulieres)\b/u.test(heading) && !facts.policyNumber)
      continue;
    if (
      /^conditions (?:generales|particulieres)\b/u.test(
        normalizeDocumentSearch(entry.analysis?.title ?? ""),
      )
    )
      continue;
    const key = facts.policyNumber
      ? `policy:${normalizeDocumentSearch(facts.policyNumber.value).replace(/[^a-z0-9]/gu, "")}`
      : `file:${entry.document.checksum}`;
    const profileKey = `${entry.document.profileId ?? "self"}:${key}`;
    groups.set(profileKey, [...(groups.get(profileKey) ?? []), entry]);
  }
  const today = now.toISOString().slice(0, 10);
  const soon = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const contracts: InsuranceContract[] = [...groups.values()].map((group) => {
    const facts = group.map((entry) => insuranceFacts(entry.analysis));
    const startsOn = consensus(facts.map((fact) => fact.startsOn?.value ?? null));
    const endsOn = consensus(facts.map((fact) => fact.endsOn?.value ?? null));
    const contradictoryDates =
      ["startsOn", "endsOn"].some((field) => {
        const values = facts
          .map((fact) => fact[field as "startsOn" | "endsOn"]?.value)
          .filter(Boolean);
        return new Set(values).size > 1;
      }) || Boolean(startsOn && endsOn && startsOn > endsOn);
    const state = contradictoryDates
      ? "unknown"
      : endsOn && endsOn < today
        ? "expired"
        : startsOn && startsOn > today
          ? "upcoming"
          : startsOn && endsOn && startsOn <= today && today <= endsOn
            ? "active"
            : "unknown";
    return {
      id: group[0]!.document.id,
      profileId: group[0]!.document.profileId ?? "self",
      documentIds: group.map((entry) => entry.document.id),
      title: group[0]!.document.title ?? "Contrat d’assurance",
      domain: consensus(facts.map((fact) => fact.domain)),
      insuredSubject: consensus(facts.map((fact) => fact.insuredSubject?.value ?? null)),
      policyNumber: consensus(facts.map((fact) => fact.policyNumber?.value ?? null)),
      startsOn,
      endsOn,
      state,
      expiresSoon: state === "active" && !!endsOn && endsOn <= soon,
      optimization: "unknown",
      premium: consensus(
        facts.map((fact) =>
          fact.premium
            ? {
                amountMinor: fact.premium.amountMinor,
                currency: fact.premium.currency,
                period: fact.premium.period,
              }
            : null,
        ),
      ),
    };
  });
  const active = contracts.filter((contract) => contract.state === "active");
  const totals = new Map<"CHF" | "EUR" | "USD", number>();
  let included = 0;
  for (const contract of active) {
    const premium = contract.premium;
    // Without a policy identifier, two different scans cannot be safely deduplicated.
    if (
      !contract.policyNumber ||
      !premium ||
      premium.period === "once" ||
      premium.period === "unknown"
    )
      continue;
    const factor = { month: 12, quarter: 4, half_year: 2, year: 1 }[premium.period];
    totals.set(
      premium.currency,
      (totals.get(premium.currency) ?? 0) + premium.amountMinor * factor,
    );
    included += 1;
  }
  return insuranceCompanyDetailsSchema.parse({
    companyId,
    documents: related.map((entry) => entry.document),
    contracts,
    stats: {
      documentCount: related.length,
      contractCount: contracts.length,
      activeContractCount: active.length,
      expiredContractCount: contracts.filter((contract) => contract.state === "expired").length,
      unknownContractCount: contracts.filter((contract) => contract.state === "unknown").length,
      annualPremiumTotals: [...totals].map(([currency, amountMinor]) => ({
        currency,
        amountMinor,
      })),
      premiumCoverage: { included, total: active.length },
      incomplete:
        included !== active.length || contracts.some((contract) => contract.state === "unknown"),
    },
  });
}
