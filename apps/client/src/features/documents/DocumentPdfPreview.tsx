import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from "pdfjs-dist";
import { Button, LoadingState } from "@coverview/ui";
import { IdentityPreviewCanvas } from "./IdentityPreviewCanvas";

export function DocumentPdfPreview({
  blob,
  name,
  initialPage,
}: {
  blob: Blob;
  name: string;
  initialPage: number;
}) {
  const { t } = useTranslation("identityPreview");
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(initialPage);

  useEffect(() => {
    let active = true;
    let loading: PDFDocumentLoadingTask | undefined;
    setPdf(undefined);
    setFailed(false);
    const timeout = window.setTimeout(() => {
      active = false;
      setFailed(true);
      void loading?.destroy();
    }, 20000);
    void (async () => {
      const { loadThumbnailPdf } = await import("./document-thumbnail-pdf");
      const bytes = await blob.arrayBuffer();
      if (!active) return;
      loading = loadThumbnailPdf(bytes);
      const loaded = await loading.promise;
      if (active) {
        setPage(Math.max(1, Math.min(initialPage, loaded.numPages)));
        setPdf(loaded);
      }
    })()
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      active = false;
      window.clearTimeout(timeout);
      void loading?.destroy();
    };
  }, [blob, initialPage]);

  if (failed) return <PdfPreviewFailure />;
  if (!pdf) return <LoadingState label={t("loading_document")} />;
  return (
    <section aria-label={t("pdfTitle", { name })} className="flex min-h-0 flex-1 flex-col gap-2">
      {pdf.numPages > 1 && (
        <nav aria-label={t("pdfPages")} className="flex shrink-0 items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            {t("pdfPrevious")}
          </Button>
          <span role="status" className="text-sm tabular-nums">
            {t("pdfPage", { page, count: pdf.numPages })}
          </span>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={page === pdf.numPages}
            onClick={() => setPage((value) => value + 1)}
          >
            {t("pdfNext")}
          </Button>
        </nav>
      )}
      <PdfPreviewPage key={page} pdf={pdf} page={page} name={name} />
    </section>
  );
}

function PdfPreviewPage({
  pdf,
  page,
  name,
}: {
  pdf: PDFDocumentProxy;
  page: number;
  name: string;
}) {
  const { t } = useTranslation("identityPreview");
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let source: PDFPageProxy | undefined;
    let render: RenderTask | undefined;
    let imageUrl: string | undefined;
    const timeout = window.setTimeout(() => {
      active = false;
      render?.cancel();
      setFailed(true);
    }, 15000);
    void (async () => {
      source = await pdf.getPage(page);
      if (!active) return;
      const natural = source.getViewport({ scale: 1 });
      // One page in memory, with a bounded raster large enough for the shared zoom viewer.
      const viewport = source.getViewport({
        scale: 2400 / Math.max(natural.width, natural.height),
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      render = source.render({ canvas, viewport });
      await render.promise;
      if (!active) return;
      const image = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!active) return;
      if (!image) throw new Error("PDF page rendering failed");
      imageUrl = URL.createObjectURL(image);
      setUrl(imageUrl);
    })()
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        window.clearTimeout(timeout);
        source?.cleanup();
      });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      render?.cancel();
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [pdf, page]);

  if (failed) return <PdfPreviewFailure />;
  if (!url) return <LoadingState label={t("loading_document")} />;
  return (
    <IdentityPreviewCanvas
      generic
      images={[{ document: { id: String(page), name: t("pdfPageTitle", { name, page }) }, url }]}
    />
  );
}

function PdfPreviewFailure() {
  const { t } = useTranslation("identityPreview");
  return (
    <p role="alert" className="p-4 text-center text-sm text-muted-foreground">
      {t("pdfFallback")}
    </p>
  );
}
