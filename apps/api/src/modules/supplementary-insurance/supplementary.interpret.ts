import type {
  SupplementaryCanton,
  SupplementaryCatalog,
  SupplementarySex,
} from "@coverview/contracts/supplementary-insurance";
import {
  cantonWords,
  childWords,
  femaleWords,
  insurerWords,
  maleWords,
  supplementarySynonyms,
} from "./supplementary.synonyms.fr.js";

// What the assistant understood of a message, whatever the engine (OpenAI or rules).
export type Interpretation = {
  tags: string[];
  categories: string[];
  insurers: string[];
  maxMonthlyMinor: number | null;
  birthYear: number | null;
  sex: SupplementarySex | null;
  canton: SupplementaryCanton | null;
  // The person to insure is a child (son, daughter, baby…).
  child: boolean;
};
export const quoteYear = 2027;

const singular = (word: string) =>
  word.length > 4 && word.endsWith("aux")
    ? `${word.slice(0, -3)}al`
    : word.length > 3 && (word.endsWith("s") || word.endsWith("x"))
      ? word.slice(0, -1)
      : word;
export const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase();
const words = (value: string) =>
  fold(value)
    .split(/[^a-z0-9]+/u)
    .filter(Boolean)
    .map(singular);

type Entry = { words: string[]; tags: string[]; fallback: boolean };
const entries: Entry[] = supplementarySynonyms
  .flatMap((synonym) =>
    synonym.phrases.map((phrase) => ({
      words: words(phrase),
      tags: synonym.tags,
      fallback: synonym.fallback === true,
    })),
  )
  .sort((a, b) => b.words.length - a.words.length);
const byFirstWord = new Map<string, Entry[]>();
for (const entry of entries) {
  const first = entry.words[0]!;
  byFirstWord.set(first, [...(byFirstWord.get(first) ?? []), entry]);
}
const phraseSet = (list: string[]) => list.map(words);
const childPhrases = phraseSet(childWords);
const femalePhrases = phraseSet(femaleWords);
const malePhrases = phraseSet(maleWords);
function contains(tokens: string[], phrases: string[][]) {
  return phrases.some((phrase) =>
    tokens.some((_, start) => phrase.every((word, offset) => tokens[start + offset] === word)),
  );
}

const amount = String.raw`(\d{1,5}(?:[.,]\d{1,2})?)`;
const currency = String.raw`(?:chf|francs?|frs?\b|\.-|balles)`;
function budget(text: string): number | null {
  const patterns = [
    new RegExp(String.raw`budget\D{0,25}?${amount}(?!\s*ans?\b)(?!\d)`, "u"),
    new RegExp(
      String.raw`(?:max(?:imum)?|au plus|pas plus de|moins de|jusqu'?\s?a)\s*(?:de\s*)?${amount}\s*${currency}`,
      "u",
    ),
    new RegExp(String.raw`${amount}\s*${currency}`, "u"),
    new RegExp(String.raw`chf\s*${amount}`, "u"),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match?.[1]) continue;
    const [francs = "0", centimes = ""] = match[1].replace(",", ".").split(".");
    let minor = Number(francs) * 100 + Number(centimes.padEnd(2, "0"));
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 20);
    if (/(par an\b|\/\s?an\b|annuel|par annee)/u.test(after)) minor = Math.round(minor / 12);
    if (minor > 0 && minor <= 100_000_000) return minor;
  }
  return null;
}
function birthYear(text: string): number | null {
  const born = /\bnee?s?\s+(?:en|le\s+\d{1,2}[./]\d{1,2}[./])\s*(19\d\d|20[0-2]\d)\b/u.exec(text);
  if (born) return Number(born[1]);
  const year = /\b(?:naissance|annee)\D{0,12}(19\d\d|20[0-2]\d)\b/u.exec(text);
  if (year) return Number(year[1]);
  const age = /\b(\d{1,3})\s*ans?\b/u.exec(text);
  if (age && Number(age[1]) <= 110) return quoteYear - Math.max(1, Number(age[1]));
  return null;
}

// Rules engine: a hand-written French dictionary, accents, case and plural ignored.
export function interpretWithRules(message: string, catalog: SupplementaryCatalog): Interpretation {
  const tokens = words(message);
  const used = new Array<boolean>(tokens.length).fill(false);
  const found: Entry[] = [];
  for (let i = 0; i < tokens.length;) {
    const match = (byFirstWord.get(tokens[i]!) ?? []).find((entry) =>
      entry.words.every((word, offset) => tokens[i + offset] === word && !used[i + offset]),
    );
    if (!match) {
      i += 1;
      continue;
    }
    for (let offset = 0; offset < match.words.length; offset += 1) used[i + offset] = true;
    found.push(match);
    i += match.words.length;
  }
  const known = new Set(catalog.tags.map((tag) => tag.key));
  const family = new Map(catalog.tags.map((tag) => [tag.key, tag.family]));
  const tags: string[] = [];
  const add = (tag: string) => {
    if (known.has(tag) && !tags.includes(tag)) tags.push(tag);
  };
  for (const entry of found) if (!entry.fallback) entry.tags.forEach(add);
  const families = new Set(tags.map((tag) => family.get(tag)));
  for (const entry of found)
    if (entry.fallback) for (const tag of entry.tags) if (!families.has(family.get(tag))) add(tag);

  const child = contains(tokens, childPhrases);
  const female = contains(tokens, femalePhrases),
    male = contains(tokens, malePhrases);
  // "Mon fils" names the person to insure, even if the writer says she is a woman.
  const childSex = contains(tokens, phraseSet(["fils", "garcon", "petit fils"]))
    ? "male"
    : contains(tokens, phraseSet(["fille", "petite fille"]))
      ? "female"
      : null;
  const sex = childSex ?? (female === male ? null : female ? "female" : "male");
  const folded = fold(message);
  const cantons = (Object.keys(cantonWords) as SupplementaryCanton[]).filter(
    (code) =>
      contains(tokens, phraseSet(cantonWords[code]!)) ||
      new RegExp(String.raw`(?:^|[^A-Za-z])${code}(?:$|[^A-Za-z])`, "u").test(message),
  );
  const insurerKeys = new Set(catalog.insurers.map((insurer) => insurer.key));
  const insurers = Object.entries(insurerWords)
    .filter(([key, list]) => insurerKeys.has(key) && contains(tokens, phraseSet(list)))
    .map(([key]) => key);
  return {
    tags,
    categories: [],
    insurers,
    maxMonthlyMinor: budget(folded),
    birthYear: birthYear(folded),
    sex,
    canton: cantons.length === 1 ? cantons[0]! : null,
    child,
  };
}
