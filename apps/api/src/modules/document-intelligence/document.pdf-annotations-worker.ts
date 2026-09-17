import { parentPort, workerData } from "node:worker_threads";
import {
  PDFDocument,
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFString,
  PDFHexString,
} from "@cantoo/pdf-lib";

async function readAnnotations() {
  const pdf = await PDFDocument.load(workerData as Uint8Array, { updateMetadata: false });
  const annotations: { page: number; rectangle: number[]; text: string }[] = [];
  let partial = false;
  let length = 0;
  let visited = 0;
  for (const [index, page] of pdf.getPages().slice(0, 20).entries()) {
    try {
      for (const ref of page.node.Annots()?.asArray() ?? []) {
        if (++visited > 500) return { annotations, partial: true };
        try {
          const item = pdf.context.lookup(ref);
          if (
            !(item instanceof PDFDict) ||
            item.get(PDFName.of("Subtype")) !== PDFName.of("FreeText")
          )
            continue;
          const flags = item.lookupMaybe(PDFName.of("F"), PDFNumber)?.asNumber() ?? 0;
          if (flags & (1 | 2 | 32)) continue;
          const content = item.lookup(PDFName.of("Contents"));
          if (!(content instanceof PDFString || content instanceof PDFHexString)) continue;
          const rect = item.lookupMaybe(PDFName.of("Rect"), PDFArray);
          if (rect?.size() !== 4) continue;
          const rectangle = rect
            .asArray()
            .map((value) => (value instanceof PDFNumber ? value.asNumber() : NaN));
          if (!rectangle.every(Number.isFinite)) continue;
          const [left, bottom, right, top] = rectangle as [number, number, number, number];
          const box = page.getCropBox();
          if (
            right <= left ||
            top <= bottom ||
            right <= box.x ||
            left >= box.x + box.width ||
            top <= box.y ||
            bottom >= box.y + box.height
          )
            continue;
          const text = content.decodeText().trim();
          if (!text || text.length > 2000) continue;
          if (length + text.length > 16000) return { annotations, partial: true };
          length += text.length;
          annotations.push({ page: index + 1, rectangle, text });
        } catch {
          partial = true;
        }
      }
    } catch {
      partial = true;
    }
  }
  return { annotations, partial };
}

void readAnnotations().then(
  (result) => parentPort?.postMessage(result),
  () => parentPort?.postMessage({ failed: true }),
);
