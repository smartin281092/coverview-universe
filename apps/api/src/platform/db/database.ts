import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import type { Environment } from "../config.js";

export function createDatabase(
  config: Pick<Environment, "DATABASE_URL" | "DEPENDENCY_TIMEOUT_MS">,
) {
  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: config.DEPENDENCY_TIMEOUT_MS,
    idleTimeoutMillis: 10000,
    statement_timeout: config.DEPENDENCY_TIMEOUT_MS,
    query_timeout: config.DEPENDENCY_TIMEOUT_MS,
    application_name: "coverview-api",
  });
  return { pool, db: drizzle(pool) };
}
