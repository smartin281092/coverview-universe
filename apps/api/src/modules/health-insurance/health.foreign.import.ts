import { readFile } from "node:fs/promises";
import { z } from "zod";
import { assertLocalDatabase, loadEnvironment } from "../../platform/config.js";
import { createDatabase } from "../../platform/db/database.js";

const yearArgument = process.argv.indexOf("--year");
const year = z
  .union([z.literal(2026), z.literal(2027)])
  .parse(yearArgument < 0 ? 2027 : Number(process.argv[yearArgument + 1]));
const data = z
  .object({
    dataset: z.object({
      id: z.string(),
      year: z.literal(year),
      source_url: z.url(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    }),
    rows: z
      .array(
        z.object({
          id: z.string(),
          dataset_id: z.string(),
          insurer_id: z.number().int(),
          country: z.string().regex(/^[A-Z]{2}$/),
          age_group: z.enum(["adult", "young_adult", "child"]),
          age_subgroup: z.enum(["E1", "J1", "K1", "K3"]),
          accident: z.boolean(),
          deductible: z.union([z.literal(0), z.literal(300)]),
          monthly_premium_minor: z.number().int().nonnegative(),
          raw: z.record(z.string(), z.string()),
        }),
      )
      .min(1)
      .max(10000),
  })
  .parse(
    JSON.parse(
      await readFile(
        new URL(
          `../../../../../data/health-insurance/${year}/foreign-normalized.json`,
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );
if (data.rows.some((row) => row.dataset_id !== data.dataset.id))
  throw new Error("FOREIGN_DATASET_MISMATCH");
const config = loadEnvironment();
assertLocalDatabase(config);
const database = createDatabase(config),
  client = await database.pool.connect();
try {
  await client.query("begin");
  await client.query("select pg_advisory_xact_lock(hashtext('health-foreign-import'))");
  await client.query(
    "insert into health_foreign_datasets(id,year,source_url,sha256) values($1,$2,$3,$4) on conflict(id) do nothing",
    [data.dataset.id, data.dataset.year, data.dataset.source_url, data.dataset.sha256],
  );
  for (let offset = 0; offset < data.rows.length; offset += 500)
    await client.query(
      "insert into health_foreign_premiums select * from jsonb_populate_recordset(null::health_foreign_premiums,$1::jsonb) on conflict(id) do nothing",
      [JSON.stringify(data.rows.slice(offset, offset + 500))],
    );
  const count = await client.query<{ n: string }>(
    "select count(*) as n from health_foreign_premiums where dataset_id=$1",
    [data.dataset.id],
  );
  if (Number(count.rows[0]?.n) !== data.rows.length) throw new Error("FOREIGN_COUNT_MISMATCH");
  await client.query(
    "update health_foreign_datasets set active=false where year=$1 and active and id<>$2",
    [data.dataset.year, data.dataset.id],
  );
  await client.query("update health_foreign_datasets set active=true where id=$1", [
    data.dataset.id,
  ]);
  await client.query("commit");
  process.stdout.write(
    JSON.stringify({ datasetId: data.dataset.id, premiums: data.rows.length }) + "\n",
  );
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await database.pool.end();
}
