import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { describe, expect, it } from "vitest";
import { assertLocalDatabase, parseEnvironment } from "./config.js";

const local = parseEnv(readFileSync(new URL("../../../../.env.example", import.meta.url), "utf8"));
const auth = {
  ...local,
  AUTH_ENABLED: "true",
  WORKOS_API_KEY: "fixture_not_real",
  WORKOS_CLIENT_ID: "client_fixture",
  AUTH_SESSION_SECRET: Buffer.alloc(32, 7).toString("base64"),
};

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

  it("trusts no proxy unless a bounded number of hops is configured", () => {
    expect(parseEnvironment(local).TRUST_PROXY_HOPS).toBe(0);
    expect(parseEnvironment({ ...local, TRUST_PROXY_HOPS: "1" }).TRUST_PROXY_HOPS).toBe(1);
    for (const value of ["-1", "4", "true"])
      expect(() => parseEnvironment({ ...local, TRUST_PROXY_HOPS: value })).toThrow(
        "TRUST_PROXY_HOPS",
      );
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
  it("requires authentication credentials and an exact 32-byte server key", () => {
    expect(parseEnvironment(auth).AUTH_ENABLED).toBe(true);
    for (const key of ["WORKOS_API_KEY", "WORKOS_CLIENT_ID", "AUTH_SESSION_SECRET"]) {
      expect(() => parseEnvironment({ ...auth, [key]: undefined })).toThrow(key);
    }
    expect(() => parseEnvironment({ ...auth, AUTH_SESSION_SECRET: "fixture_too_short" })).toThrow(
      "AUTH_SESSION_SECRET",
    );
  });
  it("repairs the documented local OIDC/session issuer mix-up without adopting arbitrary issuers", () => {
    const oidcIssuer = `https://api.workos.com/user_management/${auth.WORKOS_CLIENT_ID}`;
    expect(parseEnvironment({ ...auth, WORKOS_ISSUER: oidcIssuer }).WORKOS_ISSUER).toBe(
      "https://api.workos.com/",
    );
    for (const WORKOS_ISSUER of [
      "https://auth.example.test/",
      "https://api.workos.com/user_management/client_other",
      `${oidcIssuer}/unexpected`,
    ]) {
      expect(parseEnvironment({ ...auth, WORKOS_ISSUER }).WORKOS_ISSUER).toBe(WORKOS_ISSUER);
    }
    expect(
      parseEnvironment({
        ...auth,
        AUTH_ENABLED: "false",
        APP_ENV: "production",
        NODE_ENV: "production",
        FIXTURE_MODE: "false",
        EXTERNAL_ADAPTER_MODE: "disabled",
        WORKOS_ISSUER: oidcIssuer,
      }).WORKOS_ISSUER,
    ).toBe(oidcIssuer);
  });
  it.each([
    "AUTH_API_ORIGIN",
    "AUTH_WALLET_ORIGIN",
    "AUTH_ADMIN_ORIGIN",
    "AUTH_WWW_ORIGIN",
    "WORKOS_ISSUER",
  ])("never reveals a malformed authentication URL in %s", (key) => {
    expect(() => parseEnvironment({ ...auth, [key]: "invalid-sensitive-value" })).toThrow(
      "Invalid environment configuration",
    );
    expect(() => parseEnvironment({ ...auth, [key]: "invalid-sensitive-value" })).not.toThrow(
      "invalid-sensitive-value",
    );
  });
  it("rejects nonexact, cross-host or nonallowlisted authentication surfaces", () => {
    for (const AUTH_WALLET_ORIGIN of [
      "http://127.0.0.1:4101/path",
      "http://127.0.0.1:4199",
      "http://localhost:4101",
      "http://foreign.example.test",
    ]) {
      expect(() => parseEnvironment({ ...auth, AUTH_WALLET_ORIGIN })).toThrow(
        "Invalid environment",
      );
    }
    expect(() => parseEnvironment({ ...auth, WORKOS_ISSUER: "http://api.workos.com" })).toThrow(
      "WORKOS_ISSUER",
    );
  });
  it("requires HTTPS for enabled authentication outside local development", () => {
    expect(() =>
      parseEnvironment({
        ...auth,
        APP_ENV: "production",
        NODE_ENV: "production",
        FIXTURE_MODE: "false",
        EXTERNAL_ADAPTER_MODE: "disabled",
      }),
    ).toThrow("AUTH_API_ORIGIN");
  });
});
