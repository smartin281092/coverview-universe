import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Download, X } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import type { LeadOffer } from "@coverview/api-client/partner";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorState,
  LoadingState,
} from "@coverview/ui";
import { partnerApi } from "../../partner-api";
import { DocumentPdfPreview } from "../documents/DocumentPdfPreview";
import { IdentityPreviewCanvas } from "../documents/IdentityPreviewCanvas";

/**
 * The original of an offer, read in the app (8 October 2026) rather than downloaded. Only the
 * type the server detected picks a renderer; downloading stays available below.
 */
export function OfferSourcePreview({
  identity,
  leadId,
  offer,
  onClose,
}: {
  identity: IdentityMe;
  leadId: string;
  offer: LeadOffer;
  onClose: () => void;
}) {
  const { t } = useTranslation("offers");
  const mime = offer.sourceMime;
  const source = useQuery({
    queryKey: [
      "private",
      identity.user.id,
      identity.session.id,
      "offer-source",
      leadId,
      offer.id,
      offer.version,
    ],
    queryFn: ({ signal }) => partnerApi.offerSource(leadId, offer.id, signal, true),
    enabled: !!mime,
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!source.data || !mime?.startsWith("image/")) return;
    const next = URL.createObjectURL(new Blob([source.data], { type: mime }));
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [source.data, mime]);
  const name = `${offer.company} · ${offer.product}`;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] flex-col gap-3 overflow-hidden p-4 sm:max-w-5xl sm:p-6">
        <div className="flex shrink-0 items-start justify-between gap-3">
          <DialogHeader>
            <DialogTitle className="text-lg">{t("source")}</DialogTitle>
            <DialogDescription>{name}</DialogDescription>
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
          {!mime ? (
            <p className="text-sm text-muted-foreground">{t("preview.unsupported")}</p>
          ) : source.isError ? (
            <ErrorState
              title={t("preview.error")}
              description=""
              retryLabel={t("retry")}
              pendingLabel={t("preview.loading")}
              onRetry={() => void source.refetch()}
            />
          ) : !source.data || (mime !== "application/pdf" && !url) ? (
            <LoadingState label={t("preview.loading")} />
          ) : mime === "application/pdf" ? (
            <DocumentPdfPreview blob={source.data} name={name} initialPage={1} />
          ) : (
            url && (
              <IdentityPreviewCanvas images={[{ document: { id: offer.id, name }, url }]} generic />
            )
          )}
        </div>
        <div className="flex shrink-0 justify-end border-t border-border pt-3">
          <Button asChild variant="outline" className="min-h-11">
            <a href={partnerApi.sourceUrl(leadId, offer.id, true)}>
              <Download className="size-4" aria-hidden="true" />
              {t("preview.download")}
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
