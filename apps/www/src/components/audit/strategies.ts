/**
 * Catalogue des stratégies 3a de l’audit (4 novembre 2026). Les séries annuelles sont celles du
 * comparateur Horizon 3 (horizon3.finance, version Markdown et sources, revue des données du
 * 14 octobre 2026) : rendement de chaque année civile 2016–2026 en CHF, après les frais annuels
 * modélisés, avant retenues sur versements et fiscalité. La nature de chaque année est conservée :
 * performance publiée, proxy (fonds ou panier comparable), simulation du fournisseur, donnée
 * initiale non revérifiée, rendement communiqué, ou hypothèse. Les modèles de versements des
 * assurances (prime de risque, réduction des premières années) suivent les mêmes fiches.
 * Ce ne sont ni des prévisions ni les rendements nets de tous les coûts d’un contrat individuel.
 */
export const FIRST_YEAR = 2016;
export const LAST_YEAR = 2026;
export const YEARS: readonly number[] = Array.from(
  { length: LAST_YEAR - FIRST_YEAR + 1 },
  (_, index) => FIRST_YEAR + index,
);

export type YearNature =
  "published" | "proxy" | "provider" | "legacy" | "communicated" | "assumption";
export type StrategyKind = "insurance" | "bank";

export type Strategy = {
  id: string;
  provider: string;
  name: string;
  kind: StrategyKind;
  /** Frais annuels modélisés par le comparateur, déjà déduits des rendements (information). */
  fee: number;
  /** Rendements annuels nets 2016 à 2026, en fraction (0.0977 = 9,77 %). */
  returns: readonly number[];
  natures: readonly YearNature[];
  /** Part des versements retenue chaque année de contrat (assurances), en fraction. */
  reduction: readonly number[];
  /** Stratégie CoverView. */
  coverview?: boolean;
};

const natureCodes: Record<string, YearNature> = {
  P: "published",
  X: "proxy",
  S: "provider",
  L: "legacy",
  C: "communicated",
  A: "assumption",
};
const natures = (codes: string): YearNature[] =>
  [...codes].map((code) => natureCodes[code] ?? "assumption");
const percent = (values: readonly number[]) => values.map((value) => value / 100);

/** Retenues d’une assurance type sur cinq ans (AXA, Groupe Mutuel, Zurich, Safe Plan chez Horizon 3). */
export const INSURANCE_REDUCTION: readonly number[] = [0.53, 0.53, 0.32, 0.27, 0.1];
const NO_REDUCTION: readonly number[] = [];

export const strategies: readonly Strategy[] = [
  {
    id: "prosperity",
    provider: "Liechtenstein Life",
    name: "Hyperion",
    kind: "insurance",
    fee: 0.0221,
    returns: percent([9.77, 14.57, -6.47, 38.63, 40.66, 28.71, -32.35, 42.6, 29.75, 23.68, 35.16]),
    natures: natures("LLLLLLLLLLC"),
    reduction: [0.67, 0.67, 0.67, 0.67, 0.67],
    coverview: true,
  },
  {
    id: "viac-global-100",
    provider: "VIAC",
    name: "VIAC Global 100",
    kind: "bank",
    fee: 0.0041,
    returns: percent([6, 19.1, -9.4, 25.2, 5.3, 20.8, -16.5, 8.7, 17, 12.2, 14.7]),
    natures: natures("SSPPPPPPPPP"),
    reduction: NO_REDUCTION,
  },
  {
    id: "frankly-extreme-95",
    provider: "Frankly",
    name: "Frankly Extreme 95 Index",
    kind: "bank",
    fee: 0.0043,
    returns: percent([4.69, 16.62, -8.85, 25.08, 8.14, 19.17, -17.8, 10.46, 14.1, 14.27, 11.2]),
    natures: natures("XXXXXPPPPPP"),
    reduction: NO_REDUCTION,
  },
  {
    id: "finpension-global-100",
    provider: "Finpension",
    name: "Finpension Global 100",
    kind: "bank",
    fee: 0.0039,
    returns: percent([4.33, 17.62, -8.68, 26.55, 5.82, 20.57, -17.54, 9.35, 14.66, 14.16, 12.99]),
    natures: natures("XXXXXPPPPPP"),
    reduction: NO_REDUCTION,
  },
  {
    id: "axa-global",
    provider: "AXA",
    name: "AXA Global",
    kind: "insurance",
    fee: 0.0189,
    returns: percent([4.8, 13.93, -11.93, 21.61, 9.6, 18.31, -19.76, 14.54, 14.2, 12.74, 8.65]),
    natures: natures("XXXXLPPPPPP"),
    reduction: INSURANCE_REDUCTION,
  },
  {
    id: "ubs-vitainvest-passive-100",
    provider: "UBS",
    name: "UBS VitaInvest Passive 100",
    kind: "bank",
    fee: 0.0043,
    returns: percent([4.01, 17.15, -8.97, 25.93, 6.39, 22.83, -16.1, 10.57, 13.38, 13.12, 11.2]),
    natures: natures("XXXXXXPPPLP"),
    reduction: NO_REDUCTION,
  },
  {
    id: "generali-multi-index-100",
    provider: "Generali",
    name: "Generali Multi Index 100",
    kind: "insurance",
    fee: 0.025,
    returns: percent([3.61, 13.75, -10.6, 19.83, 4.23, 12.51, -11.08, 3.06, 9.78, 16.9, 9.1]),
    natures: natures("XXXLPPPPPPP"),
    reduction: [1, 1],
  },
  {
    id: "helvetia-global-passive",
    provider: "Helvetia",
    name: "Helvetia Global Passive",
    kind: "insurance",
    fee: 0.013,
    returns: percent([8.77, 16.27, -8.94, 23.37, 4.38, 23.85, -18.23, 11.23, 26.52, 4.11, 13.82]),
    natures: natures("XXLLLLPPPPP"),
    reduction: [1, 1],
  },
  {
    id: "groupe-mutuel-variainvest-ambition",
    provider: "Groupe Mutuel",
    name: "VariaInvest Ambition",
    kind: "insurance",
    fee: 0.0189,
    returns: percent([0.33, 10.33, -12.66, 12.67, 1.27, 8.46, -17.34, 3.96, 12.38, 6.51, 8.4]),
    natures: natures("XXXXXXXPPPP"),
    reduction: INSURANCE_REDUCTION,
  },
  {
    id: "baloise-bvg-mix-40-r",
    provider: "Banque Bâloise",
    name: "Baloise BVG-Mix 40 Plus",
    kind: "bank",
    fee: 0.01,
    returns: percent([1.61, 7.68, -5.43, 14.78, 3.28, 8.84, -12.47, 4.96, 8.21, 6.71, 5.45]),
    natures: natures("XXXXXPPPPPP"),
    reduction: NO_REDUCTION,
  },
  {
    id: "baloise-bvg-mix-25-r",
    provider: "Banque Bâloise",
    name: "Baloise BVG-Mix 25 Plus",
    kind: "bank",
    fee: 0.0098,
    returns: percent([1.32, 4.85, -4.22, 10.67, 2.61, 5.35, -11.57, 4.7, 7.26, 4.43, 3.53]),
    natures: natures("XXXXXPPPPPP"),
    reduction: NO_REDUCTION,
  },
  {
    id: "zurich-capitalfund-swiss-dividend",
    provider: "Zurich",
    name: "CapitalFund Swiss Dividend",
    kind: "insurance",
    fee: 0.0189,
    returns: percent([-1.78, 14.85, -6.24, 31.12, 2.11, 21.55, -12.31, 7.82, 7.6, 16.32, 4.23]),
    natures: natures("PPPPPPPPPPP"),
    reduction: INSURANCE_REDUCTION,
  },
  {
    id: "helvetia-baloise-safe-plan-100",
    provider: "Helvetia",
    name: "Baloise Safe Plan 100",
    kind: "insurance",
    fee: 0.0189,
    returns: percent([-1.26, -1.05, -2.63, -0.63, -3.18, -1.34, -3.97, -1.99, -2.07, -1.4, -1.56]),
    natures: natures("XXXXXXXXXXX"),
    reduction: INSURANCE_REDUCTION,
  },
  // Compte 3a rémunéré : hypothèse de 0,5 % par an, sans dispersion, pour un placement non investi.
  {
    id: "compte-3a",
    provider: "Compte 3a",
    name: "Compte d’épargne 3a",
    kind: "bank",
    fee: 0,
    returns: YEARS.map(() => 0.005),
    natures: natures("AAAAAAAAAAA"),
    reduction: NO_REDUCTION,
  },
];

export const HYPERION_ID = "prosperity";
export const ACCOUNT_ID = "compte-3a";
export const strategyById = (id: string) => strategies.find((strategy) => strategy.id === id);

/** Prestataires proposés dans le questionnaire ; `strategyId` est la stratégie de référence du catalogue. */
export type Provider = {
  id: string;
  label: string;
  kind: StrategyKind;
  strategyId?: string;
};
export const providers: readonly Provider[] = [
  { id: "axa", label: "AXA", kind: "insurance", strategyId: "axa-global" },
  { id: "pax", label: "Pax", kind: "insurance" },
  { id: "finpension", label: "Finpension", kind: "bank", strategyId: "finpension-global-100" },
  { id: "helvetia", label: "Helvetia", kind: "insurance", strategyId: "helvetia-global-passive" },
  { id: "ubs", label: "UBS", kind: "bank", strategyId: "ubs-vitainvest-passive-100" },
  { id: "swisslife", label: "Swiss Life", kind: "insurance" },
  { id: "viac", label: "VIAC", kind: "bank", strategyId: "viac-global-100" },
  { id: "generali", label: "Generali", kind: "insurance", strategyId: "generali-multi-index-100" },
  { id: "swissquote", label: "Swissquote", kind: "bank" },
  { id: "mobiliere", label: "La Mobilière", kind: "insurance" },
  { id: "raiffeisen", label: "Raiffeisen", kind: "bank" },
  {
    id: "groupe-mutuel",
    label: "Groupe Mutuel",
    kind: "insurance",
    strategyId: "groupe-mutuel-variainvest-ambition",
  },
  {
    id: "zurich",
    label: "Zurich",
    kind: "insurance",
    strategyId: "zurich-capitalfund-swiss-dividend",
  },
  { id: "liechtenstein-life", label: "Liechtenstein Life", kind: "insurance" },
  { id: "allianz", label: "Allianz", kind: "insurance" },
  { id: "retraites-populaires", label: "Retraites Populaires", kind: "insurance" },
  { id: "other-bank", label: "Une autre banque", kind: "bank" },
  { id: "other-insurance", label: "Une autre assurance", kind: "insurance" },
];
export const providerById = (id: string) => providers.find((provider) => provider.id === id);

/**
 * Profils de placement quand le prestataire n’a pas de stratégie de référence : chaque profil
 * emprunte une série du catalogue comme approximation, signalée comme telle dans les résultats.
 */
export type ProfileId = "hyperion" | "account" | "prudent" | "balanced" | "dynamic" | "unknown";
export const profileIds: readonly ProfileId[] = [
  "hyperion",
  "account",
  "prudent",
  "balanced",
  "dynamic",
  "unknown",
];
export function profileStrategyId(profile: ProfileId, kind: StrategyKind): string {
  switch (profile) {
    case "hyperion":
      return HYPERION_ID;
    case "account":
      return ACCOUNT_ID;
    case "prudent":
      return "baloise-bvg-mix-25-r";
    case "balanced":
      return "baloise-bvg-mix-40-r";
    case "dynamic":
      return "viac-global-100";
    default:
      return kind === "insurance" ? "baloise-bvg-mix-25-r" : "baloise-bvg-mix-40-r";
  }
}
