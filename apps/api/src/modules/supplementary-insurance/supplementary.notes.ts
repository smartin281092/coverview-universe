// Public remark of a premium (19 November 2026). The survey's `notes` column mixes technical
// identifiers (API codes, tariff ids) with facts a visitor needs. Only the recognized facts below
// become a short French remark; anything else is dropped, never shown raw.

type Rule = { test: RegExp; text: (match: RegExpExecArray) => string };

const chf = (raw: string) => {
  const [francs = "0", centimes = ""] = raw.split(".");
  return `CHF ${francs}.${centimes.padEnd(2, "0").slice(0, 2)}`;
};
const date = (iso: string) => {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
};

const rules: Rule[] = [
  {
    test: /firstYearDiscount.*price_from_(\d{4}-\d{2}-\d{2})=(\d+(?:\.\d+)?)/u,
    text: (m) => `1re année de vie gratuite, puis ${chf(m[2]!)} par mois dès le ${date(m[1]!)}`,
  },
  { test: /\bchild_free\b/u, text: () => "Gratuit jusqu’à 18 ans" },
  { test: /\bfree_per_calculator\b/u, text: () => "Gratuit selon le calculateur" },
  { test: /\bonline_discount_included=/u, text: () => "Rabais en ligne inclus" },
  { test: /\bdiscount_Child_included=/u, text: () => "Rabais enfant inclus" },
  {
    test: /\bthree_year_contract_price=(\d+(?:\.\d+)?)/u,
    text: (m) => `Avec un contrat de 3 ans : ${chf(m[1]!)} par mois`,
  },
  { test: /bonus de (\d+) ?% inclus/u, text: (m) => `Bonus de ${m[1]} % déjà déduit` },
  {
    test: /rabais sur les primes (\d+) ?% déjà déduit/u,
    text: (m) => `Rabais de ${m[1]} % déjà déduit`,
  },
  { test: /kinderjugendrabatt/u, text: () => "Rabais enfants et jeunes déduit" },
  { test: /\bvariable_premium_discount_included=/u, text: () => "Rabais variable déduit" },
  { test: /kombizuschlag/u, text: () => "Supplément de combinaison inclus" },
  {
    test: /affiché quand Mundo est combiné/u,
    text: () => "Prix avec Global smart, l’assurance hospitalisation ou Optimum",
  },
  {
    test: /montant journalier libre .* relevé pour (\d+) CHF\/jour/u,
    text: (m) => `Indemnité choisie : CHF ${m[1]} par jour`,
  },
  {
    test: /\bnot_selectable_alone\b/u,
    text: () => "Ne se conclut pas seule (avec Complementa Extra ou Natura)",
  },
  {
    test: /exige l’assurance de base VIVA de Visana|non affiché sans cette base/u,
    text: () => "Exige l’assurance de base VIVA de Visana",
  },
  {
    test: /\brequires_ambulatory_or_hospital_myflex\b/u,
    text: () => "Exige myFlex ambulatoire ou hospitalisation",
  },
  { test: /\brequires_one_of=/u, text: () => "Exige une complémentaire ambulatoire KPT" },
  {
    test: /\brequires_hospital_product\b/u,
    text: () => "Exige une assurance hospitalisation AXA",
  },
  { test: /\brequires=([^;|]+)/u, text: (m) => `Exige ${m[1]!.trim()}` },
  {
    test: /\brequires_another_product\b.*\bpriced_with=([^;|]+)/u,
    text: (m) => `Exige un autre produit (prix avec ${m[1]!.trim()})`,
  },
  {
    test: /couverture accident seul|\baccident_only_cover\b/u,
    text: () => "Couverture en cas d’accident seulement",
  },
  {
    test: /\bsum_insured_is_calculator_default_for_this_age\b/u,
    text: () => "Somme assurée par défaut du calculateur pour cet âge",
  },
  {
    test: /\bhidden_in_calculator_ui\b/u,
    text: () => "Produit masqué dans le calculateur public",
  },
  {
    test: /\bapi_only_not_in_public_ui\b/u,
    text: () => "Prix de l’assureur, produit absent du calculateur public",
  },
];

export function publicNote(raw: string): string | null {
  if (!raw) return null;
  const parts: string[] = [];
  for (const rule of rules) {
    const match = rule.test.exec(raw);
    if (!match) continue;
    const value = rule.text(match);
    if (!parts.includes(value)) parts.push(value);
  }
  // A product free until 18 is also "free per the calculator": say it once.
  const kept = parts.includes("Gratuit jusqu’à 18 ans")
    ? parts.filter((part) => part !== "Gratuit selon le calculateur")
    : parts;
  const note = kept.join(" · ");
  return note ? note.slice(0, 400) : null;
}
