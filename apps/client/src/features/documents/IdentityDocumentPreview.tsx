import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Download, X } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import type { DocumentSummary } from "@coverview/contracts";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  LoadingState,
} from "@coverview/ui";
import { api } from "../../api";
import { DocumentFailure } from "./DocumentFailure";
import { IdentityPreviewCanvas } from "./IdentityPreviewCanvas";

type PreviewProps = {
  identity: IdentityMe;
  documents: readonly DocumentSummary[];
  portalContainer: HTMLDivElement | null;
  onClose: () => void;
  scopeKey?: string;
  company?: boolean;
  generic?: boolean;
};
type PreviewAsset = { document: DocumentSummary; url: string; mime: string };

export function IdentityDocumentPreview(props: PreviewProps) {
  if (!props.portalContainer) return null;
  const sourceKey = JSON.stringify([
    props.identity.user.id,
    props.identity.session.id,
    props.scopeKey,
    props.documents.map(({ id, revision, canDownload }) => [id, revision, canDownload]),
  ]);
  // A changed person, session or attachment discards all private blobs and gestures.
  return <IdentityPreviewContent key={sourceKey} {...props} sourceKey={sourceKey} />;
}

function IdentityPreviewContent({
  identity,
  documents,
  portalContainer,
  onClose,
  sourceKey,
  company = false,
  generic = false,
}: PreviewProps & { sourceKey: string }) {
  const { t } = useTranslation("identityPreview");
  const returnFocus = useRef(document.activeElement);
  const [assets, setAssets] = useState<PreviewAsset[]>([]);
  const available = documents.filter((item) => item.canDownload);
  const originals = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "identity-preview", sourceKey],
    queryFn: async ({ signal }) => {
      const result = await Promise.all(
        available.map(async (item) => ({
          document: item,
          blob: await api.downloadDocument(item.id, { signal }),
        })),
      );
      signal.throwIfAborted();
      return result;
    },
    enabled: available.length > 0,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    const loaded = (originals.data ?? []).map(({ document, blob }) => ({
      document,
      // Downloads deliberately use octet-stream. Only the server-detected, scanned MIME selects a renderer.
      url: URL.createObjectURL(new Blob([blob], { type: document.mime })),
      mime: document.mime,
    }));
    setAssets(loaded);
    return () => {
      for (const asset of loaded) URL.revokeObjectURL(asset.url);
    };
  }, [originals.data]);
  const images = assets.filter((asset) =>
    ["image/jpeg", "image/png", "image/webp"].includes(asset.mime),
  );
  const others = assets.filter((asset) => !images.includes(asset));

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        portalContainer={portalContainer}
        className="flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] flex-col gap-3 overflow-hidden p-4 sm:max-w-6xl sm:p-6"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (returnFocus.current instanceof HTMLElement && returnFocus.current.isConnected)
            returnFocus.current.focus();
        }}
      >
        <div className="flex shrink-0 items-start justify-between gap-3">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {t(
                "title",
                generic ? { context: "document" } : company ? { context: "company" } : {},
              )}
            </DialogTitle>
            <DialogDescription>
              {t(
                "description",
                generic ? { context: "document" } : company ? { context: "company" } : {},
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11"
              aria-label={t("close")}
            >
              <X className="size-5" aria-hidden="true" />
            </Button>
          </DialogClose>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          {available.length === 0 ? (
            <EmptyState title={t("unavailableTitle")} description={t("unavailableDescription")} />
          ) : originals.isError ? (
            <DocumentFailure error={originals.error} onRetry={() => void originals.refetch()} />
          ) : originals.isPending || assets.length === 0 ? (
            <LoadingState
              label={t(
                "loading",
                generic ? { context: "document" } : company ? { context: "company" } : {},
              )}
            />
          ) : (
            <>
              {images.length > 0 && (
                <IdentityPreviewCanvas images={images} company={company} generic={generic} />
              )}
              {others.map((asset) => (
                <section key={asset.document.id} className="flex min-h-0 flex-1 flex-col gap-2">
                  {asset.mime === "application/pdf" && (
                    <iframe
                      src={asset.url}
                      title={t("pdfTitle", { name: asset.document.name })}
                      sandbox=""
                      referrerPolicy="no-referrer"
                      className="min-h-64 w-full flex-1 rounded-lg border border-border bg-muted"
                    />
                  )}
                  <p className="text-sm text-muted-foreground">
                    {t(asset.mime === "application/pdf" ? "pdfFallback" : "unsupported")}
                  </p>
                </section>
              ))}
            </>
          )}
        </div>
        {assets.length > 0 && !originals.isError && (
          <div className="flex max-h-36 shrink-0 flex-wrap gap-2 overflow-y-auto border-t border-border pt-3">
            {assets.map((asset) => (
              <Button
                key={asset.document.id}
                asChild
                variant="outline"
                className="min-h-11 max-w-full"
              >
                <a href={asset.url} download={asset.document.name}>
                  <Download className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{t("download", { name: asset.document.name })}</span>
                </a>
              </Button>
            ))}
          </div>
        )}
        {available.length < documents.length && available.length > 0 && (
          <p role="status" className="shrink-0 text-sm text-muted-foreground">
            {t("pendingFiles")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
