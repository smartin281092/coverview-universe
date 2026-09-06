import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEnvironment } from "../../platform/config.js";
import { createWorkosProvider } from "./identity.workos.js";

const example = parseEnv(
  readFileSync(new URL("../../../../../.env.example", import.meta.url), "utf8"),
);
const config = parseEnvironment({
  ...example,
  AUTH_ENABLED: "true",
  WORKOS_API_KEY: "fixture_api_key_not_real",
  WORKOS_CLIENT_ID: "client_fixture",
  AUTH_SESSION_SECRET: Buffer.alloc(32, 4).toString("base64"),
});
afterEach(() => vi.unstubAllGlobals());

describe("official WorkOS SDK protocol with local HTTP responses only", () => {
  it("builds an exact callback and a matching S256 PKCE challenge without a credential in the URL", async () => {
    const result = await createWorkosProvider(config).authorization();
    const url = new URL(result.url);
    expect(url.origin).toBe("https://api.workos.com");
    expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:4100/auth/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(
      createHash("sha256").update(result.codeVerifier).digest("base64url"),
    );
    expect(url.searchParams.get("state")).toBe(result.state);
    expect(result.url).not.toContain(config.WORKOS_API_KEY);
    expect(result.url).not.toContain(result.codeVerifier);
  });
  it("validates provider session ownership and refuses a truncated list", async () => {
    let after: string | null = null;
    let userId = "user_fixture";
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string | URL | Request) => {
        expect(url instanceof Request ? url.url : url.toString()).toContain(
          "/user_management/users/user_fixture/sessions",
        );
        return Promise.resolve(
          Response.json({
            object: "list",
            data: [
              {
                object: "session",
                id: "session_fixture",
                user_id: userId,
                status: "active",
                auth_method: "magic_code",
                expires_at: new Date(Date.now() + 3600_000).toISOString(),
                created_at: new Date().toISOString(),
              },
            ],
            list_metadata: { before: null, after },
          }),
        );
      }),
    );
    const provider = createWorkosProvider(config);
    expect(await provider.sessions("user_fixture")).toHaveLength(1);
    after = "page_2";
    await expect(provider.sessions("user_fixture")).rejects.toMatchObject({
      code: "IDENTITY_UNAVAILABLE",
    });
    after = null;
    userId = "other_user";
    await expect(provider.sessions("user_fixture")).rejects.toMatchObject({
      code: "IDENTITY_UNAVAILABLE",
    });
  });
  it("exchanges PKCE through the real SDK, verifies the signed token and discards secrets from its result", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    let issuer = "https://api.workos.com/";
    let subject = "user_fixture";
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string | URL | Request, options?: RequestInit) => {
        if ((url instanceof Request ? url.url : url.toString()).includes("/jwks/"))
          return Promise.resolve(
            Response.json({
              keys: [
                {
                  ...publicKey.export({ format: "jwk" }),
                  kid: "fixture",
                  alg: "RS256",
                  use: "sig",
                },
              ],
            }),
          );
        expect(url instanceof Request ? url.url : url.toString()).toBe(
          "https://api.workos.com/user_management/authenticate",
        );
        if (typeof options?.body !== "string") throw new Error("Expected JSON request body");
        expect(JSON.parse(options.body)).toMatchObject({
          code: "fixture_code",
          code_verifier: "fixture_verifier",
          client_id: "client_fixture",
        });
        const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "fixture" })).toString(
          "base64url",
        );
        const payload = Buffer.from(
          JSON.stringify({
            sub: subject,
            sid: "session_fixture",
            iss: issuer,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 300,
          }),
        ).toString("base64url");
        const signature = sign(
          "RSA-SHA256",
          Buffer.from(`${header}.${payload}`),
          privateKey,
        ).toString("base64url");
        return Promise.resolve(
          Response.json({
            user: {
              object: "user",
              id: "user_fixture",
              email: "user@example.test",
              email_verified: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            access_token: `${header}.${payload}.${signature}`,
            refresh_token: "fixture_refresh_not_real",
            authentication_method: "MagicAuth",
          }),
        );
      }),
    );
    const provider = createWorkosProvider(config);
    expect(await provider.exchange("fixture_code", "fixture_verifier")).toEqual({
      workosUserId: "user_fixture",
      email: "user@example.test",
      workosSessionId: "session_fixture",
    });
    issuer = "https://foreign.example.test/";
    await expect(provider.exchange("fixture_code", "fixture_verifier")).rejects.toMatchObject({
      code: "IDENTITY_INVALID_CALLBACK",
      diagnostic: {
        stage: "token_claims",
        reason: "issuer_mismatch",
        configuredIssuer: "generic",
        tokenIssuer: "custom",
        issuerMatches: false,
      },
    });
    issuer = "https://api.workos.com/";
    subject = "other_user";
    await expect(provider.exchange("fixture_code", "fixture_verifier")).rejects.toMatchObject({
      code: "IDENTITY_INVALID_CALLBACK",
      diagnostic: { stage: "token_claims", reason: "subject_mismatch" },
    });
  });
  it("does not turn a valid challenge for another factor into a session MFA proof", async () => {
    let factor = "factor_fixture";
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          Response.json({
            valid: true,
            challenge: {
              object: "authentication_challenge",
              id: "challenge_fixture",
              authentication_factor_id: factor,
            },
          }),
        ),
      ),
    );
    const provider = createWorkosProvider(config);
    expect(await provider.verify("challenge_fixture", "factor_fixture", "123456")).toBe(true);
    factor = "factor_other";
    expect(await provider.verify("challenge_fixture", "factor_fixture", "123456")).toBe(false);
  });
});
