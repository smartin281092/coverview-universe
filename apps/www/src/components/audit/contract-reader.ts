/**
 * Lecture locale d’un contrat 3e pilier (4 novembre 2026) : le texte d’un PDF est extrait dans le
 * navigateur par pdf.js, chargé au choix du fichier, puis quelques repères y sont cherchés :
 * prestataire, versement mensuel, année de début, année de naissance. Rien ne quitte le
 * navigateur ; les valeurs trouvées sont proposées, jamais imposées.
 */
import { LAST_YEAR } from "./strategies";

export type ContractReading = {
  provider?: string;
  monthly?: number;
  startYear?: number;
  birthYear?: number;
};
export type ReadStatus = "ok" | "empty" | "image" | "too-big" | "failed";
const MAX_CONTRACT_BYTES = 20 * 1024 * 1024;

const providerPatterns: readonly [string, RegExp][] = [
  ["liechtenstein-life", /liechtenstein\s*life/iu],
  ["groupe-mutuel", /groupe\s*mutuel/iu],
  ["retraites-populaires", /retraites\s*populaires/iu],
  ["swisslife", /swiss\s*life/iu],
  ["finpension", /finpension/iu],
  ["swissquote", /swissquote/iu],
  ["raiffeisen", /raiffeisen/iu],
  ["mobiliere", /mobili[èe]re|mobiliar/iu],
  ["generali", /generali/iu],
  ["helvetia", /helvetia|b[âa]loise|baloise/iu],
  ["allianz", /allianz/iu],
  ["zurich", /\bzurich\b(?!\s*(?:,|\d))/iu],
  ["viac", /\bviac\b/iu],
  ["axa", /\baxa\b/iu],
  ["ubs", /\bubs\b/iu],
  ["pax", /\bpax\b/iu],
  [
    "other-bank",
    /frankly|kantonalbank|banque\s+cantonale|postfinance|migros\s*bank|credit\s*suisse|\bbcv\b|\bbcge\b/iu,
  ],
];

const amount = String.raw`(\d{1,3}(?:[’'\u202f\u00a0 .]\d{3})+|\d+)(?:[.,](\d{1,2}))?`;
const amountPattern = new RegExp(
  String.raw`(?:CHF|Fr\.?|francs?)\s*${amount}(?!\d)|${amount}\s*(?:CHF|Fr\.?|francs?)`,
  "giu",
);
const monthlyWords = /mois|mensuel|monat|monthly/iu;
const yearlyWords = /\ban\b|annuel|ann[ée]e|jahr|j[äa]hrlich|yearly|p\.\s?a\./iu;
const premiumWords = /prime|pr[äa]mie|versement|cotisation|beitrag|einlage|[ée]pargne|montant/iu;

const parseAmount = (integer: string, decimals?: string) =>
  Number(integer.replace(/[^\d]/gu, "") + (decimals ? `.${decimals}` : ""));

/** Repères extraits d’un texte de contrat ; chaque valeur n’est proposée que si elle est plausible. */
export function readContractText(text: string): ContractReading {
  const reading: ContractReading = {};
  const flat = text.replace(/\s+/gu, " ");
  let best: { id: string; count: number } | null = null;
  for (const [id, pattern] of providerPatterns) {
    const count = flat.match(new RegExp(pattern.source, "giu"))?.length ?? 0;
    if (count && (!best || count > best.count)) best = { id, count };
  }
  if (best) reading.provider = best.id;

  let bestAmount: { value: number; score: number } | null = null;
  for (const match of flat.matchAll(amountPattern)) {
    const value = parseAmount(match[1] ?? match[3] ?? "0", match[2] ?? match[4]);
    if (!Number.isFinite(value) || value < 20 || value > 600000) continue;
    const window = flat.slice(Math.max(0, match.index - 90), match.index + match[0].length + 60);
    const monthly = monthlyWords.test(window);
    const yearly = !monthly && yearlyWords.test(window);
    const premium = premiumWords.test(window);
    if (!monthly && !yearly) continue;
    const normalised = yearly ? value / 12 : value;
    if (normalised < 20 || normalised > 20000) continue;
    const score = (premium ? 2 : 0) + (monthly ? 1 : 0);
    if (!bestAmount || score > bestAmount.score)
      bestAmount = { value: Math.round(normalised), score };
  }
  if (bestAmount) reading.monthly = bestAmount.value;

  const start =
    /(?:d[ée]but(?:\s+du\s+contrat|\s+de\s+l[’']assurance)?|date\s+d[’']effet|prise\s+d[’']effet|entr[ée]e\s+en\s+vigueur|vertragsbeginn|versicherungsbeginn|beginn|inkrafttreten|valable\s+d[èe]s|g[üu]ltig\s+ab)\D{0,40}?(?:\d{1,2}[./]\d{1,2}[./])?((?:19|20)\d{2})/iu.exec(
      flat,
    );
  const startYear = start ? Number(start[1]) : NaN;
  if (startYear >= 1980 && startYear <= LAST_YEAR) reading.startYear = startYear;

  const birth =
    /(?:n[ée]e?\s*(?:\(e\))?\s*le|date\s+de\s+naissance|geburtsdatum|geboren\s+am)\D{0,20}?\d{1,2}[./]\d{1,2}[./]((?:19|20)\d{2})/iu.exec(
      flat,
    );
  const birthYear = birth ? Number(birth[1]) : NaN;
  if (birthYear >= LAST_YEAR - 85 && birthYear <= LAST_YEAR - 18) reading.birthYear = birthYear;
  return reading;
}

const hasValues = (reading: ContractReading) =>
  Object.values(reading).some((value) => value !== undefined);

/** Lit un fichier choisi par la personne, dans son navigateur seulement. */
export async function readContractFile(
  file: File,
): Promise<{ status: ReadStatus; reading?: ContractReading }> {
  if (file.size > MAX_CONTRACT_BYTES) return { status: "too-big" };
  const isPdf = file.type === "application/pdf" || /\.pdf$/iu.test(file.name);
  if (!isPdf) return { status: "image" };
  try {
    const [{ getDocument, GlobalWorkerOptions }, worker] = await Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]);
    GlobalWorkerOptions.workerSrc = worker.default;
    const data = await file.arrayBuffer();
    // Lecture locale sans scripts, formulaires ni ressources distantes.
    const loading = getDocument({
      data,
      useWorkerFetch: false,
      useWasm: false,
      useSystemFonts: true,
    });
    try {
      const pdf = await loading.promise;
      const pages = Math.min(pdf.numPages, 8);
      const chunks: string[] = [];
      for (let number = 1; number <= pages; number += 1) {
        const page = await pdf.getPage(number);
        const content = await page.getTextContent();
        chunks.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
      }
      const reading = readContractText(chunks.join("\n"));
      return hasValues(reading) ? { status: "ok", reading } : { status: "empty" };
    } finally {
      await loading.destroy();
    }
  } catch {
    return { status: "failed" };
  }
}
