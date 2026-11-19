import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";
import type { Pool } from "pg";
import {
  supplementaryCatalogSchema,
  type SupplementaryCatalog,
  type SupplementaryErrorCode,
  type SupplementaryQuote,
  type SupplementaryQuoteInput,
} from "@coverview/contracts/supplementary-insurance";
import { quoteYear } from "./supplementary.interpret.js";
import { quotePrices, type PremiumRecord } from "./supplementary.quote.js";
import { buildCatalogIndex, type CatalogIndex } from "./supplementary.ranking.js";

export class SupplementaryError extends Error {
  constructor(
    readonly code: SupplementaryErrorCode,
    readonly statusCode: number,
  ) {
    super(code);
  }
}

// The serialized catalogue (2.5 MB) and its compressed forms, made once per catalogue off the
// event loop: no proxy compresses the API's answers (PERF-02).
type Encoded = { json: string; br: Buffer; gzip: Buffer };
type Loaded = Encoded & { catalog: SupplementaryCatalog; index: CatalogIndex };
const brotli = promisify(brotliCompress);
const gzipped = promisify(gzip);
async function encode(catalog: SupplementaryCatalog): Promise<Encoded> {
  const json = JSON.stringify(catalog);
  const [br, gz] = await Promise.all([
    brotli(json, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }),
    gzipped(json, { level: 9 }),
  ]);
  return { json, br, gzip: gz };
}
// A new import is served within this delay; the catalogue itself is parsed once per id.
const recheckMs = 30_000;

export function createSupplementaryRepository(pool: Pool) {
  let cached: Loaded | null = null,
    checkedAt = 0,
    loading: Promise<Loaded> | null = null;

  async function load(): Promise<Loaded> {
    const latest = (
      await pool.query<{ id: string }>(
        "select id from supplementary_catalogs where year=$1 order by created_at desc, id desc limit 1",
        [quoteYear],
      )
    ).rows[0];
    if (!latest) throw new SupplementaryError("SUPPLEMENTARY_CATALOG_UNAVAILABLE", 503);
    if (cached?.catalog.id !== latest.id) {
      const row = (
        await pool.query<{ data: unknown }>("select data from supplementary_catalogs where id=$1", [
          latest.id,
        ])
      ).rows[0];
      const catalog = supplementaryCatalogSchema.parse(row?.data);
      cached = { catalog, ...(await encode(catalog)), index: buildCatalogIndex(catalog) };
    }
    checkedAt = Date.now();
    return cached;
  }
  async function current(): Promise<Loaded> {
    if (cached && Date.now() - checkedAt < recheckMs) return cached;
    loading ??= load().finally(() => {
      loading = null;
    });
    return loading;
  }

  async function premiums(
    catalogId: string,
    pairs: Array<{ birthYear: number; postalCode: string }>,
  ): Promise<PremiumRecord[]> {
    if (!pairs.length) return [];
    const result = await pool.query<{
      product_key: string;
      variant: string;
      option: string;
      birth_year: number;
      postal_code: string;
      sex: "female" | "male";
      accident: boolean | null;
      monthly_minor: number;
      note: string | null;
    }>(
      `select p.product_key,p.variant,p.option,p.birth_year,p.postal_code,p.sex,p.accident,p.monthly_minor,p.note
       from unnest($2::int[],$3::text[]) as wanted(birth_year,postal_code)
       join supplementary_premiums p on p.catalog_id=$1 and p.birth_year=wanted.birth_year and p.postal_code=wanted.postal_code
       limit 60000`,
      [catalogId, pairs.map((pair) => pair.birthYear), pairs.map((pair) => pair.postalCode)],
    );
    return result.rows.map((row) => ({
      productKey: row.product_key,
      variant: row.variant,
      option: row.option,
      birthYear: row.birth_year,
      postalCode: row.postal_code,
      sex: row.sex,
      accident: row.accident,
      monthlyMinor: row.monthly_minor,
      note: row.note,
    }));
  }

  async function quote(input: SupplementaryQuoteInput): Promise<SupplementaryQuote> {
    const { catalog } = await current();
    const reference = catalog.localities.find((locality) => locality.canton === input.canton);
    if (!reference) throw new SupplementaryError("SUPPLEMENTARY_CATALOG_UNAVAILABLE", 503);
    const rows = await premiums(catalog.id, [
      { birthYear: input.birthYear, postalCode: reference.postalCode },
    ]);
    return {
      year: quoteYear,
      birthYear: input.birthYear,
      age: quoteYear - input.birthYear,
      sex: input.sex,
      reference,
      prices: quotePrices(rows, input.birthYear, input.sex),
    };
  }

  return { current, premiums, quote };
}
export type SupplementaryRepository = ReturnType<typeof createSupplementaryRepository>;
