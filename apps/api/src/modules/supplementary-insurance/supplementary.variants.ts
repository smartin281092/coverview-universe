import type { SupplementaryProduct } from "@coverview/contracts/supplementary-insurance";

// Calculators name their variants in their own words ("MI-PRIVÉE", "Choix du montant de la
// couverture 10'000"); the catalogue has its own keys ("mi-privee", "ortho10000"). A calculator
// variant belongs to the catalogue variant sharing the most words (numbers count more, a shared
// four-letter start counts less), then the fewest extra words; equally close variants all take it,
// no shared word leaves it unattributed. "Sans X" rules out the variants named with X.
const stopWords = new Set(
  "de la le les du des et en a au aux d l par max chf avec sans jour annee assurance".split(" "),
);
// Same ward under two names.
const synonyms: Record<string, string> = {
  generale: "commune",
  general: "commune",
  mi: "demi",
  semi: "demi",
};
function list(value: string): string[] {
  const normalized = value
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/(\d)['’ ](?=\d)/gu, "$1")
    .replace(/(\d+)\.\d\d\b/gu, "$1");
  return normalized
    .split(/[^a-z0-9]+/u)
    .filter(Boolean)
    .map((word) => synonyms[word] ?? word);
}
const words = (value: string) => new Set(list(value).filter((word) => !stopWords.has(word)));
const digits = (word: string) => /^\d+$/u.test(word);
// Same word, or same first four letters ("privée" / "privé", "monde" / "mondiale").
const close = (a: string, b: string) =>
  a === b ||
  (!digits(a) && !digits(b) && a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4));

export function createVariantMatcher() {
  const memo = new Map<string, string[]>();
  return function match(product: SupplementaryProduct, variant: string, option: string) {
    if (!product.variants.length) return [];
    const memoKey = JSON.stringify([product.key, variant, option]);
    const known = memo.get(memoKey);
    if (known) return known;
    const all = list(`${variant} ${option}`);
    const negated = all.filter((_, position) => all[position - 1] === "sans");
    const calculator = [...words(`${variant} ${option}`)].filter((word) => !negated.includes(word));
    const numbers = calculator.filter(digits);
    const scored = product.variants.map((candidate) => {
      // Parenthesized details ("(classe 2)") describe the variant, they do not name it.
      const own = [...words(`${candidate.name.replace(/\([^)]*\)/gu, " ")} ${candidate.key}`)];
      let score = 0;
      for (const word of calculator)
        if (own.includes(word)) score += digits(word) ? 3 : 2;
        else if (own.some((item) => close(item, word))) score += 1;
      const ownNumbers = own.filter(digits);
      if (numbers.length && ownNumbers.length && !ownNumbers.some((word) => numbers.includes(word)))
        score -= 3;
      const extra = own.filter((item) => !calculator.some((word) => close(item, word))).length;
      const excluded = negated.some((word) => own.some((item) => close(item, word)));
      const positions = calculator
        .map((word, position) => (own.some((item) => close(item, word)) ? position : -1))
        .filter((position) => position >= 0);
      return { key: candidate.key, score, extra, excluded, positions };
    });
    const allowed = scored.filter((item) => !item.excluded);
    if (allowed.length === 1 && allowed.length < scored.length) {
      memo.set(memoKey, [allowed[0]!.key]);
      return [allowed[0]!.key];
    }
    if (!allowed.length) {
      memo.set(memoKey, []);
      return [];
    }
    const best = allowed.reduce((a, b) =>
      b.score > a.score || (b.score === a.score && b.extra < a.extra) ? b : a,
    );
    // A tie goes to the variant named first ("Hospita Commune · PLUS Option privée" is the common
    // ward); variants named at the same place all take the price ("Division privée" for Europe and
    // world).
    const tied = allowed.filter((item) => item.score === best.score && item.extra === best.extra);
    const shared = tied.length
      ? tied[0]!.positions.filter((position) =>
          tied.every((item) => item.positions.includes(position)),
        )
      : [];
    const first = (item: (typeof tied)[number]) =>
      Math.min(Infinity, ...item.positions.filter((position) => !shared.includes(position)));
    const earliest = Math.min(...tied.map(first));
    const result =
      best.score > 0 ? tied.filter((item) => first(item) === earliest).map((item) => item.key) : [];
    memo.set(memoKey, result);
    return result;
  };
}
export type VariantMatcher = ReturnType<typeof createVariantMatcher>;
