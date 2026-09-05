import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import { parseEnvironment, type Environment } from "../config.js";
import { createDatabase } from "./database.js";
import { localPreviewPersonas } from "./schema.js";
import { localPersonas, seedLocalPersonas } from "./seed.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let config: Environment;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_test")
    .start();
  const example = parseEnv(
    readFileSync(new URL("../../../../../.env.example", import.meta.url), "utf8"),
  );
  config = parseEnvironment({
    ...example,
    DATABASE_URL: container.getConnectionUri(),
    LOG_LEVEL: "silent",
  });
  database = createDatabase(config);
});

afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});

it("replays the real PostgreSQL migration and fixture seed without duplication", async () => {
  const migrationsFolder = fileURLToPath(new URL("../../../drizzle/", import.meta.url));
  await migrate(database.db, { migrationsFolder });
  await migrate(database.db, { migrationsFolder });
  await seedLocalPersonas(config, database);
  const first = await database.db
    .select()
    .from(localPreviewPersonas)
    .orderBy(localPreviewPersonas.id)
    .limit(10);
  await seedLocalPersonas(config, database);
  const second = await database.db
    .select()
    .from(localPreviewPersonas)
    .orderBy(localPreviewPersonas.id)
    .limit(10);
  expect(second).toEqual(first);
  expect(second).toHaveLength(localPersonas.personas.length);
  expect(new Set(second.map((persona) => persona.spaceLabel)).size).toBe(2);
  await expect(
    database.db
      .insert(localPreviewPersonas)
      .values({ id: "fixture_invalid", email: "real@example.com", spaceLabel: "Invalid" }),
  ).rejects.toThrow();
});
