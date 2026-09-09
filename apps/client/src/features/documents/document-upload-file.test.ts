import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { PDFDocument } from "@cantoo/pdf-lib";
import { prepareDocumentFile } from "./document-upload-file";

it("keeps one original unchanged and embeds exact sources in ordered multipage PDFs", async () => {
  const original = Uint8Array.from(
    await readFile(
      fileURLToPath(new URL("../../../../../assets/brand/palette-source.png", import.meta.url)),
    ),
  );
  const first = new File([original], "première.png", { type: "image/png" });
  const second = new File([original], "seconde.png", { type: "image/png" });
  const signal = new AbortController().signal;
  expect(await prepareDocumentFile([first], "unused", signal)).toBe(first);
  const combined = await prepareDocumentFile([second, first], "Photos", signal);
  expect(combined.name).toBe("Photos.pdf");
  expect(combined.type).toBe("application/pdf");
  const reopened = await PDFDocument.load(await combined.arrayBuffer());
  expect(reopened.getPageCount()).toBe(2);
  const attachments = reopened.getAttachments();
  expect(attachments.map((file) => file.name)).toEqual(["1-seconde.png", "2-première.png"]);
  for (const file of attachments) expect(file.data).toEqual(original);
});

it("does not rewrite a PDF as photos and cancels preparation before any generated upload", async () => {
  const pdf = new File([new Uint8Array([37, 80, 68, 70])], "unchanged.pdf", {
    type: "application/pdf",
  });
  const signal = new AbortController().signal;
  expect(await prepareDocumentFile([pdf], "unused", signal)).toBe(pdf);
  await expect(prepareDocumentFile([pdf, pdf], "mixed", signal)).rejects.toMatchObject({
    code: "photosOnly",
  });
  const cancelled = new AbortController();
  cancelled.abort();
  await expect(prepareDocumentFile([pdf], "cancelled", cancelled.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
});
