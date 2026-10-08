import { afterEach, expect, it, vi } from "vitest";
import { createOpenAiProvider, LlmError } from "./llm-provider.js";

afterEach(() => vi.unstubAllGlobals());

it.each([
  [
    429,
    { code: "credit_balance_exhausted", type: "insufficient_quota" },
    "ai_quota_exhausted",
    false,
  ],
  [429, { code: "insufficient_quota" }, "ai_quota_exhausted", false],
  [429, { code: "another_billing_code", type: "insufficient_quota" }, "ai_quota_exhausted", false],
  [429, { code: "rate_limit_exceeded", type: "requests" }, "ai_rate_limited", true],
  [401, { code: "invalid_api_key" }, "ai_not_configured", false],
  [503, { code: "server_error" }, "ai_unavailable", true],
] as const)(
  "maps HTTP %s / %j to a safe actionable failure",
  async (status, error, code, retryable) => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { error: { ...error, message: "Private provider details must stay private" } },
          { status },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const provider = createOpenAiProvider({
      OPENAI_API_KEY: "unit-test-placeholder",
      OPENAI_DOCUMENT_MODEL: "gpt-5.4-mini",
      OPENAI_DOCUMENT_MAX_OUTPUT_TOKENS: 1000,
    });
    const result = provider.structured({
      instructions: "Adapter error handling only",
      mime: "application/pdf",
      bytes: Buffer.alloc(0),
      schema: {},
      signal: new AbortController().signal,
    });
    await expect(result).rejects.toBeInstanceOf(LlmError);
    await expect(result).rejects.toMatchObject({
      message: code,
      code,
      retryable,
    });
    await expect(result).rejects.not.toHaveProperty("cause");
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);

it.each(["not-json", "x".repeat(16385)])(
  "bounds and tolerates an unreadable 429 body",
  async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 429 })));
    const provider = createOpenAiProvider({
      OPENAI_API_KEY: "unit-test-placeholder",
      OPENAI_DOCUMENT_MODEL: "gpt-5.4-mini",
      OPENAI_DOCUMENT_MAX_OUTPUT_TOKENS: 1000,
    });
    await expect(
      provider.structured({
        instructions: "Adapter error handling only",
        mime: "application/pdf",
        bytes: Buffer.alloc(0),
        schema: {},
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: "ai_rate_limited", retryable: true });
  },
);

it("names an output cut short by the token limit, without retrying", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        model: "gpt-5.4-mini",
        output: [],
        usage: { input_tokens: 10, output_tokens: 1000 },
      }),
    ),
  );
  const provider = createOpenAiProvider({
    OPENAI_API_KEY: "unit-test-placeholder",
    OPENAI_DOCUMENT_MODEL: "gpt-5.4-mini",
    OPENAI_DOCUMENT_MAX_OUTPUT_TOKENS: 1000,
  });
  await expect(
    provider.structured({
      instructions: "Adapter error handling only",
      mime: "application/pdf",
      bytes: Buffer.alloc(0),
      schema: {},
      signal: new AbortController().signal,
    }),
  ).rejects.toMatchObject({ code: "ai_incomplete", retryable: false, diagnostic: "output_limit" });
});
