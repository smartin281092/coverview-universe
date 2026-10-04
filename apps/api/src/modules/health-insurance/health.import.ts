import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { healthBenefitSchema } from "@coverview/contracts/health-insurance";
import { assertLocalDatabase, loadEnvironment } from "../../platform/config.js";
import { createDatabase } from "../../platform/db/database.js";

const str = z.string().min(1);
const int = z.number().int();
const reference = z.object({ id: str, dataset_id: str });
const tables = {
  health_datasets: z.object({
    id: str,
    year: z.literal(2027),
    active: z.literal(false),
    sources: z.array(
      z.object({
        file: str,
        url: z.url(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        bytes: int.positive(),
        retrievedAt: str,
      }),
    ),
    counts: z.object({
      premiums: int.positive(),
      models: int.positive(),
      insurers: int.positive(),
      localities: int.positive(),
      regions: int.positive(),
      swissRegions: int.positive(),
      eligibility: int.positive(),
    }),
  }),
  health_insurers: z.object({ id: int.positive(), name: str }),
  health_models: reference.extend({
    insurer_id: int.positive(),
    tariff_code: str,
    name: str,
    category: z.enum(["BASE", "PRAXIS", "TEL_DIG", "FLEX", "PHARM"]),
  }),
  health_regions: reference.extend({
    region_id: z.string().regex(/^[A-Z]{2}-[0-3]$/),
    canton: z.string().length(2),
    number: int.min(0).max(3),
  }),
  health_localities: reference.extend({
    region_key: str,
    municipality_id: int.positive(),
    municipality: str,
    postal_code: z.string().regex(/^\d{4}$/),
    locality: str,
    search_text: str,
  }),
  health_eligibility: z.object({
    id: str,
    model_id: str,
    region_key: str,
    restricted: z.boolean(),
    municipality_ids: z.array(int.positive()),
  }),
  health_premiums: reference.extend({
    model_id: str,
    region_key: str,
    age_group: z.enum(["child", "young_adult", "adult"]),
    age_subgroup: z.enum(["E1", "J1", "K1", "K3", "K4", "K5"]),
    accident: z.boolean(),
    deductible: int.min(0).max(2500),
    monthly_premium_minor: int.nonnegative(),
    currency: z.literal("CHF"),
    raw: z.record(z.string(), z.string()),
  }),
};
const envelope = z.object({
  table: z.enum(Object.keys(tables) as [keyof typeof tables, ...(keyof typeof tables)[]]),
  row: z.unknown(),
});
const root = new URL("../../../../../data/health-insurance/2027/", import.meta.url);
async function main() {
  const config = loadEnvironment();
  assertLocalDatabase(config);
  const benefitsRaw: unknown = JSON.parse(await readFile(new URL("benefits.json", root), "utf8"));
  const benefits = z
    .object({
      facts: z
        .array(
          healthBenefitSchema
            .omit({ id: true })
            .extend({ insurerId: int.positive(), tariffCode: z.string().nullable() }),
        )
        .max(10000),
    })
    .parse(benefitsRaw).facts;
  const database = createDatabase({ ...config, DEPENDENCY_TIMEOUT_MS: 120000 });
  database.pool.on("error", () => process.stderr.write("Health database unavailable\n"));
  const client = await database.pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext('health-2027-import'))");
    let datasetId = "";
    let expected: Record<string, number> = {};
    let table: keyof typeof tables = "health_datasets";
    let batch: Record<string, unknown>[] = [];
    const counts: Record<string, number> = {};
    const flush = async () => {
      if (!batch.length) return;
      const columns = Object.keys(batch[0] ?? {});
      // Identifiers only come from the closed Zod table/column registry above.
      const quoted = columns.map((c) => '"' + c + '"').join(",");
      const conflict =
        table === "health_insurers"
          ? "on conflict(id) do update set name=excluded.name"
          : "on conflict do nothing";
      await client.query(
        `insert into ${table} (${quoted}) select ${quoted} from jsonb_populate_recordset(null::${table},$1::jsonb) ${conflict}`,
        [JSON.stringify(batch)],
      );
      batch = [];
    };
    const lines = createInterface({
      input: createReadStream(fileURLToPath(new URL("normalized.jsonl.gz", root))).pipe(
        createGunzip(),
      ),
      crlfDelay: Infinity,
    });
    for await (const line of lines) {
      if (line.length > 100000) throw new Error("Oversized input record");
      const item = envelope.parse(JSON.parse(line) as unknown);
      const row = tables[item.table].parse(item.row);
      if (item.table === "health_datasets") {
        if (datasetId) throw new Error("Multiple dataset headers");
        const header = tables.health_datasets.parse(row);
        datasetId = header.id;
        expected = header.counts;
      } else if (!datasetId) throw new Error("Missing dataset header");
      if ("dataset_id" in row && row.dataset_id !== datasetId) throw new Error("Mixed datasets");
      if (item.table !== table) {
        await flush();
        table = item.table;
      }
      batch.push(row);
      counts[table] = (counts[table] ?? 0) + 1;
      if (batch.length >= 1000) await flush();
    }
    await flush();
    for (const [suffix, countKey] of Object.entries({
      premiums: "premiums",
      models: "models",
      localities: "localities",
      regions: "regions",
    })) {
      const actual = await client.query<{ n: string }>(
        `select count(*) as n from health_${suffix} where dataset_id=$1`,
        [datasetId],
      );
      if (Number(actual.rows[0]?.n) !== expected[countKey])
        throw new Error("Dataset count mismatch");
    }
    const integrity = await client.query<{
      eligibility: string;
      insurers: string;
      orphans: string;
    }>(
      `select
      (select count(*) from health_eligibility e join health_models m on m.id=e.model_id where m.dataset_id=$1) as eligibility,
      (select count(distinct insurer_id) from health_models where dataset_id=$1) as insurers,
      (select count(*) from health_premiums p join health_models m on m.id=p.model_id join health_regions r on r.id=p.region_key
       left join health_eligibility e on e.model_id=p.model_id and e.region_key=p.region_key
       where p.dataset_id=$1 and (m.dataset_id<>p.dataset_id or r.dataset_id<>p.dataset_id or e.id is null)) as orphans`,
      [datasetId],
    );
    const checked = integrity.rows[0];
    if (
      !checked ||
      Number(checked.eligibility) !== expected.eligibility ||
      Number(checked.insurers) !== expected.insurers ||
      Number(checked.orphans) !== 0
    )
      throw new Error("Catalogue integrity failed");
    const activeBenefitIds: string[] = [];
    for (const fact of benefits) {
      const { insurerId, tariffCode, ...details } = fact;
      if (tariffCode) {
        const match = await client.query(
          "select id from health_models where dataset_id=$1 and insurer_id=$2 and tariff_code=$3",
          [datasetId, insurerId, tariffCode],
        );
        if (!match.rowCount) throw new Error("Benefit model missing");
      }
      const benefitId =
        "hb_" +
        createHash("sha256")
          .update(JSON.stringify([insurerId, tariffCode, details.kind, details.key]))
          .digest("hex")
          .slice(0, 28);
      activeBenefitIds.push(benefitId);
      const row: Record<string, unknown> = {
        id: benefitId,
        insurer_id: insurerId,
        tariff_code: tariffCode,
        active: true,
      };
      for (const [key, value] of Object.entries(details))
        row[key.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase())] = value;
      const columns = Object.keys(row);
      const quoted = columns.map((c) => '"' + c + '"').join(",");
      await client.query(
        `insert into health_benefits (${quoted}) select ${quoted} from jsonb_populate_record(null::health_benefits,$1::jsonb) on conflict(id) do update set ${columns
          .filter((c) => c !== "id")
          .map((c) => `"${c}"=excluded."${c}"`)
          .join(",")}`,
        [JSON.stringify(row)],
      );
    }
    await client.query(
      "update health_benefits set active=false where active and not (id=any($1::text[]))",
      [activeBenefitIds],
    );
    await client.query(
      "update health_datasets set active=false where year=2027 and active and id<>$1",
      [datasetId],
    );
    await client.query("update health_datasets set active=true where id=$1", [datasetId]);
    await client.query("commit");
    process.stdout.write(
      JSON.stringify({ datasetId, counts, benefits: benefits.length, status: "imported" }) + "\n",
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await database.pool.end();
  }
}
main().catch((error) => {
  process.stderr.write(
    error instanceof z.ZodError
      ? JSON.stringify(error.issues.map((x) => ({ path: x.path, code: x.code })))
      : "Health import failed; transaction rolled back. Check normalized sources, model relations and local database.",
  );
  process.exitCode = 1;
});
