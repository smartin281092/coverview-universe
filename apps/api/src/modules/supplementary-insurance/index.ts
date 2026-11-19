import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  supplementaryAssistantInputSchema,
  supplementaryAssistantResultSchema,
  supplementaryOrderInputSchema,
  supplementaryOrderReceiptSchema,
  supplementaryQuoteInputSchema,
  supplementaryQuoteSchema,
} from "@coverview/contracts/supplementary-insurance";
import { isLoopback, type Environment } from "../../platform/config.js";
import { createDatabase } from "../../platform/db/database.js";
import { createOpenAiTextProvider, LlmError } from "../../platform/llm-provider.js";
import { createMailer } from "../../platform/mailer.js";
import { runAssistant } from "./supplementary.assistant.js";
import { interpretWithRules } from "./supplementary.interpret.js";
import { startSupplementaryJobs } from "./supplementary.jobs.js";
import { createLlmInterpreter, supplementaryPromptVersion } from "./supplementary.llm.js";
import { receiveSupplementaryOrder, supplementaryOrderPreview } from "./supplementary.orders.js";
import { createSupplementaryRepository } from "./supplementary.repository.js";

// Public, anonymous routes of the supplementary insurance comparator (19 November 2026).
// Read-only except orders; no cookie, no session; the assistant keeps nothing and never logs the
// message (length, engine and duration only).
const llmSettingsSchema = z.object({
  OPENAI_API_KEY: z.string().min(20).optional(),
  OPENAI_DOCUMENT_MODEL: z
    .string()
    .regex(/^[a-zA-Z0-9.-]{1,100}$/u)
    .default("gpt-5.4-mini"),
});
// LLM-03: OpenAI calls of the assistant per instance and per UTC day; beyond, the rules answer.
const dailyLlmCalls = 2000;

export function registerSupplementaryInsurance(server: FastifyInstance, config: Environment) {
  const app = server.withTypeProvider<ZodTypeProvider>();
  const database = createDatabase(config);
  database.pool.on("error", () =>
    app.log.warn({ dependency: "supplementary_database" }, "Supplementary catalogue unavailable"),
  );
  const repository = createSupplementaryRepository(database.pool);
  const mailer = createMailer(config);
  let stopJobs: (() => Promise<void>) | undefined;
  // Notices leave as soon as email works; without an adapter the orders wait in their table.
  app.addHook("onReady", async () => {
    if (mailer)
      stopJobs = await startSupplementaryJobs(config.REDIS_URL, database.pool, app.log, mailer, {
        notifyEmail: config.SUPPLEMENTARY_NOTIFY_EMAIL,
      });
  });
  app.addHook("onClose", async () => {
    await stopJobs?.();
    await database.pool.end();
  });

  const llm = llmSettingsSchema.parse(process.env);
  const provider = createOpenAiTextProvider({
    OPENAI_API_KEY: llm.OPENAI_API_KEY,
    model: llm.OPENAI_DOCUMENT_MODEL,
    local:
      (config.APP_ENV === "local" || config.APP_ENV === "development") &&
      config.NODE_ENV !== "production",
  });
  const interpreters = new Map<string, ReturnType<typeof createLlmInterpreter>>();
  const budget = { day: "", calls: 0 };

  // The catalogue is validated by supplementaryCatalogSchema when it is loaded, then sent as the
  // serialized string kept with it (2.5 MB: no second validation per request), compressed when
  // the browser accepts it. The weak ETag names the catalogue, whatever its encoding.
  server.get(
    "/supplementary-insurance/catalog",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const loaded = await repository.current();
      const etag = `W/"${loaded.catalog.id}"`;
      const match = String(request.headers["if-none-match"] ?? "")
        .split(",")
        .map((value) => value.trim().replace(/^W\//u, ""));
      reply
        .header("etag", etag)
        .header("cache-control", "public, max-age=300")
        .header("vary", "Accept-Encoding");
      if (match.includes(etag.slice(2)) || match.includes("*")) return reply.code(304).send();
      const accepted = acceptedEncodings(request.headers["accept-encoding"]);
      reply.type("application/json; charset=utf-8");
      if (accepted.has("br")) return reply.header("content-encoding", "br").send(loaded.br);
      if (accepted.has("gzip")) return reply.header("content-encoding", "gzip").send(loaded.gzip);
      return reply.send(loaded.json);
    },
  );

  app.post(
    "/supplementary-insurance/quote",
    {
      bodyLimit: 1024,
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: { body: supplementaryQuoteInputSchema, response: { 200: supplementaryQuoteSchema } },
    },
    async (request) => repository.quote(request.body),
  );

  app.post(
    "/supplementary-insurance/assistant",
    {
      bodyLimit: 8192,
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        body: supplementaryAssistantInputSchema,
        response: { 200: supplementaryAssistantResultSchema },
      },
    },
    async (request) => {
      const started = Date.now();
      const { catalog, index } = await repository.current();
      let fallback: string | null = null;
      const interpret = async (message: string) => {
        const rules = () => ({
          engine: "rules" as const,
          interpretation: interpretWithRules(message, catalog),
        });
        const day = new Date().toISOString().slice(0, 10);
        if (budget.day !== day) Object.assign(budget, { day, calls: 0 });
        if (budget.calls >= dailyLlmCalls || !(await provider.available())) return rules();
        budget.calls += 1;
        let interpreter = interpreters.get(catalog.id);
        if (!interpreter) {
          interpreters.clear();
          interpreter = createLlmInterpreter(provider, catalog);
          interpreters.set(catalog.id, interpreter);
        }
        try {
          const { interpretation, usage } = await interpreter(message);
          request.log.info(
            {
              prompt: supplementaryPromptVersion,
              model: usage.model,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
            },
            "Supplementary assistant interpretation",
          );
          return { engine: "llm" as const, interpretation };
        } catch (error) {
          // LLM-02: the rules answer instead; the code only, never the message or the output.
          fallback = error instanceof LlmError ? error.code : "ai_invalid_result";
          return rules();
        }
      };
      const result = await runAssistant(request.body, {
        index,
        premiums: (pairs) => repository.premiums(catalog.id, pairs),
        interpret,
      });
      request.log.info(
        {
          length: request.body.message.length,
          engine: result.engine,
          fallback,
          durationMs: Date.now() - started,
        },
        "Supplementary assistant answered",
      );
      return result;
    },
  );

  // Orders, sent from the visitor's browser: no secret can authenticate them, hence a small body,
  // strict validation and a per-address limit (as the horizon3 orders).
  app.post(
    "/supplementary-insurance/orders",
    {
      bodyLimit: 4096,
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        body: supplementaryOrderInputSchema,
        response: { 200: supplementaryOrderReceiptSchema },
      },
    },
    async (request) => receiveSupplementaryOrder(database.pool, repository, request.body),
  );

  if (mailer)
    // MAIL-03 preview, local adapters only, fictitious variables, loopback only.
    app.get(
      "/local/emails/supplementary-order",
      {
        schema: { querystring: z.object({ format: z.enum(["html", "text"]).default("html") }) },
        onRequest: async (request, reply) => {
          if (!isLoopback(request.ip) || !isLoopback(request.hostname))
            return reply.code(404).send();
        },
      },
      async (request, reply) => {
        const message = supplementaryOrderPreview();
        return request.query.format === "text"
          ? reply.type("text/plain; charset=utf-8").send(message.text)
          : reply.type("text/html; charset=utf-8").send(message.html);
      },
    );
}
// Codings the client accepts, without the ones it refuses with q=0.
function acceptedEncodings(header: string | string[] | undefined) {
  const accepted = new Set<string>();
  for (const part of String(header ?? "").split(",")) {
    const [name, ...parameters] = part.trim().toLowerCase().split(";");
    const quality = parameters.find((value) => value.trim().startsWith("q="));
    if (name && !(quality && Number(quality.trim().slice(2)) === 0)) accepted.add(name);
  }
  return accepted;
}
export { SupplementaryError } from "./supplementary.repository.js";
