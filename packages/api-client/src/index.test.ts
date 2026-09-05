import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient } from "./index.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API client contract boundary", () => {
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
