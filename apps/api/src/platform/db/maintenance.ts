import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { assertLocalDatabase, loadEnvironment } from "../config.js";
import { createDatabase } from "./database.js";
import { seedLocalPersonas } from "./seed.js";

async function main() {
  const config = loadEnvironment();
  assertLocalDatabase(config);
  const operation = process.argv[2];
  if (!["migrate", "seed", "reset"].includes(operation ?? ""))
    throw new Error("Expected migrate, seed or reset");
  if (
    operation === "reset" &&
    (!process.argv.includes("--confirm-local-reset") ||
      new URL(config.DATABASE_URL).pathname !== "/coverview_local")
  ) {
    throw new Error("Reset requires --confirm-local-reset and the coverview_local database");
  }
  const database = createDatabase(config);
  database.pool.on("error", () => {
    process.stderr.write("Database idle connection failed\n");
  });
  try {
    if (operation === "reset") {
      // Explicit opt-in, loopback-only, fixed database and fixed technical table.
      await database.pool.query("DROP TABLE IF EXISTS local_preview_personas");
      await database.pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
    }
    if (operation === "migrate" || operation === "reset") {
      await migrate(database.db, {
        migrationsFolder: fileURLToPath(new URL("../../../drizzle/", import.meta.url)),
      });
    }
    if (operation === "seed" || operation === "reset") await seedLocalPersonas(config, database);
    process.stdout.write(`Database ${operation} completed\n`);
  } finally {
    await database.pool.end();
  }
}

main().catch(() => {
  // Driver errors can include credentials. CLI deliberately reports no raw error payload.
  process.stderr.write(
    "Database command failed. Check local configuration, infrastructure and migration state.\n",
  );
  process.exitCode = 1;
});
