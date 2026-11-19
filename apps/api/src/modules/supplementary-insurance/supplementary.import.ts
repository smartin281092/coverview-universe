import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";
import { z } from "zod";
import {
  supplementaryCatalogSchema,
  type SupplementaryCatalog,
  type SupplementaryProduct,
} from "@coverview/contracts/supplementary-insurance";
import { assertLocalDatabase, loadEnvironment } from "../../platform/config.js";
import { createDatabase } from "../../platform/db/database.js";
import { publicNote } from "./supplementary.notes.js";

// Import of the supplementary insurance survey (19 November 2026): builds the public catalogue
// from insurers/*.json and taxonomy.json, and the premiums from premiums/*.csv.gz, as
// scripts/supplementary-insurance-build.py attaches them. Idempotent: the catalogue id is a
// fingerprint of the whole content, so an identical import changes nothing.

// Agreements with CoverView (supplementary.partner.1, user decision of 19 November 2026): every
// insurer of the survey is a partner through the convention with the Mendes agency.
const partners = new Set([
  "assura",
  "atupri",
  "axa",
  "concordia",
  "css",
  "groupe-mutuel",
  "helsana",
  "kpt",
  "sanitas",
  "swica",
  "sympany",
  "visana",
]);
// Basic-insurance company (BAG id) whose logo the site shows; Groupe Mutuel = Avenir (343).
const bagInsurerIds: Record<string, number | null> = {
  css: 8,
  concordia: 290,
  atupri: 312,
  kpt: 376,
  sympany: 509,
  swica: 1384,
  sanitas: 1509,
  assura: 1542,
  visana: 1555,
  helsana: 1562,
  axa: null,
  "groupe-mutuel": 343,
};
// The six reference localities of the survey, one per French-speaking canton.
const supplementaryLocalities = [
  { canton: "VD", postalCode: "1003", locality: "Lausanne" },
  { canton: "GE", postalCode: "1204", locality: "Genève" },
  { canton: "FR", postalCode: "1700", locality: "Fribourg" },
  { canton: "VS", postalCode: "1950", locality: "Sion" },
  { canton: "NE", postalCode: "2000", locality: "Neuchâtel" },
  { canton: "JU", postalCode: "2800", locality: "Delémont" },
] as const;
const otherFamily = { key: "other", label: "Autres prestations" };
// Published prices kept per product: the profiles closest to the default one (37 years old).
const publishedPriceLimit = 60;
const defaultAge = 37;

const nullableText = z.string().nullable().optional();
const taxonomySchema = z.object({
  productCategories: z.array(z.object({ key: z.string(), label: z.string() })),
  families: z.array(z.object({ key: z.string(), label: z.string() })),
  tags: z.array(z.object({ key: z.string(), family: z.string(), label: z.string() })),
});
const sourceSchema = z.object({
  insurer: z.object({
    key: z.string(),
    name: z.string(),
    website: nullableText,
    calculatorUrl: nullableText,
  }),
  retrievedAt: z.iso.date(),
  products: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      category: z.string(),
      audience: nullableText,
      summary: nullableText,
      variants: z
        .array(z.object({ key: z.string(), name: z.string(), description: nullableText }))
        .nullable()
        .optional(),
      prerequisites: nullableText,
      pricing: z
        .object({
          factors: z.array(z.string()).nullable().optional(),
          ageBands: nullableText,
          discounts: nullableText,
          publishedPrices: z
            .array(
              z.object({
                profile: nullableText,
                birthYear: z.number().int().nullable().optional(),
                age: z.number().nullable().optional(),
                ageBand: nullableText,
                monthlyChf: z.number().nullable().optional(),
                year: z.number().int().nullable().optional(),
                sourceUrl: nullableText,
              }),
            )
            .nullable()
            .optional(),
        })
        .nullable()
        .optional(),
      sourceUrls: z.array(z.string()).nullable().optional(),
      conditionsDoc: z
        .object({ title: nullableText, edition: nullableText, url: nullableText })
        .nullable()
        .optional(),
      benefits: z.array(
        z.object({
          tags: z.array(z.string()).min(1),
          label: z.string(),
          variant: nullableText,
          coverage: nullableText,
          ratePercent: z.number().nullable().optional(),
          maxAmountChf: z.number().nullable().optional(),
          maxPeriod: nullableText,
          unlimited: z.boolean().nullable().optional(),
          waitingPeriod: nullableText,
          conditions: nullableText,
          sourceUrl: nullableText,
        }),
      ),
    }),
  ),
});
const productMapSchema = z.record(z.string(), z.unknown());
const premiumColumns = [
  "insurer",
  "product_key",
  "product_name",
  "variant",
  "option",
  "year",
  "birth_year",
  "sex",
  "postal_code",
  "accident",
  "monthly_chf",
  "source_type",
  "notes",
] as const;

type PremiumRow = {
  insurer: string;
  productKey: string;
  variant: string;
  option: string;
  birthYear: number;
  sex: "female" | "male";
  postalCode: string;
  accident: boolean | null;
  monthlyMinor: number;
  note: string | null;
};

const validUrl = (value: string | null | undefined) =>
  value && URL.canParse(value) && /^https?:$/u.test(new URL(value).protocol) && value.length <= 600
    ? value
    : null;
const text = (value: string | null | undefined, max: number) => (value ?? "").trim().slice(0, max);
const optional = (value: string | null | undefined, max: number) => {
  const trimmed = text(value, max);
  return trimmed ? trimmed : null;
};
const minorFromChf = (value: number) => Math.round(value * 100);
// "31.30" → 3130 without floating point (DATA-11).
function minorFromText(value: string): number {
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/u.exec(value.trim());
  if (!match) throw new Error(`SUPPLEMENTARY_IMPORT_PREMIUM_UNREADABLE:${value}`);
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

// RFC 4180 line of the survey files (quoted fields, doubled quotes; no newline inside a field).
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "",
    quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      fields.push(field);
      field = "";
    } else field += char;
  }
  if (quoted) throw new Error("SUPPLEMENTARY_IMPORT_CSV_UNBALANCED");
  fields.push(field);
  return fields;
}

function ageDistance(
  price: {
    birthYear?: number | null | undefined;
    age?: number | null | undefined;
    ageBand?: string | null | undefined;
  },
  year: number,
) {
  const age =
    typeof price.age === "number"
      ? price.age
      : typeof price.birthYear === "number"
        ? year - price.birthYear
        : null;
  if (age !== null) return Math.abs(age - defaultAge);
  const band = /(\d{1,3})\s*[-–]\s*(\d{1,3})/u.exec(price.ageBand ?? "");
  if (!band) return 1000;
  const low = Number(band[1]),
    high = Number(band[2]);
  return defaultAge < low ? low - defaultAge : defaultAge > high ? defaultAge - high : 0;
}

async function readPremiums(
  root: URL,
  year: number,
  productMap: Record<string, unknown>,
  known: Map<string, string>,
) {
  const directory = new URL("premiums/", root);
  const files = (await readdir(directory)).filter((name) => name.endsWith(".csv.gz")).sort();
  const postalCodes = new Set<string>(supplementaryLocalities.map((item) => item.postalCode));
  const rows: PremiumRow[] = [];
  const excluded = { notCalculator: 0, withoutProduct: 0, familyTariff: 0 };
  for (const file of files) {
    const insurer = file.split(".")[0]!;
    const map = z.record(z.string(), z.string()).catch({}).parse(productMap[insurer]);
    const lines = gunzipSync(await readFile(new URL(file, directory)))
      .toString("utf8")
      .split("\n")
      .filter((line) => line.length > 0);
    const header = splitCsvLine(lines[0] ?? "");
    const index = Object.fromEntries(premiumColumns.map((name) => [name, header.indexOf(name)]));
    if (Object.values(index).some((position) => position < 0))
      throw new Error(`SUPPLEMENTARY_IMPORT_COLUMNS_MISSING:${file}`);
    const field = (fields: string[], name: (typeof premiumColumns)[number]) =>
      fields[index[name]!] ?? "";
    // First pass: rows kept, with the calculator's product name to separate sub-products.
    const kept: Array<PremiumRow & { name: string }> = [];
    for (const line of lines.slice(1)) {
      if (line.length > 4000) throw new Error("SUPPLEMENTARY_IMPORT_LINE_TOO_LONG");
      const fields = splitCsvLine(line);
      if (field(fields, "source_type") !== "official_calculator") {
        excluded.notCalculator += 1;
        continue;
      }
      const name = field(fields, "product_name");
      const productKey = field(fields, "product_key") || map[name] || "";
      if (!productKey) {
        excluded.withoutProduct += 1;
        continue;
      }
      const notes = field(fields, "notes");
      // Family tariffs that the calculator does not show to a single person (Groupe Mutuel).
      if (notes.includes("api_only_not_displayed_single_person")) {
        excluded.familyTariff += 1;
        continue;
      }
      if (known.get(productKey) !== insurer)
        throw new Error(`SUPPLEMENTARY_IMPORT_PRODUCT_UNKNOWN:${insurer}/${productKey}`);
      const sex = field(fields, "sex");
      const postalCode = field(fields, "postal_code");
      const accident = field(fields, "accident");
      if (
        Number(field(fields, "year")) !== year ||
        !["f", "m"].includes(sex) ||
        !postalCodes.has(postalCode) ||
        !["true", "false", ""].includes(accident)
      )
        throw new Error(`SUPPLEMENTARY_IMPORT_ROW_INVALID:${insurer}/${productKey}`);
      kept.push({
        insurer,
        productKey,
        name,
        variant: field(fields, "variant").trim().slice(0, 200),
        option: field(fields, "option").trim().slice(0, 200),
        birthYear: Number(field(fields, "birth_year")),
        sex: sex === "f" ? "female" : "male",
        postalCode,
        accident: accident === "" ? null : accident === "true",
        monthlyMinor: minorFromText(field(fields, "monthly_chf")),
        note: publicNote(notes),
      });
    }
    // Several calculator products under one product key and the same variant (DIMA death and
    // disability, Hospita divisions…): the calculator's product name then leads the variant.
    const slot = (row: PremiumRow) =>
      [
        row.productKey,
        row.variant,
        row.option,
        row.birthYear,
        row.sex,
        row.postalCode,
        row.accident,
      ].join("|");
    const names = new Map<string, Set<string>>();
    for (const row of kept) {
      const key = slot(row);
      names.set(key, (names.get(key) ?? new Set()).add(row.name));
    }
    const split = new Set<string>();
    for (const [key, set] of names) if (set.size > 1) split.add(key.split("|")[0]!);
    const seen = new Map<string, number>();
    for (const { name, ...row } of kept) {
      if (split.has(row.productKey))
        row.variant = (row.variant ? `${name} · ${row.variant}` : name).slice(0, 200);
      const key = slot(row);
      const previous = seen.get(key);
      if (previous !== undefined) {
        if (previous !== row.monthlyMinor)
          throw new Error(`SUPPLEMENTARY_IMPORT_PREMIUM_CONFLICT:${row.productKey}`);
        continue;
      }
      seen.set(key, row.monthlyMinor);
      rows.push(row);
    }
  }
  return { rows, excluded };
}

export async function buildSupplementaryData(root: URL, year: number) {
  const taxonomy = taxonomySchema.parse(
    JSON.parse(await readFile(new URL("taxonomy.json", root), "utf8")),
  );
  const tagFamily = new Map(taxonomy.tags.map((tag) => [tag.key, tag.family]));
  const tagOrder = new Map(taxonomy.tags.map((tag, position) => [tag.key, position]));
  const familyOrder = new Map(taxonomy.families.map((family, position) => [family.key, position]));
  const categories = new Set(taxonomy.productCategories.map((category) => category.key));
  const files = (await readdir(new URL("insurers/", root)))
    .filter((name) => name.endsWith(".json"))
    .sort();
  const sources = await Promise.all(
    files.map(async (name) =>
      sourceSchema.parse(JSON.parse(await readFile(new URL(`insurers/${name}`, root), "utf8"))),
    ),
  );
  const known = new Map<string, string>();
  for (const source of sources)
    for (const product of source.products) {
      if (known.has(product.key))
        throw new Error(`SUPPLEMENTARY_IMPORT_PRODUCT_DUPLICATE:${product.key}`);
      known.set(product.key, source.insurer.key);
    }
  const productMap = productMapSchema.parse(
    JSON.parse(await readFile(new URL("premiums/product-map.json", root), "utf8")),
  );
  const { rows, excluded } = await readPremiums(root, year, productMap, known);
  const priced = new Set(rows.map((row) => row.productKey));

  // Tags without equivalent in the taxonomy ("other:…") take the insurer's first wording.
  const otherTags = new Map<string, string>();
  for (const source of sources)
    for (const product of source.products)
      for (const benefit of product.benefits)
        for (const tag of benefit.tags) {
          if (!tag.startsWith("other:") && !tagFamily.has(tag))
            throw new Error(`SUPPLEMENTARY_IMPORT_TAG_UNKNOWN:${product.key}/${tag}`);
          if (tag.startsWith("other:") && !otherTags.has(tag))
            otherTags.set(tag, text(benefit.label, 160) || tag);
        }
  const tagSort = (a: string, b: string) =>
    (tagOrder.get(a) ?? 10_000) - (tagOrder.get(b) ?? 10_000) || a.localeCompare(b);

  const products: SupplementaryProduct[] = [];
  for (const source of sources)
    for (const product of source.products) {
      if (!categories.has(product.category))
        throw new Error(`SUPPLEMENTARY_IMPORT_CATEGORY_UNKNOWN:${product.key}`);
      const usedIds = new Set<string>();
      const benefits = product.benefits.map((benefit) => {
        const base =
          "b_" +
          createHash("sha256")
            .update(
              JSON.stringify([
                product.key,
                benefit.variant ?? null,
                benefit.tags,
                benefit.label,
                benefit.coverage ?? "",
              ]),
            )
            .digest("hex")
            .slice(0, 20);
        let id = base;
        for (let n = 2; usedIds.has(id); n += 1) id = `${base}_${n}`;
        usedIds.add(id);
        return {
          id,
          tags: benefit.tags.slice(0, 8),
          label: text(benefit.label, 400),
          variant: optional(benefit.variant, 120),
          coverage: text(benefit.coverage, 1200),
          ratePercent: benefit.ratePercent ?? null,
          maxAmountMinor:
            typeof benefit.maxAmountChf === "number" ? minorFromChf(benefit.maxAmountChf) : null,
          maxPeriod: optional(benefit.maxPeriod, 40),
          unlimited: benefit.unlimited === true,
          waitingPeriod: optional(benefit.waitingPeriod, 400),
          conditions: optional(benefit.conditions, 2000),
          sourceUrl: validUrl(benefit.sourceUrl),
        };
      });
      const tags = [...new Set(benefits.flatMap((benefit) => benefit.tags))].sort(tagSort);
      const families = [...new Set(tags.map((tag) => tagFamily.get(tag) ?? otherFamily.key))].sort(
        (a, b) => (familyOrder.get(a) ?? 1000) - (familyOrder.get(b) ?? 1000),
      );
      const published = (product.pricing?.publishedPrices ?? []).map((price, position) => ({
        position,
        distance: ageDistance(price, year),
        value: {
          profile: text(price.profile, 600),
          monthlyMinor:
            typeof price.monthlyChf === "number" ? minorFromChf(price.monthlyChf) : null,
          year: price.year ?? null,
          sourceUrl: validUrl(price.sourceUrl),
        },
      }));
      const publishedPrices = published
        .toSorted((a, b) => a.distance - b.distance || a.position - b.position)
        .slice(0, publishedPriceLimit)
        .sort((a, b) => a.position - b.position)
        .map((item) => item.value);
      products.push({
        key: product.key,
        insurer: source.insurer.key,
        name: text(product.name, 300),
        category: product.category,
        audience: optional(product.audience, 40),
        summary: text(product.summary, 2000),
        variants: (product.variants ?? []).map((variant) => ({
          key: text(variant.key, 120),
          name: text(variant.name, 200),
          description: text(variant.description, 1200),
        })),
        prerequisites: optional(product.prerequisites, 2000),
        factors: (product.pricing?.factors ?? []).map((factor) => text(factor, 80)).slice(0, 20),
        ageBands: optional(product.pricing?.ageBands, 2000),
        discounts: optional(product.pricing?.discounts, 3000),
        conditionsDoc: product.conditionsDoc
          ? {
              title: text(product.conditionsDoc.title, 400),
              edition: text(product.conditionsDoc.edition, 120),
              url: validUrl(product.conditionsDoc.url),
            }
          : null,
        sourceUrls: [
          ...new Set((product.sourceUrls ?? []).map(validUrl).filter((url) => url !== null)),
        ].slice(0, 40),
        tags,
        families,
        benefits,
        publishedPrices,
        priced: priced.has(product.key),
      });
    }

  const content: Omit<SupplementaryCatalog, "id"> = {
    year,
    retrievedAt:
      sources
        .map((source) => source.retrievedAt)
        .sort()
        .at(-1) ?? `${year - 1}-01-01`,
    insurers: sources.map((source) => ({
      key: source.insurer.key,
      name: text(source.insurer.name, 120),
      partner: partners.has(source.insurer.key),
      website: validUrl(source.insurer.website),
      calculatorUrl: validUrl(source.insurer.calculatorUrl),
      bagInsurerId: bagInsurerIds[source.insurer.key] ?? null,
    })),
    categories: taxonomy.productCategories,
    families: [...taxonomy.families, ...(otherTags.size ? [otherFamily] : [])],
    tags: [
      ...taxonomy.tags,
      ...[...otherTags]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, label]) => ({ key, family: otherFamily.key, label })),
    ],
    products,
    localities: [...supplementaryLocalities],
  };
  const hash = createHash("sha256").update(JSON.stringify(content));
  for (const row of rows) hash.update(JSON.stringify(row));
  const catalog = supplementaryCatalogSchema.parse({
    id: `slc_${year}_${hash.digest("hex").slice(0, 24)}`,
    ...content,
  });
  return { catalog, premiums: rows, excluded };
}

function summary(
  data: Awaited<ReturnType<typeof buildSupplementaryData>>,
  created: boolean | null,
) {
  return {
    id: data.catalog.id,
    created,
    insurers: data.catalog.insurers.length,
    products: data.catalog.products.length,
    priced: data.catalog.products.filter((product) => product.priced).length,
    benefits: data.catalog.products.reduce((sum, product) => sum + product.benefits.length, 0),
    premiums: data.premiums.length,
    excluded: data.excluded,
  };
}

// Writes one catalogue and its premiums in one transaction, under an advisory lock. A catalogue
// already present (same fingerprint) is left as it is: no duplicate premium.
export async function writeSupplementaryData(
  pool: ReturnType<typeof createDatabase>["pool"],
  data: Awaited<ReturnType<typeof buildSupplementaryData>>,
) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      `supplementary-${data.catalog.year}-import`,
    ]);
    const created = await client.query(
      "insert into supplementary_catalogs(id,year,data) values($1,$2,$3::jsonb) on conflict(id) do nothing",
      [data.catalog.id, data.catalog.year, JSON.stringify(data.catalog)],
    );
    if (created.rowCount) {
      for (let start = 0; start < data.premiums.length; start += 4000) {
        const batch = data.premiums.slice(start, start + 4000).map((row) => ({
          catalog_id: data.catalog.id,
          insurer: row.insurer,
          product_key: row.productKey,
          variant: row.variant,
          option: row.option,
          birth_year: row.birthYear,
          sex: row.sex,
          postal_code: row.postalCode,
          accident: row.accident,
          monthly_minor: row.monthlyMinor,
          note: row.note,
        }));
        await client.query(
          `insert into supplementary_premiums(catalog_id,insurer,product_key,variant,option,birth_year,sex,postal_code,accident,monthly_minor,note)
           select catalog_id,insurer,product_key,variant,option,birth_year,sex,postal_code,accident,monthly_minor,note
           from jsonb_populate_recordset(null::supplementary_premiums,$1::jsonb)`,
          [JSON.stringify(batch)],
        );
      }
    }
    await client.query("commit");
    return summary(data, Boolean(created.rowCount));
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function importSupplementaryCatalog(root: URL, year: number, validateOnly = false) {
  const data = await buildSupplementaryData(root, year);
  if (validateOnly) return summary(data, null);
  const config = loadEnvironment();
  assertLocalDatabase(config);
  const database = createDatabase({ ...config, DEPENDENCY_TIMEOUT_MS: 120000 });
  database.pool.on("error", () => process.stderr.write("Supplementary database unavailable\n"));
  try {
    return await writeSupplementaryData(database.pool, data);
  } finally {
    await database.pool.end();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const yearArgument = process.argv.indexOf("--year");
  const year = z
    .literal(2027)
    .parse(yearArgument < 0 ? 2027 : Number(process.argv[yearArgument + 1]));
  const root = new URL(`../../../../../data/supplementary-insurance/${year}/`, import.meta.url);
  process.stdout.write(
    JSON.stringify(
      await importSupplementaryCatalog(root, year, process.argv.includes("--validate")),
    ) + "\n",
  );
}
