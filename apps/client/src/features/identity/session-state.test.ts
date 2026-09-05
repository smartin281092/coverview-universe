import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import { api } from "../../api";
import { forgetIdentity, identityKey, identityOptions } from "./session-state";

vi.mock("../../api", () => ({ api: { me: vi.fn() } }));
afterEach(() => {
  vi.resetAllMocks();
});

const makeIdentity = (id: string): IdentityMe => ({
  user: { id, email: `${id}@example.test` },
  session: { id: `session_${id}`, expiresAt: "2026-10-01T00:00:00.000Z" },
  csrfToken: "csrf-memory-only",
  permissions: [],
});

describe("private session cache", () => {
  it("cancels an old identity request and removes its private data before exposing a new account", async () => {
    const client = new QueryClient();
    client.setQueryData(identityKey, makeIdentity("a"));
    client.setQueryData(["private", "a", "profile"], { email: "a@example.test" });
    let cancelled = false;
    const previous = client.fetchQuery({
      queryKey: ["private", "a", "pending"],
      queryFn: ({ signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener(
            "abort",
            () => {
              cancelled = true;
              reject(new Error("Aborted"));
            },
            { once: true },
          );
        }),
    });
    const rejection = expect(previous).rejects.toBeDefined();
    vi.mocked(api.me).mockResolvedValue(makeIdentity("b"));
    const current = await client.fetchQuery(identityOptions(client));
    await rejection;
    expect(cancelled).toBe(true);
    expect(current?.user.id).toBe("b");
    expect(client.getQueriesData({ queryKey: ["private"] })).toEqual([]);
    client.clear();
  });

  it("removes private data when the server expires a session", async () => {
    const client = new QueryClient();
    client.setQueryData(identityKey, makeIdentity("a"));
    client.setQueryData(["private", "a", "profile"], { email: "a@example.test" });
    vi.mocked(api.me).mockRejectedValue(new ApiError("IDENTITY_UNAUTHENTICATED", 401));
    expect(await client.fetchQuery(identityOptions(client))).toBeNull();
    expect(client.getQueriesData({ queryKey: ["private"] })).toEqual([]);
    client.clear();
  });

  it("logout cancels an in-flight identity read so it cannot restore the account", async () => {
    const client = new QueryClient();
    client.setQueryData(identityKey, makeIdentity("a"));
    client.setQueryData(["private", "a"], { email: "a@example.test" });
    let resolve: ((identity: IdentityMe) => void) | undefined;
    let authSignal: AbortSignal | undefined;
    vi.mocked(api.me).mockImplementation(
      (options) =>
        new Promise((done) => {
          authSignal = options?.signal;
          resolve = done;
        }),
    );
    const pending = client.fetchQuery(identityOptions(client));
    await forgetIdentity(client);
    expect(authSignal?.aborted).toBe(true);
    resolve?.(makeIdentity("a"));
    // TanStack may resolve cancellation with the previous cache value; it must never restore it.
    await pending.catch(() => null);
    expect(client.getQueryData(identityKey)).toBeNull();
    expect(client.getQueriesData({ queryKey: ["private"] })).toEqual([]);
    client.clear();
  });
});
