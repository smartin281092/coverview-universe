import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import { Button, LoadingState } from "@coverview/ui";
import type { IdentityMe } from "@coverview/api-client";
import type { DocumentSummary } from "@coverview/contracts";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { api } from "../../api";
import { DocumentFailure } from "./DocumentFailure";

const batchSize = 6;

export function DocumentThumbnails({
  identity,
  document,
  onOpen,
}: {
  identity: IdentityMe;
  document: DocumentSummary;
  onOpen: (page: number) => void;
}) {
  const { t } = useTranslation("documents");
  const original = useQuery({
    queryKey: [
      "private",
      identity.user.id,
      identity.session.id,
      "document-thumbnails",
      document.id,
    ],
    queryFn: ({ signal }) => api.downloadDocument(document.id, { signal }),
    enabled: document.canDownload,
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
  if (!document.canDownload) return null;
  return (
    <section aria-label={t("thumbnails.title")} className="space-y-3">
      {original.isError ? (
        <DocumentFailure error={original.error} onRetry={() => void original.refetch()} />
      ) : !original.data ? (
        <LoadingState label={t("thumbnails.loading")} />
      ) : (
        <ThumbnailContent
          key={`${document.id}:${document.mime}`}
          blob={original.data}
          mime={document.mime}
          name={document.name}
          onOpen={onOpen}
        />
      )}
    </section>
  );
}

function ThumbnailContent({
  blob,
  mime,
  name,
  onOpen,
}: {
  blob: Blob;
  mime: string;
  name: string;
  onOpen: (page: number) => void;
}) {
  const { t } = useTranslation("documents");
  const [url, setUrl] = useState<string>();
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [failed, setFailed] = useState(false);
  const [start, setStart] = useState(1);
  const isImage = ["image/jpeg", "image/png", "image/webp"].includes(mime);
  useEffect(() => {
    const source = URL.createObjectURL(new Blob([blob], { type: mime }));
    setUrl(source);
    return () => URL.revokeObjectURL(source);
  }, [blob, mime]);
  useEffect(() => {
    if (mime !== "application/pdf") return;
    let active = true;
    let task: { destroy: () => Promise<void> } | undefined;
    const timeout = window.setTimeout(() => {
      active = false;
      setFailed(true);
      void task?.destroy();
    }, 20000);
    void (async () => {
      const { loadThumbnailPdf } = await import("./document-thumbnail-pdf");
      const bytes = await blob.arrayBuffer();
      if (!active) return;
      const loading = loadThumbnailPdf(bytes);
      task = loading;
      const loaded = await loading.promise;
      if (active) setPdf(loaded);
    })()
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      active = false;
      window.clearTimeout(timeout);
      void task?.destroy();
    };
  }, [blob, mime]);
  const pages = pdf
    ? Array.from({ length: Math.min(batchSize, pdf.numPages - start + 1) }, (_, i) => start + i)
    : [1];
  return (
    <>
      <ul className="flex gap-3 overflow-x-auto pb-2">
        {pages.map((page) => (
          <li key={page} className="w-36 shrink-0 sm:w-40">
            <button
              type="button"
              onClick={() => onOpen(page)}
              aria-label={t("thumbnails.open", { page, name })}
              className="group flex w-full flex-col gap-2 rounded-lg border border-border bg-background p-2 text-left transition-colors hover:border-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-md bg-muted sm:h-44">
                {isImage && url && !failed ? (
                  <img
                    src={url}
                    alt={name}
                    className="size-full object-contain"
                    onError={() => setFailed(true)}
                  />
                ) : pdf && !failed ? (
                  <PdfThumbnail pdf={pdf} page={page} />
                ) : mime === "application/pdf" && !failed ? (
                  <LoadingState label={t("thumbnails.loading")} />
                ) : (
                  <FileText className="size-10 text-muted-foreground" aria-hidden="true" />
                )}
              </span>
              <span className="w-full truncate text-xs text-muted-foreground">
                {mime === "application/pdf" ? t("sourcePage", { page }) : name}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {failed && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("thumbnails.unavailable")}
        </p>
      )}
      {pdf && pdf.numPages > batchSize && (
        <nav aria-label={t("thumbnails.pagination")} className="flex items-center gap-3">
          <Button
            variant="outline"
            disabled={start === 1}
            onClick={() => setStart((value) => value - batchSize)}
          >
            {t("previous")}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t("thumbnails.range", {
              start,
              end: Math.min(start + batchSize - 1, pdf.numPages),
              count: pdf.numPages,
            })}
          </span>
          <Button
            variant="outline"
            disabled={start + batchSize > pdf.numPages}
            onClick={() => setStart((value) => value + batchSize)}
          >
            {t("next")}
          </Button>
        </nav>
      )}
    </>
  );
}

function PdfThumbnail({ pdf, page }: { pdf: PDFDocumentProxy; page: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const { t } = useTranslation("documents");
  useEffect(() => {
    let active = true;
    let render: RenderTask | undefined;
    const timeout = window.setTimeout(() => {
      active = false;
      render?.cancel();
      setFailed(true);
    }, 15000);
    void (async () => {
      const source = await pdf.getPage(page);
      if (!active || !canvas.current) return;
      const natural = source.getViewport({ scale: 1 });
      const viewport = source.getViewport({ scale: 352 / Math.max(natural.width, natural.height) });
      canvas.current.width = Math.ceil(viewport.width);
      canvas.current.height = Math.ceil(viewport.height);
      render = source.render({ canvas: canvas.current, viewport });
      await render.promise;
      source.cleanup();
    })()
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      active = false;
      window.clearTimeout(timeout);
      render?.cancel();
    };
  }, [pdf, page]);
  return failed ? (
    <span className="p-2 text-xs text-muted-foreground">{t("thumbnails.unavailable")}</span>
  ) : (
    <canvas
      ref={canvas}
      role="img"
      aria-label={t("sourcePage", { page })}
      className="max-h-full max-w-full object-contain"
    />
  );
}
