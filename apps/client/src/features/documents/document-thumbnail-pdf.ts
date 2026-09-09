import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

export function loadThumbnailPdf(data: ArrayBuffer) {
  // Local rendering only: no remote PDF URLs, scripts, forms or annotation layer.
  return getDocument({ data, useWorkerFetch: false, useWasm: false, useSystemFonts: true });
}
