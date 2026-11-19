import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";
import { gzipSync } from "node:zlib";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  supplementaryAssistantResultSchema,
  supplementaryCatalogSchema,
  supplementaryOrderReceiptSchema,
  supplementaryQuoteSchema,
  type SupplementaryAssistantInput,
} from "@coverview/contracts/supplementary-insurance";
import { isLoopback, parseEnvironment } from "../../platform/config.js";
import { createDatabase } from "../../platform/db/database.js";
import type { MailMessage } from "../../platform/mailer.js";
import { buildServer } from "../../platform/server.js";
import { runAssistant } from "./supplementary.assistant.js";
import { buildSupplementaryData, writeSupplementaryData } from "./supplementary.import.js";
import { interpretWithRules } from "./supplementary.interpret.js";
import { processSupplementaryOrders, receiveSupplementaryOrder } from "./supplementary.orders.js";
import { createSupplementaryRepository } from "./supplementary.repository.js";

// Real PostgreSQL (TEST-06): a Testcontainers database, or, where Docker is unavailable, a
// disposable loopback `coverview_test` database named by SUPPLEMENTARY_TEST_DATABASE_URL. Each run
// imports a fixture of its own (random nonce → new catalogue id), so nothing is ever dropped.
let stop: () => Promise<unknown> = () => Promise.resolve();
let uri = "";
let database: ReturnType<typeof createDatabase>;
let root: string;
const nonce = randomUUID();

const taxonomy = {
  productCategories: [
    { key: "ambulatory_bundle", label: "Complémentaire ambulatoire" },
    { key: "dental", label: "Soins dentaires" },
    { key: "hospital", label: "Hospitalisation" },
  ],
  families: [
    { key: "vision", label: "Vue" },
    { key: "dental", label: "Dentaire" },
    { key: "hospital", label: "Hospitalisation" },
  ],
  tags: [
    { key: "glasses_lenses", family: "vision", label: "Lunettes et lentilles de contact" },
    { key: "dental_treatment", family: "dental", label: "Traitements dentaires" },
    { key: "orthodontics", family: "dental", label: "Orthodontie" },
    { key: "hospital_semi_private", family: "hospital", label: "Division demi-privée (2 lits)" },
    { key: "hospital_private", family: "hospital", label: "Division privée (1 lit)" },
  ],
};
const benefit = (
  tags: string[],
  label: string,
  rate: number | null,
  max: number | null,
  variant: string | null = null,
) => ({
  tags,
  label,
  variant,
  coverage: `${rate ?? "—"} %, max. CHF ${max ?? "—"}`,
  ratePercent: rate,
  maxAmountChf: max,
  maxPeriod: "year",
  unlimited: false,
  waitingPeriod: null,
  conditions: null,
  sourceUrl: "https://example.test/conditions.pdf",
  verification: "read",
});
const product = (key: string, category: string, benefits: unknown[], variants: unknown[] = []) => ({
  key,
  name: key.toUpperCase(),
  category,
  audience: "all",
  summary: `Produit fictif ${nonce}`,
  variants,
  prerequisites: null,
  pricing: { factors: ["age", "sex"], ageBands: null, discounts: null, publishedPrices: [] },
  sourceUrls: ["https://example.test/product"],
  conditionsDoc: { title: "CGA", edition: "01.2027", url: "https://example.test/cga.pdf" },
  benefits,
});
const insurer = (key: string, name: string, products: unknown[]) => ({
  insurer: {
    key,
    name,
    website: `https://${key}.example.test/`,
    calculatorUrl: null,
    calculatorHosts: [],
    publishedTariffUrls: [],
    notes: null,
  },
  retrievedAt: "2026-11-18",
  products,
});
const header =
  "insurer,product_key,product_name,variant,option,year,birth_year,age,sex,postal_code,locality,accident,monthly_chf,source_type,source_url,retrieved_at,notes";
function line(fields: {
  insurer: string;
  key: string;
  name?: string;
  variant?: string;
  option?: string;
  year?: number;
  sex: "f" | "m";
  postal?: string;
  accident?: string;
  chf: string;
  source?: string;
  notes?: string;
}) {
  const quote = (value: string) =>
    /[",]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  return [
    fields.insurer,
    fields.key,
    fields.name ?? "Produit",
    fields.variant ?? "",
    fields.option ?? "",
    "2027",
    String(fields.year ?? 1990),
    String(2027 - (fields.year ?? 1990)),
    fields.sex,
    fields.postal ?? "1003",
    "Lausanne",
    fields.accident ?? "",
    fields.chf,
    fields.source ?? "official_calculator",
    "https://calculator.example.test/",
    "2026-11-18",
    quote(fields.notes ?? ""),
  ].join(",");
}

async function writeFixture() {
  root = await mkdtemp(join(tmpdir(), "supplementary-"));
  await mkdir(join(root, "insurers"));
  await mkdir(join(root, "premiums"));
  await writeFile(join(root, "taxonomy.json"), JSON.stringify(taxonomy));
  const glasses = (rate: number) => benefit(["glasses_lenses"], "Lunettes", rate, 200);
  await writeFile(
    join(root, "insurers", "assura.json"),
    JSON.stringify(
      insurer("assura", "Assura", [
        product("assura-one", "ambulatory_bundle", [
          glasses(90),
          benefit(["dental_treatment"], "Soins dentaires", 50, 1000),
          benefit(["other:test_extra"], "Prestation fictive", null, null),
        ]),
        product("assura-two", "ambulatory_bundle", [glasses(90)]),
        product(
          "assura-hospital",
          "hospital",
          [
            benefit(["hospital_semi_private"], "Demi-privée", 100, null, "semi"),
            benefit(["hospital_private"], "Privée", 100, null, "prive"),
          ],
          [
            { key: "semi", name: "Division demi-privée", description: "" },
            { key: "prive", name: "Division privée", description: "" },
          ],
        ),
      ]),
    ),
  );
  await writeFile(
    join(root, "insurers", "axa.json"),
    JSON.stringify(
      insurer("axa", "AXA", [
        product("axa-three", "ambulatory_bundle", [glasses(90)]),
        product("axa-four", "ambulatory_bundle", [glasses(90)]),
        product("axa-dental", "dental", [benefit(["orthodontics"], "Orthodontie", 75, 10000)]),
        product("axa-unpriced", "dental", [benefit(["orthodontics"], "Orthodontie", 50, 3000)]),
      ]),
    ),
  );
  await writeFile(
    join(root, "premiums", "product-map.json"),
    JSON.stringify({
      axa: { "Assurance dentaire": "axa-dental" },
      unmapped: { axa: { CAPITAL: "two keys" } },
    }),
  );
  const assura = [
    // Four products of equal score: female and male orders differ (the sex question matters).
    line({
      insurer: "assura",
      key: "assura-one",
      sex: "f",
      accident: "true",
      chf: "10.00",
      notes: "price=net+accident(1.00); online_discount_included=0.50",
    }),
    line({ insurer: "assura", key: "assura-one", sex: "f", accident: "false", chf: "9.00" }),
    line({ insurer: "assura", key: "assura-one", sex: "m", accident: "true", chf: "40.00" }),
    line({ insurer: "assura", key: "assura-one", sex: "m", accident: "false", chf: "39.00" }),
    line({
      insurer: "assura",
      key: "assura-two",
      sex: "f",
      chf: "20.00",
      notes: "three_year_contract_price=18.70",
    }),
    line({ insurer: "assura", key: "assura-two", sex: "m", chf: "20.00" }),
    line({
      insurer: "assura",
      key: "assura-hospital",
      variant: "Division demi-privée",
      sex: "f",
      chf: "50.00",
    }),
    line({
      insurer: "assura",
      key: "assura-hospital",
      variant: "Division demi-privée",
      sex: "m",
      chf: "55.00",
    }),
    line({
      insurer: "assura",
      key: "assura-hospital",
      variant: "Division privée",
      sex: "f",
      chf: "80.00",
    }),
    line({
      insurer: "assura",
      key: "assura-hospital",
      variant: "Division privée",
      sex: "m",
      chf: "90.00",
    }),
    // Geneva and a child.
    line({
      insurer: "assura",
      key: "assura-one",
      sex: "f",
      postal: "1204",
      year: 1960,
      accident: "true",
      chf: "61.00",
    }),
    line({
      insurer: "assura",
      key: "assura-one",
      sex: "m",
      postal: "1204",
      year: 1960,
      accident: "true",
      chf: "66.00",
    }),
    line({
      insurer: "assura",
      key: "assura-one",
      sex: "m",
      year: 2015,
      accident: "true",
      chf: "5.00",
    }),
    // Excluded: not from the calculator, and a family tariff.
    line({
      insurer: "assura",
      key: "assura-two",
      sex: "f",
      year: 1991,
      chf: "1.00",
      source: "official_published",
    }),
    line({
      insurer: "assura",
      key: "assura-two",
      sex: "f",
      year: 1992,
      chf: "1.00",
      notes: "api_only_not_displayed_single_person",
    }),
  ];
  const axa = [
    line({ insurer: "AXA", key: "axa-three", sex: "f", chf: "30.00" }),
    line({ insurer: "AXA", key: "axa-three", sex: "m", chf: "30.00" }),
    line({ insurer: "AXA", key: "axa-four", sex: "f", chf: "40.00" }),
    line({ insurer: "AXA", key: "axa-four", sex: "m", chf: "10.00" }),
    // Product key from product-map.json; CAPITAL has none and is left out.
    line({
      insurer: "AXA",
      key: "",
      name: "Assurance dentaire",
      variant: "Dentaire 1000",
      sex: "f",
      chf: "25.00",
      notes: "internal=PRD_X; tariff_id=Y",
    }),
    line({
      insurer: "AXA",
      key: "",
      name: "Assurance dentaire",
      variant: "Dentaire 1000",
      sex: "m",
      chf: "25.00",
    }),
    line({ insurer: "AXA", key: "", name: "CAPITAL", sex: "f", chf: "3.00" }),
  ];
  await writeFile(
    join(root, "premiums", "assura.csv.gz"),
    gzipSync([header, ...assura].join("\n") + "\n"),
  );
  await writeFile(
    join(root, "premiums", "axa.csv.gz"),
    gzipSync([header, ...axa].join("\n") + "\n"),
  );
}

const fixtureUrl = () => pathToFileURL(root + "/");
const example = parseEnv(
  readFileSync(new URL("../../../../../.env.example", import.meta.url), "utf8"),
);

beforeAll(async () => {
  const external = process.env.SUPPLEMENTARY_TEST_DATABASE_URL;
  if (external) {
    const url = new URL(external);
    if (!isLoopback(url.hostname) || url.pathname !== "/coverview_test")
      throw new Error(
        "SUPPLEMENTARY_TEST_DATABASE_URL must name a loopback coverview_test database",
      );
    uri = external;
  } else {
    const container = await new PostgreSqlContainer("postgres:18.4-alpine")
      .withDatabase("supplementary_test")
      .start();
    uri = container.getConnectionUri();
    stop = () => container.stop();
  }
  database = createDatabase({ DATABASE_URL: uri, DEPENDENCY_TIMEOUT_MS: 20000 });
  await migrate(database.db, {
    migrationsFolder: fileURLToPath(new URL("../../../drizzle/", import.meta.url)),
  });
  await writeFixture();
});
afterAll(async () => {
  await database?.pool.end();
  await stop();
  if (root) await rm(root, { recursive: true, force: true });
});

describe("import", () => {
  it("builds the catalogue, keeps only calculator rows with a product, and reimports without duplicate", async () => {
    const data = await buildSupplementaryData(fixtureUrl(), 2027);
    expect(supplementaryCatalogSchema.parse(data.catalog)).toEqual(data.catalog);
    expect(data.excluded).toEqual({ notCalculator: 1, withoutProduct: 1, familyTariff: 1 });
    const first = await writeSupplementaryData(database.pool, data);
    expect(first).toMatchObject({ created: true, premiums: 19, products: 7, priced: 6 });
    const again = await writeSupplementaryData(
      database.pool,
      await buildSupplementaryData(fixtureUrl(), 2027),
    );
    expect(again).toMatchObject({ id: first.id, created: false });
    const count = await database.pool.query<{ count: number }>(
      "select count(*)::int count from supplementary_premiums where catalog_id=$1",
      [first.id],
    );
    expect(count.rows[0]!.count).toBe(19);

    const { catalog } = data;
    expect(catalog.insurers.map((item) => [item.key, item.partner, item.bagInsurerId])).toEqual([
      ["assura", true, 1542],
      ["axa", false, null],
    ]);
    const one = catalog.products.find((item) => item.key === "assura-one")!;
    expect(one).toMatchObject({ priced: true, families: ["vision", "dental", "other"] });
    expect(one.tags).toEqual(["glasses_lenses", "dental_treatment", "other:test_extra"]);
    expect(one.benefits[1]).toMatchObject({ maxAmountMinor: 100000, ratePercent: 50 });
    expect(catalog.tags.at(-1)).toEqual({
      key: "other:test_extra",
      family: "other",
      label: "Prestation fictive",
    });
    expect(catalog.products.find((item) => item.key === "axa-unpriced")!.priced).toBe(false);
    // Benefit ids are stable from one build to the next.
    const rebuilt = await buildSupplementaryData(fixtureUrl(), 2027);
    expect(rebuilt.catalog.products.flatMap((item) => item.benefits.map((b) => b.id))).toEqual(
      catalog.products.flatMap((item) => item.benefits.map((b) => b.id)),
    );
    // Remarks in French only; technical identifiers never leave the import.
    const notes = data.premiums.map((row) => row.note).filter(Boolean);
    expect(notes).toContain("Avec un contrat de 3 ans : CHF 18.70 par mois");
    expect(notes.join(" ")).not.toMatch(/internal=|tariff_id|price=net/u);
  });
});

describe("quote and assistant", () => {
  it("quotes the female–male range without sex, one price with a sex, accident included", async () => {
    const repository = createSupplementaryRepository(database.pool);
    const range = supplementaryQuoteSchema.parse(
      await repository.quote({ year: 2027, birthYear: 1990, sex: null, canton: "VD" }),
    );
    expect(range).toMatchObject({
      age: 37,
      reference: { postalCode: "1003", locality: "Lausanne" },
    });
    expect(range.prices.find((price) => price.productKey === "assura-one")).toMatchObject({
      accident: true,
      minMinor: 1000,
      maxMinor: 4000,
      note: "Rabais en ligne inclus",
    });
    expect(range.prices.find((price) => price.productKey === "axa-dental")).toMatchObject({
      variant: "Dentaire 1000",
      accident: null,
      minMinor: 2500,
      maxMinor: 2500,
      note: null,
    });
    const woman = await repository.quote({
      year: 2027,
      birthYear: 1960,
      sex: "female",
      canton: "GE",
    });
    expect(woman.reference.locality).toBe("Genève");
    expect(woman.prices).toEqual([
      expect.objectContaining({ productKey: "assura-one", minMinor: 6100, maxMinor: 6100 }),
    ]);
  });

  async function ask(input: SupplementaryAssistantInput) {
    const repository = createSupplementaryRepository(database.pool);
    const { catalog, index } = await repository.current();
    return supplementaryAssistantResultSchema.parse(
      await runAssistant(input, {
        index,
        premiums: (pairs) => repository.premiums(catalog.id, pairs),
        interpret: (message) =>
          Promise.resolve({
            engine: "rules",
            interpretation: interpretWithRules(message, catalog),
          }),
      }),
    );
  }

  it("ranks by coverage, then price, and asks the sex only because it changes the first three", async () => {
    const result = await ask({
      message: "Des lunettes",
      profile: { birthYear: 1990, sex: null, canton: "VD" },
      answers: {},
    });
    expect(result.engine).toBe("rules");
    expect(result.interpretation.tags).toEqual(["glasses_lenses"]);
    expect(result.results.map((item) => [item.productKey, item.monthlyMinor])).toEqual([
      ["assura-one", 1000],
      ["axa-four", 1000],
      ["assura-two", 2000],
      ["axa-three", 3000],
    ]);
    expect(result.results[0]!.reasons).toEqual([
      "Lunettes et lentilles de contact : 90 %, max. CHF 200 par an",
    ]);
    expect(result.question?.id).toBe("sex");
    expect(result.assumptions).toContain("Prix affichés en fourchette femme–homme");

    const female = await ask({
      message: "Des lunettes",
      profile: { birthYear: 1990, sex: null, canton: "VD" },
      answers: { sex: "female" },
    });
    expect(female.profile.sex).toBe("female");
    expect(female.question).toBeNull();
    expect(female.results.slice(0, 3).map((item) => item.productKey)).toEqual([
      "assura-one",
      "assura-two",
      "axa-three",
    ]);
  });

  it("asks nothing when no answer changes the first three", async () => {
    const result = await ask({
      message: "orthodontie",
      profile: { birthYear: 1990, sex: null, canton: "VD" },
      answers: {},
    });
    // Same price for both sexes: the sex question would change nothing. Unpriced products last.
    expect(result.question).toBeNull();
    expect(result.results.map((item) => [item.productKey, item.monthlyMinor])).toEqual([
      ["axa-dental", 2500],
      ["axa-unpriced", null],
    ]);
  });

  it("chooses the cheapest variant that covers the need and applies the defaults", async () => {
    const result = await ask({
      message: "hôpital privé, budget 150 francs",
      profile: { birthYear: null, sex: null, canton: null },
      answers: { birth_year: "1990", canton: "VD" },
    });
    expect(result.profile).toEqual({ year: 2027, birthYear: 1990, sex: null, canton: "VD" });
    expect(result.interpretation.maxMonthlyMinor).toBe(15000);
    expect(result.results[0]).toMatchObject({
      productKey: "assura-hospital",
      variant: "prive",
      monthlyMinor: 8000,
      score: 100,
    });
    const child = await ask({
      message: "lunettes et dentaire pour mon fils de 12 ans",
      profile: { birthYear: 1985, sex: "female", canton: "VD" },
      answers: {},
    });
    // The child is the person to insure, not the adult of the page profile.
    expect(child.profile).toMatchObject({ birthYear: 2015, sex: "male" });
    expect(child.results[0]).toMatchObject({ productKey: "assura-one", monthlyMinor: 500 });
    const defaults = await ask({
      message: "lunettes",
      profile: { birthYear: null, sex: null, canton: null },
      answers: {},
    });
    expect(defaults.profile).toEqual({ year: 2027, birthYear: 1990, sex: null, canton: "VD" });
    expect(defaults.assumptions.slice(0, 3)).toEqual([
      "Âge supposé : 37 ans",
      "Prix affichés en fourchette femme–homme",
      "Canton supposé : Vaud",
    ]);
  });
});

describe("routes and orders", () => {
  async function server() {
    const config = parseEnvironment({
      ...example,
      DATABASE_URL: uri,
      AUTH_ENABLED: "false",
      DOCUMENTS_ENABLED: "false",
      PARTNER_JOBS_ENABLED: "false",
      EXTERNAL_ADAPTER_MODE: "disabled",
      LOG_LEVEL: "silent",
    });
    return buildServer(config, {
      checkReadiness: () => Promise.resolve(true),
      readPersonas: () => Promise.resolve([]),
      close: () => Promise.resolve(),
    });
  }
  const order = (over: Record<string, unknown> = {}) => ({
    requestId: randomUUID(),
    productKey: "assura-hospital",
    variant: "Division privée",
    option: "",
    firstName: "Camille",
    lastName: "Exemple",
    email: "camille@example.test",
    phone: "+41 79 000 00 00",
    birthYear: 1990,
    sex: null,
    canton: "VD",
    message: "Rappel le soir",
    website: "",
    ...over,
  });

  it("serves the catalogue with its ETag and the public errors in the project format", async () => {
    const app = await server();
    try {
      const catalog = await app.inject({ method: "GET", url: "/supplementary-insurance/catalog" });
      expect(catalog.statusCode).toBe(200);
      expect(catalog.headers["cache-control"]).toBe("public, max-age=300");
      const body = supplementaryCatalogSchema.parse(catalog.json());
      expect(catalog.headers.etag).toBe(`"${body.id}"`);
      const cached = await app.inject({
        method: "GET",
        url: "/supplementary-insurance/catalog",
        headers: { "if-none-match": catalog.headers.etag as string },
      });
      expect(cached.statusCode).toBe(304);
      expect(cached.body).toBe("");
      const invalid = await app.inject({
        method: "POST",
        url: "/supplementary-insurance/quote",
        payload: { year: 2027, birthYear: 1990, sex: null, canton: "ZH" },
      });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json()).toMatchObject({ error: { code: "PLATFORM_INVALID_REQUEST" } });
      const assistant = await app.inject({
        method: "POST",
        url: "/supplementary-insurance/assistant",
        payload: {
          message: "lunettes",
          profile: { birthYear: 1990, sex: "male", canton: "VD" },
          answers: {},
        },
      });
      expect(assistant.statusCode).toBe(200);
      expect(
        supplementaryAssistantResultSchema.parse(assistant.json()).results[0]!.productKey,
      ).toBe("axa-four");
    } finally {
      await app.close();
    }
  });

  it("uses OpenAI's closed-vocabulary interpretation when configured, and the rules when its answer is invalid", async () => {
    const answers = [
      {
        tags: ["orthodontics"],
        categories: [],
        insurers: ["axa"],
        maxMonthlyChf: 40,
        age: 12,
        birthYear: null,
        sex: null,
        canton: "VD",
        child: true,
      },
      {
        tags: ["not_a_tag"],
        categories: [],
        insurers: [],
        maxMonthlyChf: null,
        age: null,
        birthYear: null,
        sex: null,
        canton: null,
        child: false,
      },
    ];
    const bodies: string[] = [];
    const fetch = vi.fn((_url: string, init: { body: string }) => {
      bodies.push(init.body);
      const value = answers[bodies.length - 1];
      return Promise.resolve(
        Response.json({
          status: "completed",
          model: "gpt-test",
          output: [
            { type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] },
          ],
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      );
    });
    vi.stubGlobal("fetch", fetch);
    process.env.OPENAI_API_KEY = "unit-test-placeholder-key";
    const app = await server();
    try {
      const ask = (message: string) =>
        app.inject({
          method: "POST",
          url: "/supplementary-insurance/assistant",
          payload: { message, profile: { birthYear: null, sex: null, canton: null }, answers: {} },
        });
      const llm = supplementaryAssistantResultSchema.parse(
        (await ask("Un appareil pour les dents de ma fille")).json(),
      );
      expect(llm).toMatchObject({
        engine: "llm",
        interpretation: { tags: ["orthodontics"], insurers: ["axa"], maxMonthlyMinor: 4000 },
        profile: { birthYear: 2015, canton: "VD" },
      });
      const sent = JSON.parse(bodies[0]!) as {
        store: boolean;
        input: Array<{ content: Array<{ text: string }> }>;
      };
      expect(sent.store).toBe(false);
      expect(sent.input[0]!.content[0]!.text).toBe(
        "<besoin>\nUn appareil pour les dents de ma fille\n</besoin>",
      );
      const fallback = supplementaryAssistantResultSchema.parse((await ask("lunettes")).json());
      expect(fallback).toMatchObject({
        engine: "rules",
        interpretation: { tags: ["glasses_lenses"] },
      });
    } finally {
      delete process.env.OPENAI_API_KEY;
      vi.unstubAllGlobals();
      await app.close();
    }
  });

  it("stores an order once, refuses another content or an unknown product, and ignores the honeypot", async () => {
    const app = await server();
    const post = (payload: unknown) =>
      app.inject({
        method: "POST",
        url: "/supplementary-insurance/orders",
        payload: payload as object,
      });
    try {
      const input = order();
      const first = await post(input);
      expect(first.statusCode).toBe(200);
      const receipt = supplementaryOrderReceiptSchema.parse(first.json());
      expect(receipt).toMatchObject({ success: true, requestId: input.requestId });
      expect(receipt.reference).toMatch(/^LCA-[0-9A-F]{10}$/u);
      const again = await post(input);
      expect(again.json()).toEqual(receipt);
      const rows = await database.pool.query<{
        data: { price: unknown; variant: string };
        notification: string;
      }>("select data,notification from supplementary_orders where request_id=$1", [
        input.requestId,
      ]);
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0]).toMatchObject({
        notification: "queued",
        data: {
          variant: "Division privée",
          price: { minMinor: 8000, maxMinor: 9000, from: false },
        },
      });
      const reused = await post({ ...input, phone: "+41 79 111 11 11" });
      expect(reused.statusCode).toBe(422);
      expect(reused.json()).toMatchObject({ error: { code: "SUPPLEMENTARY_IDEMPOTENCY_REUSED" } });
      const unknown = await post(order({ productKey: "assura-missing" }));
      expect(unknown.statusCode).toBe(422);
      expect(unknown.json()).toMatchObject({ error: { code: "SUPPLEMENTARY_PRODUCT_UNKNOWN" } });
      const variant = await post(order({ variant: "Division royale" }));
      expect(variant.json()).toMatchObject({ error: { code: "SUPPLEMENTARY_VARIANT_UNKNOWN" } });
      // Five orders a minute per address: the sixth is refused (MAIL-07, SEC-04).
      const limited = await post(order());
      expect(limited.statusCode).toBe(429);
      expect(limited.json()).toMatchObject({ error: { code: "IDENTITY_RATE_LIMITED" } });
      const other = await server();
      try {
        const trap = order({ website: "https://spam.example" });
        const honeypot = await other.inject({
          method: "POST",
          url: "/supplementary-insurance/orders",
          payload: trap,
        });
        expect(honeypot.statusCode).toBe(200);
        expect(supplementaryOrderReceiptSchema.parse(honeypot.json()).requestId).toBe(
          trap.requestId,
        );
        const trapped = await database.pool.query(
          "select 1 from supplementary_orders where request_id=$1",
          [trap.requestId],
        );
        expect(trapped.rowCount).toBe(0);
      } finally {
        await other.close();
      }
    } finally {
      await app.close();
    }
  });

  it("sends the internal notice through the mail adapter once, and keeps it queued without one", async () => {
    const repository = createSupplementaryRepository(database.pool);
    const input = order({ productKey: "axa-dental", variant: "Dentaire 1000", sex: "male" });
    await receiveSupplementaryOrder(database.pool, repository, {
      ...input,
      sex: "male",
      canton: "VD",
      message: null,
    });
    const settings = { notifyEmail: "notices@supplementary.test" };
    await processSupplementaryOrders(database.pool, null, settings);
    const queued = await database.pool.query<{ notification: string; attempts: number }>(
      "select notification,attempts from supplementary_orders where request_id=$1",
      [input.requestId],
    );
    expect(queued.rows[0]).toEqual({ notification: "queued", attempts: 0 });
    const sent: MailMessage[] = [];
    const mailer = {
      send: (message: MailMessage) => {
        sent.push(message);
        return Promise.resolve();
      },
    };
    const result = await processSupplementaryOrders(database.pool, mailer, settings);
    expect(result.sent).toBeGreaterThanOrEqual(1);
    expect(await processSupplementaryOrders(database.pool, mailer, settings)).toEqual({
      sent: 0,
      failed: 0,
    });
    const notice = sent.find((message) => message.text.includes("AXA-DENTAL"))!;
    expect(notice).toMatchObject({
      to: "notices@supplementary.test",
      tag: "supplementary-order-v1",
    });
    expect(notice.subject).toBe("Nouvelle commande de complémentaire : AXA-DENTAL (AXA)");
    expect(notice.text).toContain("Variante : Dentaire 1000");
    expect(notice.text).toContain("Prix mensuel indicatif : CHF 25,00 par mois");
    expect(notice.text).toContain("Localité de référence du prix : 1003 Lausanne (VD)");
    expect(notice.text).toContain("Client : Camille Exemple");
    expect(notice.text).toContain("homme, canton de Vaud");
    expect(notice.html).not.toContain("<script");
    const state = await database.pool.query<{ notification: string }>(
      "select notification from supplementary_orders where request_id=$1",
      [input.requestId],
    );
    expect(state.rows[0]!.notification).toBe("sent");
  });
});
