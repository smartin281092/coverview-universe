import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient } from "./index.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API client contract boundary", () => {
  it("scopes identity attachment reads and mutations to the chosen profile", async () => {
    const profileId = `prf_${crypto.randomUUID()}`;
    const response = {
      profileId,
      documentType: "passport",
      documentTypeSource: "declared",
      backRequired: false,
      revision: 2,
      combined: null,
      front: null,
      back: null,
      status: "missing",
    };
    const fetch = vi.fn<(url: URL, options: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(Response.json(response)),
    );
    vi.stubGlobal("fetch", fetch);
    const api = createApiClient({ baseUrl: "https://api.example.test" });
    expect(await api.identityAttachment(undefined, { profileId })).toEqual(response);
    expect(fetch.mock.calls[0]?.[0].searchParams.get("profileId")).toBe(profileId);
    const options = { csrfToken: "csrf-memory-only", idempotencyKey: crypto.randomUUID() };
    const input = { profileId, revision: 1, documentType: "passport" as const };
    await api.saveIdentityAttachment(input, options);
    await api.saveIdentityAttachment(input, options);
    for (const [, request] of fetch.mock.calls.slice(1)) {
      expect(JSON.parse(request.body as string)).toEqual(input);
      expect(request).toMatchObject({
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "X-CSRF-Token": options.csrfToken, "Idempotency-Key": options.idempotencyKey },
      });
    }
    expect(() =>
      api.identityAttachment(undefined, { profileId: "self&profileId=foreign" }),
    ).toThrow();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("uses only cookies for authenticated reads and omits credentials for fixtures", async () => {
    const fetch = vi.fn((_url: URL, options: RequestInit) =>
      Promise.resolve(
        Response.json(
          options.credentials === "include"
            ? {
                user: { id: "user_a", email: "a@example.test" },
                session: { id: "session_a", expiresAt: "2026-10-01T00:00:00.000Z" },
                csrfToken: "csrf-memory-only",
                permissions: [],
                refreshToken: "untrusted-extra-field",
              }
            : { mode: "local-fixture", personas: [] },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const api = createApiClient({ baseUrl: "https://api.example.test" });
    const identity = await api.me();
    expect(identity).not.toHaveProperty("refreshToken");
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ credentials: "include", cache: "no-store" });
    expect(fetch.mock.calls[0]?.[1].headers).not.toHaveProperty("Authorization");
    await api.personas();
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({ credentials: "omit" });
  });

  it("sends CSRF and the same caller-owned idempotency key on mutation retry", async () => {
    const fetch = vi.fn<(url: URL, options: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(Response.json({ success: true, remoteRevocation: "pending" })),
    );
    vi.stubGlobal("fetch", fetch);
    const api = createApiClient({ baseUrl: "https://api.example.test" });
    const options = { csrfToken: "csrf-memory-only", idempotencyKey: crypto.randomUUID() };
    await api.logout("all", options);
    await api.logout("all", options);
    for (const [, request] of fetch.mock.calls) {
      expect(request).toMatchObject({
        method: "POST",
        credentials: "include",
        cache: "no-store",
        body: '{"scope":"all"}',
        headers: { "X-CSRF-Token": options.csrfToken, "Idempotency-Key": options.idempotencyKey },
      });
    }
  });

  it("retains identity denials without trusting provider messages", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        Response.json(
          {
            error: {
              code: "IDENTITY_MFA_REQUIRED",
              message: "Untrusted detail",
              requestId: "request_mfa",
            },
          },
          { status: 403, headers: { "x-request-id": "request_mfa" } },
        ),
      ),
    );
    await expect(
      createApiClient({ baseUrl: "https://api.example.test" }).admin(),
    ).rejects.toMatchObject({
      code: "IDENTITY_MFA_REQUIRED",
      message: "IDENTITY_MFA_REQUIRED",
      status: 403,
      requestId: "request_mfa",
    });
  });

  it("rejects unbounded session lists and malformed MFA input before sending", async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(
        Response.json({
          sessions: Array.from({ length: 21 }, () => ({
            id: "session_a",
            device: "Browser",
            createdAt: "2026-09-05T00:00:00.000Z",
            lastSeenAt: "2026-09-05T00:00:00.000Z",
            expiresAt: "2026-10-01T00:00:00.000Z",
            isCurrent: false,
          })),
          nextCursor: null,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const api = createApiClient({ baseUrl: "https://api.example.test" });
    await expect(api.sessions()).rejects.toMatchObject({ code: "PLATFORM_INVALID_RESPONSE" });
    expect(() =>
      api.verifyMfa({ code: "123" }, { csrfToken: "csrf", idempotencyKey: crypto.randomUUID() }),
    ).toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("encodes resource and pagination inputs and fixes the login surface", async () => {
    const fetch = vi.fn<(url: URL, options: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(Response.json({ sessions: [], nextCursor: null })),
    );
    vi.stubGlobal("fetch", fetch);
    const api = createApiClient({ baseUrl: "https://api.example.test" });
    await api.sessions("cursor&role=admin");
    expect(fetch.mock.calls[0]?.[0].searchParams.get("cursor")).toBe("cursor&role=admin");
    expect(fetch.mock.calls[0]?.[0].searchParams.has("role")).toBe(false);
    expect(api.loginUrl("wallet")).toBe("https://api.example.test/auth/login?surface=wallet");
  });

  it("rejects a malformed success response", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(Response.json({ status: "invented" })));
    await expect(
      createApiClient({ baseUrl: "http://127.0.0.1:4100" }).health(),
    ).rejects.toMatchObject({ code: "PLATFORM_INVALID_RESPONSE" });
  });

  it("maps readiness failures and retains server correlation", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        Response.json(
          { status: "not_ready" },
          { status: 503, headers: { "x-request-id": "request_test_1234" } },
        ),
      ),
    );
    await expect(
      createApiClient({ baseUrl: "http://127.0.0.1:4100" }).health(),
    ).rejects.toMatchObject({ code: "PLATFORM_NOT_READY", requestId: "request_test_1234" });
  });

  it("cancels a pending network request on its timeout", async () => {
    vi.stubGlobal(
      "fetch",
      (_url: URL, options: RequestInit) =>
        new Promise((_, reject) => {
          options.signal?.addEventListener(
            "abort",
            () => {
              reject(new Error("Request aborted", { cause: options.signal?.reason }));
            },
            { once: true },
          );
        }),
    );
    const request = createApiClient({ baseUrl: "http://127.0.0.1:4100", timeoutMs: 10 }).health();
    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ code: "PLATFORM_REQUEST_FAILED" });
  });
});
