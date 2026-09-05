import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { describe, expect, it } from "vitest";
import { assertLocalDatabase, parseEnvironment } from "./config.js";

const local = parseEnv(readFileSync(new URL("../../../../.env.example", import.meta.url), "utf8"));

describe("environment safety boundary", () => {
  it("accepts the documented local fixture configuration", () => {
    const config = parseEnvironment(local);
    expect(config.FIXTURE_MODE).toBe(true);
    expect(() => assertLocalDatabase(config)).not.toThrow();
  });

  it.each(["test", "staging", "production"])("refuses fixtures in %s", (APP_ENV) => {
    expect(() => parseEnvironment({ ...local, APP_ENV })).toThrow("Invalid environment");
  });

  it("rejects a production Node runtime even if labelled local", () => {
    expect(() => parseEnvironment({ ...local, NODE_ENV: "production" })).toThrow(
      "Invalid environment",
    );
  });

  it.each([
    ["API_HOST", "0.0.0.0"],
    ["DATABASE_URL", "postgres://fixture:fixture@database.example/coverview_local"],
    ["DATABASE_URL", "postgres://fixture:fixture@127.0.0.1/coverview_local?host=database.example"],
    ["REDIS_URL", "redis://cache.example:6379"],
    ["MINIO_ENDPOINT", "https://storage.example"],
    ["MAILPIT_URL", "https://mail.example"],
    ["CORS_ORIGINS", "https://app.example"],
  ])("rejects nonlocal fixture configuration through %s", (key, value) => {
    expect(() => parseEnvironment({ ...local, [key]: value })).toThrow("Invalid environment");
  });

  it("does not treat the string false as truthy and disables local routes in production", () => {
    const config = parseEnvironment({
      ...local,
      APP_ENV: "production",
      NODE_ENV: "production",
      FIXTURE_MODE: "false",
      EXTERNAL_ADAPTER_MODE: "disabled",
    });
    expect(config.FIXTURE_MODE).toBe(false);
    expect(() => assertLocalDatabase(config)).toThrow("Database maintenance requires");
  });

  it("rejects missing or malformed required configuration without revealing values", () => {
    expect(() => parseEnvironment({ ...local, APP_ENV: undefined })).toThrow("APP_ENV");
    expect(() => parseEnvironment({ ...local, DATABASE_URL: "invalid-secret-credential" })).toThrow(
      "DATABASE_URL",
    );
    expect(() =>
      parseEnvironment({ ...local, DATABASE_URL: "invalid-secret-credential" }),
    ).not.toThrow("invalid-secret-credential");
  });

  it("refuses maintenance on an unrelated local database", () => {
    const config = parseEnvironment({
      ...local,
      DATABASE_URL: "postgres://fixture:fixture@127.0.0.1/unrelated_database",
    });
    expect(() => assertLocalDatabase(config)).toThrow("Database maintenance requires");
  });
});
