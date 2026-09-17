import { expect, it } from "vitest";
import { extractDocument } from "./document.extraction.js";
import { readDocumentResult } from "./document.extraction-result.js";

function read(text: string, citation: string, page = 1) {
  return extractDocument(
    {
      available: () => Promise.resolve(true),
      structured: () =>
        Promise.resolve({
          value: {
            pageCount: 2,
            category: "correspondence",
            classification: "power_of_attorney",
            title: "Procuration",
            titleEvidence: { page, text: citation },
            evidence: { page, text: citation },
            insurance: null,
            fields: [],
            pages: [
              { page: 1, text },
              { page: 2, text: "Autre page" },
            ],
          },
          model: "isolated-test",
          inputTokens: 1,
          outputTokens: 1,
          requestId: null,
        }),
    },
    Buffer.from("synthetic test"),
    "application/pdf",
    AbortSignal.timeout(1000),
  );
}

it("preserves the exact source excerpt when only layout whitespace differs", async () => {
  const text = "En-tête\nProcuration\r\n  générale\u00a0de renseignements (2026).\nFin";
  const result = await read(text, "Procuration générale de renseignements (2026).");
  expect(result.analysis.titleSource?.text).toBe(
    "Procuration\r\n  générale\u00a0de renseignements (2026).",
  );
  expect(result.analysis.pages[0]?.text).toBe(text);
});

it.each([
  ["Procuration générale", "Procuration spéciale", 1],
  ["Procuration générale de renseignements", "Procuration renseignements", 1],
  ["Procuration générale", "Procuration générale", 2],
  ["Procuration générale", "   ", 1],
  ["Montant : 120X00", "Montant : 120.00", 1],
] as const)(
  "discards altered, noncontiguous or wrong-page citations while retaining transcription: %s / %s",
  async (text, citation, page) => {
    const result = await read(text, citation, page);
    expect(result.analysis).toMatchObject({
      title: null,
      titleSource: null,
      category: "unknown",
    });
    expect(result.analysis.warnings).toEqual(expect.arrayContaining(["title", "classification"]));
    expect(result.analysis.pages[0]?.text).toBe(text);
  },
);

it("retains good fields independently of invalid fields, dates, metadata and duplicates", () => {
  const evidence = { page: 1, text: "Prénom : Alex" };
  const result = readDocumentResult(
    {
      pageCount: 1,
      pages: [{ page: 1, text: "Prénom : Alex\nNom : Exemple\nDate : illisible" }],
      category: "unsupported",
      classification: "unsupported",
      title: 42,
      insurance: "invalid",
      fields: [
        { field: "firstName", value: "Alex", evidence },
        {
          field: "birthDate",
          value: "invalid-date",
          evidence: { page: 1, text: "Date : illisible" },
        },
        { field: "street", value: "invented", evidence: { page: 1, text: "absent" } },
        { field: "lastName", value: "Exemple", evidence: { page: 1, text: "Nom : Exemple" } },
        { field: "lastName", value: "Autre", evidence },
        { field: "unsupported", value: "invalid", evidence },
      ],
    },
    "isolated-test",
  );
  expect(result.fields.map((field) => ({ field: field.field, value: field.value }))).toEqual([
    { field: "firstName", value: "Alex" },
  ]);
  expect(result.pages).toHaveLength(1);
  expect(result.warnings).toEqual(
    expect.arrayContaining(["fields", "classification", "title", "insurance"]),
  );
});

it("keeps independently valid pages and facts when other pages are malformed or duplicated", () => {
  const result = readDocumentResult(
    {
      pageCount: 3,
      category: "unknown",
      classification: "unknown",
      title: null,
      evidence: null,
      insurance: null,
      pages: [
        { page: 1, text: "Alex" },
        { page: 2, text: "A" },
        { page: 2, text: "B" },
        { page: 3, text: 42 },
      ],
      fields: [{ field: "firstName", value: "Alex", evidence: { page: 1, text: "Alex" } }],
    },
    "isolated-test",
  );
  expect(result.pages.map((page) => page.page)).toEqual([1]);
  expect(result.fields).toHaveLength(1);
  expect(result.warnings).toEqual(["pages"]);
});
