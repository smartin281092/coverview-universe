import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import type { DocumentSummary } from "@coverview/contracts";
import { api } from "../../api";
import { DocumentProcessingIndicator } from "./DocumentProcessingIndicator";

export function DocumentCover({
  identity,
  document,
}: {
  identity: IdentityMe;
  document: DocumentSummary;
}) {
  const { t } = useTranslation("documents");
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState<string>();
  const [imageFailed, setImageFailed] = useState(false);
  const supported = ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
    document.mime,
  );
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const cover = useQuery({
    queryKey: [
      "private",
      identity.user.id,
      identity.session.id,
      "document-cover",
      document.id,
      document.revision,
      document.mime,
      document.canDownload,
    ],
    queryFn: async ({ signal }) => {
      const blob = await api.downloadDocument(document.id, { signal });
      signal.throwIfAborted();
      if (document.mime !== "application/pdf") return new Blob([blob], { type: document.mime });
      const { renderPdfCover } = await import("./document-thumbnail-pdf");
      return renderPdfCover(await blob.arrayBuffer(), signal);
    },
    enabled: visible && supported && document.canDownload,
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    setImageFailed(false);
    if (!cover.data) {
      setUrl(undefined);
      return;
    }
    const source = URL.createObjectURL(cover.data);
    setUrl(source);
    return () => URL.revokeObjectURL(source);
  }, [cover.data]);
  const processing = ["queued", "scanning", "reading"].includes(document.state);
  return (
    <div
      ref={container}
      className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg bg-muted/60 p-3"
    >
      {document.canDownload && cover.data && url && !imageFailed ? (
        <img
          src={url}
          alt={t("library.cover")}
          className="size-full object-contain"
          onError={() => setImageFailed(true)}
        />
      ) : processing || cover.isFetching ? (
        <span
          role="status"
          aria-label={t(processing ? `state.${document.state}` : "thumbnails.loading")}
        >
          <DocumentProcessingIndicator />
        </span>
      ) : (
        <span
          role="img"
          aria-label={t(
            cover.isError || imageFailed || !supported || !document.canDownload
              ? "thumbnails.unavailable"
              : "library.cover",
          )}
          className="text-muted-foreground"
        >
          <FileText className="size-10" strokeWidth={1.5} aria-hidden="true" />
        </span>
      )}
    </div>
  );
}
