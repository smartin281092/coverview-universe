import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import { healthCompareInputSchema } from "@coverview/contracts/health-insurance";
import { createDatabase } from "../../platform/db/database.js";
import { createHealthRepository } from "./health.repository.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createHealthRepository>;
const mid = (n: number) => "hm_" + n.toString(16).padStart(28, "0");
const pid = (n: number) => "hp_" + n.toString(16).padStart(28, "0");
const fid = (n: number) => "hfp_" + n.toString(16).padStart(28, "0");
// Another insurer, then Assura-Basis and Mutuel (Groupe Mutuel), CoverView's partners.
const insurers = [98001, 1542, 1479];
const compare = (input: Record<string, unknown>) =>
  repository.compare(
    healthCompareInputSchema.parse({
      birthYear: 1990,
      accident: false,
      deductible: 2500,
      ...input,
    }),
  );
const recommended = (offers: { modelId: string; recommended?: boolean | undefined }[]) =>
  offers.filter((offer) => offer.recommended).map((offer) => offer.modelId);

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18.4-alpine")
    .withDatabase("health_recommended_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  await migrate(database.db, {
    migrationsFolder: fileURLToPath(new URL("../../../drizzle/", import.meta.url)),
  });
  repository = createHealthRepository(database.pool);
  for (const id of insurers)
    await database.pool.query("insert into health_insurers(id,name) values($1,$2)", [
      id,
      `Insurer ${id}`,
    ]);
  await database.pool.query(
    "insert into health_datasets(id,year,active,sources,counts,insurer_identities) values('2027',2027,true,'[]','{}','[]')",
  );
  for (const region of ["VD-1", "VD-2"])
    await database.pool.query(
      "insert into health_regions(id,dataset_id,region_id,canton,number) values($1,'2027',$2,'VD',$3)",
      [`2027_${region}`, region, Number(region.slice(-1))],
    );
  await database.pool.query(
    "insert into health_foreign_datasets(id,year,active,source_url,sha256) values('foreign_2027',2027,true,'https://example.test/reference',$1)",
    ["a".repeat(64)],
  );
  // Models 1–4: other insurer, Assura, Mutuel, Assura again.
  for (const [n, insurer] of [
    [1, 98001],
    [2, 1542],
    [3, 1479],
    [4, 1542],
  ] as const) {
    await database.pool.query(
      "insert into health_models(id,dataset_id,insurer_id,tariff_code,name,category) values($1,'2027',$2,$3,$4,'BASE')",
      [mid(n), insurer, String(n), `Modèle ${n}`],
    );
    for (const region of ["VD-1", "VD-2"])
      await database.pool.query(
        "insert into health_eligibility(id,model_id,region_key,restricted,municipality_ids) values($1,$2,$3,false,'{}')",
        [`elig_${n}_${region}`, mid(n), `2027_${region}`],
      );
  }
  // VD-1: other < Assura < Mutuel < Assura. VD-2: Mutuel first, then Assura, then the other.
  for (const [n, model, region, amount] of [
    [1, 1, "VD-1", 40000],
    [2, 2, "VD-1", 41000],
    [3, 3, "VD-1", 42000],
    [4, 4, "VD-1", 43000],
    [5, 3, "VD-2", 39000],
    [6, 2, "VD-2", 40000],
    [7, 1, "VD-2", 41000],
  ] as const)
    await database.pool.query(
      `insert into health_premiums(id,dataset_id,model_id,region_key,age_group,age_subgroup,accident,deductible,monthly_premium_minor,raw) values($1,'2027',$2,$3,'adult','E1',false,2500,$4,'{}')`,
      [pid(n), mid(model), `2027_${region}`, amount],
    );
  for (const [n, insurer, amount] of [
    [1, 98001, 22000],
    [2, 1542, 23000],
    [3, 1479, 24000],
  ] as const)
    await database.pool.query(
      "insert into health_foreign_premiums(id,dataset_id,insurer_id,country,age_group,age_subgroup,accident,deductible,monthly_premium_minor,raw) values($1,'foreign_2027',$2,'FR','adult','E1',false,300,$3,'{}')",
      [fid(n), insurer, amount],
    );
}, 120000);
afterAll(async () => {
  await database?.pool.end();
  await container?.stop();
});

it("tags only the first partner model of each region's list (23 October 2026)", async () => {
  const vaud = await compare({ regionId: "VD-1" });
  expect(vaud.offers.map((offer) => offer.modelId)).toEqual([mid(1), mid(2), mid(3), mid(4)]);
  expect(recommended(vaud.offers)).toEqual([mid(2)]);
  const overview = vaud.regions.flatMap((region) => region.offers);
  // The overview keeps each region's and residence country's first partner model.
  expect(recommended(overview)).toEqual([mid(2), mid(3), "hfm_2027_1542"]);
  // Groupe Mutuel first in VD-2.
  expect(recommended((await compare({ regionId: "VD-2" })).offers)).toEqual([mid(3)]);
});

it("keeps the tag on the list's first partner model, whatever the page or filters", async () => {
  // Page from the third model: the recommended model is on the page before, never moved.
  expect(recommended((await compare({ regionId: "VD-1", offset: 2 })).offers)).toEqual([]);
  // Without Assura, Groupe Mutuel's model is the first partner model.
  expect(
    recommended((await compare({ regionId: "VD-1", insurerIds: [98001, 1479] })).offers),
  ).toEqual([mid(3)]);
  // Other insurers alone: no tag.
  expect(recommended((await compare({ regionId: "VD-1", insurerIds: [98001] })).offers)).toEqual(
    [],
  );
});

it("returns the list's recommended model whatever the page (25 October 2026)", async () => {
  const later = await compare({ regionId: "VD-1", offset: 2 });
  expect(later.offers.map((offer) => offer.modelId)).toEqual([mid(3), mid(4)]);
  expect(later.recommendedOffer).toMatchObject({
    modelId: mid(2),
    recommended: true,
    partner: true,
    monthlyPremiumMinor: 41000,
  });
  // The overview keeps three models per region: the recommended one is not added there.
  expect(later.regions.find((region) => region.regionId === "VD-1")?.offers).toHaveLength(3);
  expect((await compare({ regionId: "VD-1" })).recommendedOffer?.id).toBe(pid(2));
  expect((await compare({ regionId: "VD-2" })).recommendedOffer?.modelId).toBe(mid(3));
  // Filters still apply: other insurers alone, no recommended model.
  expect((await compare({ regionId: "VD-1", insurerIds: [98001] })).recommendedOffer).toBeNull();
  const foreign = await compare({ regionId: "EU-FR", deductible: 300, offset: 2 });
  expect(foreign.offers.map((offer) => offer.insurerId)).toEqual([1479]);
  expect(foreign.recommendedOffer?.insurerId).toBe(1542);
});

it("applies the same rule to foreign residence countries", async () => {
  const foreign = await compare({ regionId: "EU-FR", deductible: 300 });
  expect(foreign.offers.map((offer) => offer.insurerId)).toEqual([98001, 1542, 1479]);
  expect(
    foreign.offers.filter((offer) => offer.recommended).map((offer) => offer.insurerId),
  ).toEqual([1542]);
});
