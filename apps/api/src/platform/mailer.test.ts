import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { afterAll, beforeAll, expect, it } from "vitest";
import { parseEnvironment } from "./config.js";
import { createMailer, createResendMailer, type MailMessage } from "./mailer.js";

// Resend adapter (16 October 2026, answer 2a), against a local stand-in of its HTTP API.
const received: { method?: string; url?: string; headers: IncomingHttpHeaders; body: string }[] =
  [];
let status = 200;
const server = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk: Buffer) => (body += chunk.toString()));
  request.on("end", () => {
    received.push({ method: request.method, url: request.url, headers: request.headers, body });
    response.writeHead(status, { "content-type": "application/json" });
    response.end(status === 200 ? '{"id":"email_1"}' : '{"message":"rejected"}');
  });
});
let endpoint = "";
const message: MailMessage = {
  to: "notices@intake.test",
  subject: "Sujet",
  text: "Texte",
  html: "<p>Texte</p>",
  tag: "horizon3-request-v2",
  reference: "pext_reference",
};

it("sends through Resend once per message content, and reports a refusal without its content", async () => {
  const mailer = createResendMailer(
    "re_test_key_123",
    "CoverView <notifications@mail.test>",
    endpoint,
  );
  await mailer.send(message);
  await mailer.send(message);
  await mailer.send({ ...message, text: "Nouveau lien" });
  expect(received).toHaveLength(3);
  const [first, retry, renewed] = received;
  expect(first).toMatchObject({ method: "POST", url: "/emails" });
  expect(first!.headers.authorization).toBe("Bearer re_test_key_123");
  expect(first!.headers["content-type"]).toBe("application/json");
  expect(JSON.parse(first!.body)).toEqual({
    from: "CoverView <notifications@mail.test>",
    to: ["notices@intake.test"],
    subject: "Sujet",
    text: "Texte",
    html: "<p>Texte</p>",
    headers: { "X-CoverView-Reference": "pext_reference" },
    tags: [{ name: "template", value: "horizon3-request-v2" }],
  });
  // The same message keeps its idempotency key; a renewed content gets another one.
  expect(first!.headers["idempotency-key"]).toMatch(/^pext_reference:[a-f0-9]{64}$/u);
  expect(retry!.headers["idempotency-key"]).toBe(first!.headers["idempotency-key"]);
  expect(renewed!.headers["idempotency-key"]).not.toBe(first!.headers["idempotency-key"]);

  status = 422;
  const refusal = await mailer.send(message).catch((error: unknown) => error);
  expect(refusal).toBeInstanceOf(Error);
  expect((refusal as Error).message).toBe("MAIL_REJECTED_422");
  status = 200;
});

it("chooses Mailpit locally, Resend with its key, and nothing otherwise", () => {
  const example = parseEnv(
    readFileSync(new URL("../../../../.env.example", import.meta.url), "utf8"),
  );
  const local = parseEnvironment(example);
  expect(createMailer(local)).not.toBeNull();
  const remote = { ...local, EXTERNAL_ADAPTER_MODE: "disabled" as const };
  expect(createMailer(remote)).toBeNull();
  expect(createMailer({ ...remote, RESEND_API_KEY: "re_test_key_123" })).not.toBeNull();
  expect(local.MAIL_FROM).toBe("CoverView <notifications@mail.coverview.ch>");
  for (const invalid of [
    { RESEND_API_KEY: "sk_test_123456" },
    { MAIL_FROM: "notifications@mail.test" },
  ])
    expect(() => parseEnvironment({ ...example, ...invalid })).toThrow(Object.keys(invalid)[0]);
});

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/emails`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
