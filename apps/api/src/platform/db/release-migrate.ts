import { readdirSync } from "node:fs";
import { join } from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadEnvironment } from "../config.js";
import { createDatabase } from "./database.js";

// Deployed runtimes only. The local maintenance command keeps its loopback guard; this one
// applies exactly the migration set the operator approved for the release, and nothing else.
async function main() {
  const config = loadEnvironment();
  if (!["staging", "production"].includes(config.APP_ENV) || config.NODE_ENV !== "production")
    throw new Error("Release migrations run only in a deployed staging or production runtime");
  const folder = process.env.MIGRATIONS_FOLDER ?? join(process.cwd(), "drizzle");
  const files = readdirSync(folder).filter((name) => /^\d{4}_[\w-]+\.sql$/u.test(name));
  // The operator states how many migrations the release carries: any other set is refused.
  if (Number(process.env.MIGRATIONS_APPROVED) !== files.length)
    throw new Error(`Release migrations require MIGRATIONS_APPROVED=${files.length}`);
  const database = createDatabase({ ...config, DEPENDENCY_TIMEOUT_MS: 60000 });
  database.pool.on("error", () => {
    process.stderr.write("Database idle connection failed\n");
  });
  try {
    await migrate(database.db, { migrationsFolder: folder });
    const applied = await database.pool.query<{ count: number }>(
      "select count(*)::int count from drizzle.__drizzle_migrations",
    );
    process.stdout.write(`Release migrations completed: ${applied.rows[0]!.count} applied\n`);
  } finally {
    await database.pool.end();
  }
}

main().catch((error: unknown) => {
  // Driver errors can include credentials: only this command's own messages are shown.
  process.stderr.write(
    error instanceof Error && error.message.startsWith("Release migrations")
      ? `${error.message}\n`
      : "Release migration failed. Check configuration, connectivity and migration state.\n",
  );
  process.exitCode = 1;
});
