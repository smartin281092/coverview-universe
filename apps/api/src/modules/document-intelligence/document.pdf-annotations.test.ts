import { PDFDocument, PDFHexString } from "@cantoo/pdf-lib";
import { expect, it } from "vitest";
import { pdfAnnotationText } from "./document.pdf-annotations.js";
import { extractDocument } from "./document.extraction.js";

async function annotatedPdf() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([600, 800]);
  for (const [text, flags, rect, subtype] of [
    ["Client : Alex Exemple", 4, [10, 400, 200, 425], "FreeText"],
    ["Masqué", 2, [10, 350, 200, 375], "FreeText"],
    ["Invisible", 32, [10, 300, 200, 325], "FreeText"],
    ["Hors page", 4, [700, 300, 800, 325], "FreeText"],
    ["Commentaire", 4, [10, 250, 200, 275], "Text"],
  ] as const) {
    page.node.addAnnot(
      pdf.context.register(
        pdf.context.obj({
          Type: "Annot",
          Subtype: subtype,
          Rect: [...rect],
          Contents: PDFHexString.fromText(text),
          F: flags,
        }),
      ),
    );
  }
  return Buffer.from(await pdf.save());
}

it("reads only visible FreeText annotations with their page position, preserving the original", async () => {
  const bytes = await annotatedPdf();
  const original = Buffer.from(bytes);
  const result = await pdfAnnotationText(bytes, AbortSignal.timeout(10000));
  expect(result.failed).toBe(false);
  expect(JSON.parse(result.text!)).toEqual([
    { page: 1, rectangle: [10, 400, 200, 425], text: "Client : Alex Exemple" },
  ]);
  expect(bytes.equals(original)).toBe(true);
});

it("passes annotations to extraction without changing the original PDF", async () => {
  const bytes = await annotatedPdf();
  const result = await extractDocument(
    {
      available: () => Promise.resolve(true),
      structured: (input) => {
        expect(input.bytes.equals(bytes)).toBe(true);
        expect(input.annotationText).toContain("Client : Alex Exemple");
        return Promise.resolve({
          value: {
            pageCount: 1,
            category: "unknown",
            classification: "unknown",
            title: null,
            titleEvidence: null,
            evidence: null,
            insurance: null,
            pages: [{ page: 1, text: "Client : Alex Exemple" }],
            fields: [
              {
                field: "firstName",
                value: "Alex",
                evidence: { page: 1, text: "Client : Alex Exemple" },
              },
            ],
          },
          model: "isolated-test",
          inputTokens: 1,
          outputTokens: 1,
          requestId: null,
        });
      },
    },
    bytes,
    "application/pdf",
    AbortSignal.timeout(10000),
  );
  expect(result.analysis.fields[0]?.value).toBe("Alex");
  expect(result.analysis.warnings).toEqual([]);
});

it("falls back on unreadable PDFs and honors cancellation", async () => {
  expect(await pdfAnnotationText(Buffer.from("invalid"), AbortSignal.timeout(10000))).toEqual({
    failed: true,
  });
  const controller = new AbortController();
  controller.abort(new Error("cancelled"));
  await expect(pdfAnnotationText(Buffer.from("invalid"), controller.signal)).rejects.toThrow(
    "cancelled",
  );
});

it("keeps usable annotations when a later annotation is malformed", async () => {
  const pdf = await PDFDocument.load(await annotatedPdf());
  pdf
    .getPages()[0]!
    .node.addAnnot(pdf.context.register(pdf.context.obj({ Subtype: "FreeText", F: "invalid" })));
  const result = await pdfAnnotationText(Buffer.from(await pdf.save()), AbortSignal.timeout(10000));
  expect(result.failed).toBe(true);
  expect(result.text).toContain("Client : Alex Exemple");
});
