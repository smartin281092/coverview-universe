import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { parseEnvironment } from "./config.js";
import { localPersonas } from "./db/seed.js";
import { buildServer } from "./server.js";

const example = parseEnv(
  readFileSync(new URL("../../../../.env.example", import.meta.url), "utf8"),
);
const servers: Awaited<ReturnType<typeof buildServer>>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function server(isReady: boolean, overrides: Record<string, string> = {}) {
  const app = await buildServer(
    parseEnvironment({ ...example, LOG_LEVEL: "silent", ...overrides }),
    {
      checkReadiness: () => Promise.resolve(isReady),
      readPersonas: () => Promise.resolve(localPersonas.personas),
      close: () => Promise.resolve(),
    },
  );
  servers.push(app);
  return app;
}

describe("HTTP platform boundary", () => {
  it("keeps liveness independent from readiness without leaking infrastructure details", async () => {
    const app = await server(false);
    expect((await app.inject("/health/live")).json()).toEqual({ status: "alive" });
    const ready = await app.inject("/health/ready");
    expect(ready.statusCode).toBe(503);
    expect(ready.json()).toEqual({ status: "not_ready" });
    expect((await app.inject("/health")).statusCode).toBe(503);
  });

  it("validates the healthy response and propagates a bounded request ID", async () => {
    const app = await server(true);
    const response = await app.inject({
      url: "/health",
      headers: { "x-request-id": "request_test_1234" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ready" });
    expect(response.headers["x-request-id"]).toBe("request_test_1234");
    expect(response.headers["cache-control"]).toBe("no-store");
    const injected = await app.inject({
      url: "/health/live",
      headers: { "x-request-id": "bad id with spaces" },
    });
    expect(injected.headers["x-request-id"]).not.toBe("bad id with spaces");
  });

  it.each([
    { name: "malformed JSON", payload: "{", status: 400 },
    { name: "oversized JSON", payload: JSON.stringify({ x: "x".repeat(20000) }), status: 413 },
  ])(
    "preserves the client status for $name without exposing parser details",
    async ({ payload, status }) => {
      const app = await server(true);
      const response = await app.inject({
        method: "POST",
        url: "/health",
        headers: { "content-type": "application/json", "x-request-id": "request_parser_1234" },
        payload,
      });
      expect(response.statusCode).toBe(status);
      expect(response.json()).toEqual({
        error: {
          code: "PLATFORM_INVALID_REQUEST",
          message: "PLATFORM_INVALID_REQUEST",
          requestId: "request_parser_1234",
        },
      });
    },
  );

  it("exposes local personas only through a loopback request with a loopback host", async () => {
    const app = await server(true);
    expect((await app.inject("/local/personas")).json()).toEqual(localPersonas);
    const rebinding = await app.inject({
      url: "/local/personas",
      headers: { host: "attacker.example" },
    });
    expect(rebinding.statusCode).toBe(403);
    const remote = await app.inject({ url: "/local/personas", remoteAddress: "192.0.2.1" });
    expect(remote.statusCode).toBe(403);
  });

  it("does not register fixture routes in production", async () => {
    const app = await server(true, {
      APP_ENV: "production",
      NODE_ENV: "production",
      FIXTURE_MODE: "false",
      EXTERNAL_ADAPTER_MODE: "disabled",
    });
    const response = await app.inject("/local/personas");
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: "PLATFORM_NOT_FOUND" } });
  });

  it("does not authorize CORS for an unlisted browser origin", async () => {
    const app = await server(true);
    const denied = await app.inject({
      url: "/health",
      headers: { origin: "https://attacker.example" },
    });
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
    const allowed = await app.inject({
      url: "/health",
      headers: { origin: "http://127.0.0.1:4101" },
    });
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:4101");
  });
});
