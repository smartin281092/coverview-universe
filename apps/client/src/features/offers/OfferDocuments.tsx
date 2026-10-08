import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FileText, PenLine } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import type { LeadOffer } from "@coverview/api-client/partner";
import { Button, EmptyState } from "@coverview/ui";
import { partnerApi } from "../../partner-api";
import { OfferSourcePreview, offerSourceKey } from "./OfferSourcePreview";

// The first page of the original, drawn locally; the icon stays while it loads or if it fails.
function Cover({
  identity,
  leadId,
  offer,
}: {
  identity: IdentityMe;
  leadId: string;
  offer: LeadOffer;
}) {
  const mime = offer.sourceMime;
  const source = useQuery({
    queryKey: offerSourceKey(identity, leadId, offer),
    queryFn: ({ signal }) => partnerApi.offerSource(leadId, offer.id, signal, true),
    enabled: !!mime,
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const bytes = source.data;
    if (!bytes || !mime) return;
    const controller = new AbortController();
    let created: string | null = null;
    void (async () => {
      const image =
        mime === "application/pdf"
          ? await (
              await import("../documents/document-thumbnail-pdf")
            ).renderPdfCover(await bytes.arrayBuffer(), controller.signal)
          : new Blob([bytes], { type: mime });
      if (controller.signal.aborted) return;
      created = URL.createObjectURL(image);
      setUrl(created);
    })().catch(() => {
      /* The icon stays. */
    });
    return () => {
      controller.abort();
      if (created) URL.revokeObjectURL(created);
    };
  }, [source.data, mime]);
  return url ? (
    <img src={url} alt="" className="h-full w-full object-cover object-top" />
  ) : (
    <div className="grid h-full place-items-center text-muted-foreground">
      <FileText className="size-8" aria-hidden="true" />
    </div>
  );
}

/**
 * The documents of an offer as cards (8 October 2026): the first page as a cover, the original
 * opened in the app, and a signature button when the offer awaits a signature. Signing itself is
 * not built yet: the button says so and stays disabled.
 */
export function OfferDocuments({
  identity,
  leadId,
  offer,
}: {
  identity: IdentityMe;
  leadId: string;
  offer: LeadOffer;
}) {
  const { t } = useTranslation("offers");
  const [preview, setPreview] = useState(false);
  if (!offer.canDownload)
    return (
      <EmptyState
        title={t("offerPage.documents.empty")}
        description={t("offerPage.documents.emptyDescription")}
      />
    );
  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2">
        <li className="overflow-hidden rounded-xl border border-border bg-background">
          <button
            type="button"
            className="block w-full text-left hover:bg-muted/50"
            onClick={() => setPreview(true)}
          >
            <div className="aspect-[4/3] overflow-hidden border-b border-border bg-muted">
              <Cover identity={identity} leadId={leadId} offer={offer} />
            </div>
            <div className="space-y-1 p-4">
              <p className="font-medium">{t("source")}</p>
              <p className="text-sm text-muted-foreground">
                {`${offer.company} · ${offer.product}`}
              </p>
            </div>
          </button>
          {offer.state === "to_sign" && (
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
              <span className="text-xs text-muted-foreground">
                {t("offerPage.documents.signatureSoon")}
              </span>
              <Button size="sm" disabled>
                <PenLine className="size-4" aria-hidden="true" />
                {t("offerPage.documents.sign")}
              </Button>
            </div>
          )}
        </li>
      </ul>
      {preview && (
        <OfferSourcePreview
          identity={identity}
          leadId={leadId}
          offer={offer}
          onClose={() => setPreview(false)}
        />
      )}
    </>
  );
}
