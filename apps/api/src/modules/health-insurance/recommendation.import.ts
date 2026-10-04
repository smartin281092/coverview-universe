import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { evidenceCatalogSchema } from "@coverview/contracts/health-recommendation";
import { validateCatalog } from "./recommendation.repository.js";
import { assertLocalDatabase, loadEnvironment } from "../../platform/config.js";
import { createDatabase } from "../../platform/db/database.js";
export async function importRecommendationCatalog(file: URL, validateOnly = false) {
  const catalog = evidenceCatalogSchema.parse(JSON.parse(await readFile(file, "utf8")));
  validateCatalog(catalog);
  if (validateOnly)
    return {
      id: catalog.id,
      models: catalog.models.length,
      benefits: catalog.benefits.length,
      cases: catalog.cases.length,
    };
  const config = loadEnvironment();
  assertLocalDatabase(config);
  const database = createDatabase(config),
    client = await database.pool.connect();
  try {
    await client.query("begin");
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended('health-recommendation-admin',0))",
    );
    const inventory = await client.query<{ id: string; insurer_id: number }>(
      "select id,insurer_id from health_models where dataset_id=$1",
      [catalog.datasetId],
    );
    if (
      inventory.rowCount !== catalog.models.length ||
      inventory.rows.some(
        (row) =>
          !catalog.models.some(
            (model) => model.id === row.id && model.insurerId === row.insurer_id,
          ),
      )
    )
      throw new Error("CATALOG_INVENTORY_MISMATCH");
    await client.query(
      "insert into health_recommendation_catalogs(id,year,dataset_id,data) values($1,$2,$3,$4::jsonb) on conflict(id) do nothing",
      [catalog.id, catalog.year, catalog.datasetId, JSON.stringify(catalog)],
    );
    await client.query("commit");
    return {
      id: catalog.id,
      models: catalog.models.length,
      benefits: catalog.benefits.length,
      cases: catalog.cases.length,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await database.pool.end();
  }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const file = new URL(
    "../../../../../data/health-insurance/2027/recommendation-catalog.json",
    import.meta.url,
  );
  process.stdout.write(
    JSON.stringify(await importRecommendationCatalog(file, process.argv.includes("--validate"))) +
      "\n",
  );
}
