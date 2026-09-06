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
      // The original fixture-only reset must never silently remove identities or audit.
      if (!process.argv.includes("--confirm-identity-reset")) {
        throw new Error(
          "Reset now also requires --confirm-identity-reset for identity and audit data",
        );
      }
      // Explicit opt-in, loopback-only, fixed CoverView tables; no cascade into unrelated schemas.
      await database.pool.query(
        "DROP TABLE IF EXISTS profile_audit_events, profile_commands, profile_choices, profile_drafts, identity_mfa_enrollments, identity_mfa_challenges, identity_audit_events, identity_admin_permissions, identity_sessions, identity_profiles, identity_logins, identity_users",
      );
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
