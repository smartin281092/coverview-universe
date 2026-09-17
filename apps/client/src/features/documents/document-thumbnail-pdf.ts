import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { RenderTask } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = workerUrl;

export function loadThumbnailPdf(data: ArrayBuffer) {
  // Local rendering only: no remote PDF URLs, scripts, forms or annotation layer.
  return getDocument({ data, useWorkerFetch: false, useWasm: false, useSystemFonts: true });
}

export async function renderPdfCover(data: ArrayBuffer, parentSignal: AbortSignal): Promise<Blob> {
  const signal = AbortSignal.any([parentSignal, AbortSignal.timeout(20000)]);
  signal.throwIfAborted();
  const loading = loadThumbnailPdf(data);
  let render: RenderTask | undefined;
  const abort = () => {
    render?.cancel();
    void loading.destroy();
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    const pdf = await loading.promise;
    signal.throwIfAborted();
    const page = await pdf.getPage(1);
    signal.throwIfAborted();
    const natural = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 640 / Math.max(natural.width, natural.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    render = page.render({ canvas, viewport });
    await render.promise;
    signal.throwIfAborted();
    const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    signal.throwIfAborted();
    if (!image) throw new Error("PDF cover rendering failed");
    return image;
  } finally {
    signal.removeEventListener("abort", abort);
    await loading.destroy();
  }
}
