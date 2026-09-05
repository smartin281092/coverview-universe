import { localPersonaSchema, type LocalPersona } from "@coverview/contracts";
import { inArray } from "drizzle-orm";
import { createClient } from "redis";
import type { Environment } from "./config.js";
import { createDatabase } from "./db/database.js";
import { localPreviewPersonas } from "./db/schema.js";
import { localPersonas } from "./db/seed.js";

export type PlatformDependencies = {
  checkReadiness: () => Promise<boolean>;
  readPersonas: () => Promise<LocalPersona[]>;
  close: () => Promise<void>;
};

export function createPlatformDependencies(
  config: Environment,
  reportFailure: (dependency: string) => void,
): PlatformDependencies {
  const database = createDatabase(config);
  database.pool.on("error", () => {
    reportFailure("postgres");
  });

  async function readPersonas(): Promise<LocalPersona[]> {
    const rows = await database.db
      .select()
      .from(localPreviewPersonas)
      .where(
        inArray(
          localPreviewPersonas.id,
          localPersonas.personas.map((persona) => persona.id),
        ),
      )
      .orderBy(localPreviewPersonas.id)
      .limit(10);
    return rows.map((row) => {
      const fixture = localPersonas.personas.find((persona) => persona.id === row.id);
      return localPersonaSchema.parse({
        ...fixture,
        id: row.id,
        email: row.email,
        org: row.spaceLabel,
      });
    });
  }

  async function probeRedis(): Promise<void> {
    const client = createClient({
      url: config.REDIS_URL,
      socket: { connectTimeout: config.DEPENDENCY_TIMEOUT_MS, reconnectStrategy: false },
      disableOfflineQueue: true,
    });
    // The readiness boundary reports failure once; the listener prevents an unhandled EventEmitter error.
    client.on("error", () => {
      /* Handled by the rejected connect/ping operation below. */
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        (async () => {
          await client.connect();
          await client.ping();
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error("Redis readiness timed out"));
          }, config.DEPENDENCY_TIMEOUT_MS);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      if (client.isOpen) client.destroy();
    }
  }

  async function probeHttp(url: URL): Promise<void> {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(config.DEPENDENCY_TIMEOUT_MS),
      redirect: "error",
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error("Service readiness failed");
  }

  return {
    readPersonas,
    async checkReadiness() {
      const checks: [string, Promise<unknown>][] = [
        ["postgres", config.FIXTURE_MODE ? readPersonas() : database.pool.query("SELECT 1")],
        ["redis", probeRedis()],
      ];
      // No provider calls exist when external adapters are disabled.
      if (config.EXTERNAL_ADAPTER_MODE === "local") {
        checks.push(
          ["minio", probeHttp(new URL("/minio/health/ready", config.MINIO_ENDPOINT))],
          ["mailpit", probeHttp(new URL("/readyz", config.MAILPIT_URL))],
        );
      }
      const results = await Promise.all(
        checks.map(async ([dependency, probe]) => {
          try {
            await probe;
            return true;
          } catch {
            reportFailure(dependency);
            return false;
          }
        }),
      );
      return results.every(Boolean);
    },
    async close() {
      await database.pool.end();
    },
  };
}
