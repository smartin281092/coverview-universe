import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, expect, it } from "vitest";
import {
  healthCurrentComparisonInputSchema,
  healthCurrentOptionsInputSchema,
} from "@coverview/contracts/health-insurance";
import { createDatabase } from "../../platform/db/database.js";
import { createHealthCurrentRepository } from "./health.current.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createHealthCurrentRepository>;
const mid = (n: number) => "hm_" + n.toString(16).padStart(28, "0");
const pid = (n: number) => "hp_" + n.toString(16).padStart(28, "0");
const fid = (n: number) => "hfp_" + n.toString(16).padStart(28, "0");
const context = {
  year: 2026 as const,
  birthYear: 1990,
  regionId: "VD-1",
  deductible: 2500,
  accident: true,
};
const current = {
  year: 2026 as const,
  modelId: mid(1),
  regionId: "VD-1",
  deductible: 2500,
  accident: true,
};
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18.4-alpine")
    .withDatabase("health_current_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  await migrate(database.db, {
    migrationsFolder: fileURLToPath(new URL("../../../drizzle/", import.meta.url)),
  });
  repository = createHealthCurrentRepository(database.pool);
  await database.pool.query("insert into health_insurers(id,name) values(98001,'Legal name 2027')");
  for (const year of [2026, 2027]) {
    await database.pool.query(
      "insert into health_datasets(id,year,active,sources,counts,insurer_identities) values($1,$2,true,'[]','{}',$3)",
      [
        String(year),
        year,
        JSON.stringify([{ id: 98001, name: `Legal name ${year}`, brand: `Marque ${year}` }]),
      ],
    );
    for (const region of ["VD-1", "VD-2"])
      await database.pool.query(
        "insert into health_regions(id,dataset_id,region_id,canton,number) values($1,$2,$3,'VD',$4)",
        [`${year}_${region}`, String(year), region, Number(region.slice(-1))],
      );
    await database.pool.query(
      "insert into health_localities(id,dataset_id,region_key,municipality_id,municipality,postal_code,locality,search_text) values($1,$2,$3,901,'Commune fictive','9999','Localité fictive','9999 localite fictive')",
      [`loc_${year}`, String(year), `${year}_${year === 2026 ? "VD-2" : "VD-1"}`],
    );
    await database.pool.query(
      "insert into health_foreign_datasets(id,year,active,source_url,sha256) values($1,$2,true,'https://example.test/reference',$3)",
      [`foreign_${year}`, year, "a".repeat(64)],
    );
  }
  for (const [n, year, restricted, tariff] of [
    [1, 2026, false, "1"],
    [2, 2026, true, "2"],
    [3, 2027, false, "3"],
    [5, 2026, false, "5"],
    [6, 2027, false, "5"],
  ] as const) {
    await database.pool.query(
      "insert into health_models(id,dataset_id,insurer_id,tariff_code,name,category) values($1,$2,98001,$3,'Modèle fictif',$4)",
      [mid(n), String(year), tariff, restricted ? "DIV" : "BASE"],
    );
    for (const region of ["VD-1", "VD-2"])
      await database.pool.query(
        "insert into health_eligibility(id,model_id,region_key,restricted,municipality_ids) values($1,$2,$3,$4,$5)",
        [`elig_${n}_${region}`, mid(n), `${year}_${region}`, restricted, restricted ? [901] : []],
      );
  }
  async function premium(
    n: number,
    model: number,
    year: number,
    age: string,
    deductible: number,
    amount: number,
    region = "VD-1",
    accident = true,
  ) {
    await database.pool.query(
      `insert into health_premiums(id,dataset_id,model_id,region_key,age_group,age_subgroup,accident,deductible,monthly_premium_minor,raw) values($1,$2,$3,$4,$5,$6,$7,$8,$9,'{}')`,
      [
        pid(n),
        String(year),
        mid(model),
        `${year}_${region}`,
        age,
        age === "child" ? "K1" : age === "adult" ? "E1" : "J1",
        accident,
        deductible,
        amount,
      ],
    );
  }
  await premium(1, 1, 2026, "adult", 2500, 50000);
  await premium(2, 2, 2026, "adult", 2500, 48000);
  await premium(3, 1, 2026, "adult", 2500, 60000, "VD-2");
  await premium(4, 2, 2026, "adult", 2500, 57000, "VD-2");
  await premium(5, 1, 2026, "child", 0, 10000);
  await premium(6, 1, 2026, "young_adult", 2500, 30000);
  await premium(7, 3, 2027, "adult", 2500, 48000);
  await premium(8, 3, 2027, "adult", 300, 55000);
  await premium(9, 3, 2027, "adult", 500, 50000);
  await premium(10, 3, 2027, "adult", 2500, 45000, "VD-1", false);
  await premium(11, 3, 2027, "young_adult", 300, 20000);
  await premium(20, 5, 2026, "adult", 2500, 50000);
  await premium(21, 5, 2026, "young_adult", 2500, 30000);
  await premium(22, 5, 2026, "child", 0, 10000);
  await premium(23, 5, 2026, "adult", 2500, 60000, "VD-2");
  await premium(24, 6, 2027, "adult", 2500, 52000);
  await premium(25, 6, 2027, "young_adult", 300, 21000);
  await premium(26, 6, 2027, "adult", 2500, 58000, "VD-2");
  for (const [n, year, amount] of [
    [1, 2026, 25000],
    [2, 2027, 24000],
  ])
    await database.pool.query(
      "insert into health_foreign_premiums(id,dataset_id,insurer_id,country,age_group,age_subgroup,accident,deductible,monthly_premium_minor,raw) values($1,$2,98001,'FR','adult','E1',true,300,$3,'{}')",
      [fid(n!), `foreign_${year}`, amount],
    );
}, 120000);
afterAll(async () => {
  await database?.pool.end();
  await container?.stop();
});

it("retains the historical identity and native taxonomy without 2027 conditions", async () => {
  const result = await repository.options(context);
  expect(result.status).toBe("available");
  expect(result.insurers).toEqual([{ id: 98001, name: "Legal name 2026", brand: "Marque 2026" }]);
  expect(result.offers.find((offer) => offer.modelId === mid(2))).toMatchObject({
    category: "DIV",
    eligibility: "municipality_required",
  });
  expect(
    result.offers.every(
      (offer) => offer.firstContacts === undefined && offer.redistribution === undefined,
    ),
  ).toBe(true);
});
it("uses the municipality's historical region and asks for unmatched municipalities", async () => {
  const result = await repository.options({ ...context, municipalityId: 901 });
  expect(result.regionId).toBe("VD-2");
  expect(result.offers[0]?.monthlyPremiumMinor).toBe(60000);
  expect(result.offers[1]?.eligibility).toBe("municipality_confirmed");
  expect((await repository.options({ ...context, municipalityId: 999 })).status).toBe(
    "location_required",
  );
});
it("calculates signed monthly and annual differences from server prices only", async () => {
  const result = await repository.compare({
    birthYear: 1990,
    current,
    offerIds: [pid(7), pid(8), pid(9), pid(10), pid(1)],
  });
  expect(result.current?.monthlyPremiumMinor).toBe(50000);
  expect(result.baseline).toMatchObject({ year: 2026, monthlyPremiumMinor: 50000 });
  expect(result.differences.every((row) => row.baselineYear === 2026)).toBe(true);
  expect(result.differences).toHaveLength(4);
  expect(result.differences.find((r) => r.offerId === pid(7))).toMatchObject({
    monthlySavingMinor: 2000,
    annualSavingMinor: 24000,
    direction: "saving",
    deductibleChanged: false,
  });
  expect(result.differences.find((r) => r.offerId === pid(8))).toMatchObject({
    monthlySavingMinor: -5000,
    annualSavingMinor: -60000,
    direction: "increase",
    deductibleChanged: true,
  });
  expect(result.differences.find((r) => r.offerId === pid(9))).toMatchObject({
    monthlySavingMinor: 0,
    direction: "equal",
  });
  expect(result.differences.find((r) => r.offerId === pid(10))).toMatchObject({
    accidentChanged: true,
  });
});
it("applies the age and deductible independently in each year at the 18/19 and 25/26 boundaries", async () => {
  const child = await repository.compare({
    birthYear: 2008,
    current: { ...current, deductible: 0 },
    offerIds: [pid(7), pid(11)],
  });
  expect(child.current?.ageGroup).toBe("child");
  expect(child.differences).toHaveLength(1);
  expect(child.differences[0]).toMatchObject({
    offerId: pid(11),
    ageGroupChanged: true,
    deductibleChanged: true,
    annualSavingMinor: -120000,
  });
  const young = await repository.compare({ birthYear: 2001, current, offerIds: [pid(7), pid(11)] });
  expect(young.current?.ageGroup).toBe("young_adult");
  expect(young.differences).toHaveLength(1);
  expect(young.differences[0]).toMatchObject({ ageGroupChanged: true, annualSavingMinor: -216000 });
  expect((await repository.options({ ...context, birthYear: 2008 })).status).toBe(
    "invalid_deductible",
  );
});
it("measures the differences from the same model's 2027 tariff, for the age in 2027", async () => {
  const adult = await repository.compare({
    birthYear: 1990,
    current: { ...current, modelId: mid(5) },
    offerIds: [pid(7), pid(8)],
  });
  expect(adult.current?.monthlyPremiumMinor).toBe(50000);
  expect(adult.baseline).toMatchObject({
    year: 2027,
    modelId: mid(6),
    monthlyPremiumMinor: 52000,
    ageGroup: "adult",
    deductible: 2500,
    regionId: "VD-1",
  });
  expect(adult.differences.find((row) => row.offerId === pid(7))).toMatchObject({
    baselineYear: 2027,
    monthlySavingMinor: 4000,
    annualSavingMinor: 48000,
    direction: "saving",
    deductibleChanged: false,
  });
  expect(adult.differences.find((row) => row.offerId === pid(8))).toMatchObject({
    monthlySavingMinor: -3000,
    deductibleChanged: true,
  });
  // 25 in 2026, 26 in 2027: the reference is the adult tariff, not the young adult one paid now.
  const older = await repository.compare({
    birthYear: 2001,
    current: { ...current, modelId: mid(5) },
    offerIds: [pid(7)],
  });
  expect(older.current).toMatchObject({ ageGroup: "young_adult", monthlyPremiumMinor: 30000 });
  expect(older.baseline).toMatchObject({ ageGroup: "adult", monthlyPremiumMinor: 52000 });
  expect(older.differences[0]).toMatchObject({ monthlySavingMinor: 4000, ageGroupChanged: false });
  // 18 in 2026, 19 in 2027: the child deductible of 0 becomes the ordinary 300 CHF.
  const grown = await repository.compare({
    birthYear: 2008,
    current: { ...current, modelId: mid(5), deductible: 0 },
    offerIds: [pid(11)],
  });
  expect(grown.baseline).toMatchObject({
    ageGroup: "young_adult",
    deductible: 300,
    monthlyPremiumMinor: 21000,
  });
  expect(grown.differences[0]).toMatchObject({
    monthlySavingMinor: 1000,
    deductibleChanged: false,
    ageGroupChanged: false,
  });
  // The contract's commune is in VD-2 in 2026 and in VD-1 in 2027: the 2027 region prices it.
  const moved = await repository.compare({
    birthYear: 1990,
    current: { ...current, modelId: mid(5), regionId: "VD-2", municipalityId: 901 },
    offerIds: [pid(7)],
  });
  expect(moved.current?.monthlyPremiumMinor).toBe(60000);
  expect(moved.baseline).toMatchObject({ regionId: "VD-1", monthlyPremiumMinor: 52000 });
  expect(moved.differences[0]).toMatchObject({ monthlySavingMinor: 4000, regionChanged: false });
});
it("does not compute a certain saving when the historical network or model cannot be verified", async () => {
  expect(
    await repository.compare({
      birthYear: 1990,
      current: { ...current, modelId: mid(2) },
      offerIds: [pid(7)],
    }),
  ).toMatchObject({ status: "location_required", current: null, differences: [] });
  expect(
    await repository.compare({
      birthYear: 1990,
      current: { ...current, modelId: mid(3) },
      offerIds: [pid(7)],
    }),
  ).toMatchObject({ status: "model_unavailable", differences: [] });
});
it("keeps foreign historical prices separate from Switzerland", async () => {
  const result = await repository.compare({
    birthYear: 1990,
    current: { ...current, modelId: "hfm_2026_98001", regionId: "EU-FR", deductible: 300 },
    offerIds: [fid(2)],
  });
  expect(result.current).toMatchObject({
    residenceCountry: "FR",
    monthlyPremiumMinor: 25000,
    category: "BASE",
  });
  expect(result.baseline).toMatchObject({ year: 2027, monthlyPremiumMinor: 24000 });
  expect(result.differences[0]).toMatchObject({
    annualSavingMinor: 0,
    direction: "equal",
    baselineYear: 2027,
    regionChanged: false,
  });
  expect((await repository.options({ ...context, regionId: "EU-FR" })).status).toBe(
    "invalid_deductible",
  );
});
it("rejects invented prices, mixed years and unbounded candidate lists at the public contract", () => {
  expect(healthCurrentOptionsInputSchema.safeParse({ ...context, year: 2027 }).success).toBe(false);
  expect(
    healthCurrentComparisonInputSchema.safeParse({
      birthYear: 1990,
      current: { ...current, monthlyPremiumMinor: 1 },
      offerIds: [],
    }).success,
  ).toBe(false);
  expect(
    healthCurrentComparisonInputSchema.safeParse({
      birthYear: 1990,
      current,
      offerIds: Array.from({ length: 1201 }, () => pid(7)),
    }).success,
  ).toBe(false);
});
it("keeps data absence explicit without a fallback to the next year", async () => {
  await database.pool.query("update health_datasets set active=false where year=2026");
  try {
    expect(await repository.options(context)).toMatchObject({
      status: "data_unavailable",
      offers: [],
      insurers: [],
    });
  } finally {
    await database.pool.query("update health_datasets set active=true where year=2026");
  }
});
