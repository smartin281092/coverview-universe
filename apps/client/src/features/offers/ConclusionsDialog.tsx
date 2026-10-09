import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  SignatureEvidence,
} from "@coverview/ui";
import { partnerApi } from "../../partner-api";
import { ConclusionSignatureForm } from "./ConclusionSignatureForm";
import { ConclusionCorrespondences } from "./ConclusionCorrespondences";
import { amountsInText, numberFormat } from "@coverview/ui/number-format";
export function ConclusionsDialog({
  identity,
  leadId,
  onClose,
}: {
  identity: IdentityMe;
  leadId: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("conclusion"),
    cache = useQueryClient();
  const [pages, setPages] = useState<(string | undefined)[]>([undefined]),
    [selected, setSelected] = useState<string>();
  const root = ["private", identity.user.id, identity.session.id, "wallet-leads"],
    prefix = [...root, "conclusions", leadId];
  const query = useQuery({
    queryKey: [...prefix, pages.at(-1)],
    queryFn: ({ signal }) => partnerApi.conclusions(leadId, true, pages.at(-1), signal),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 10000,
  });
  const data = query.isError ? undefined : query.data;
  const date = (s: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Zurich",
    }).format(new Date(s));
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl" closeLabel={t("close")}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <ConclusionCorrespondences
          identity={identity}
          leadId={leadId}
          onSaved={() => void cache.invalidateQueries({ queryKey: root })}
        />
        {query.isError ? (
          <div role="alert">
            <p>{t("error")}</p>
            <Button
              onClick={() => {
                setSelected(undefined);
                void query.refetch();
              }}
            >
              {t("reload")}
            </Button>
          </div>
        ) : !data ? (
          <p>{t("loading")}</p>
        ) : (
          <>
            {!data.items.length && <p>{t("empty")}</p>}
            {data.items.map((item) => (
              <SignatureEvidence
                key={item.id}
                title={item.archive ? t("offer", item.archive.offer) : t("unavailable")}
                caption={date(item.createdAt)}
                drawingLabel={t("drawing")}
                {...(item.receipt ? { drawing: item.receipt.drawing } : {})}
                facts={[
                  { label: t("state"), value: t(`states.${item.state}`) },
                  ...(item.archive
                    ? [
                        { label: t("procedure"), value: t("citation", item.archive.procedure) },
                        { label: t("explanation"), value: item.archive.explanation },
                        { label: t("validUntil"), value: date(item.archive.validUntil) },
                        {
                          label: t("premium"),
                          value:
                            item.archive.offer.annualPremiumMinor === null
                              ? t("missing")
                              : numberFormat(i18n.language, {
                                  style: "currency",
                                  currency: "CHF",
                                }).format(item.archive.offer.annualPremiumMinor / 100),
                        },
                        {
                          label: t("summary"),
                          value: item.archive.offer.summary
                            ? amountsInText(item.archive.offer.summary, i18n.language)
                            : t("missing"),
                        },
                        {
                          label: t("limitations"),
                          value: item.archive.offer.limitations
                            ? amountsInText(item.archive.offer.limitations, i18n.language)
                            : t("missing"),
                        },
                      ]
                    : []),
                  ...(item.receipt
                    ? [
                        { label: t("signer"), value: item.receipt.signerName },
                        { label: t("signedAt"), value: date(item.receipt.signedAt) },
                        { label: t("place"), value: item.receipt.place },
                      ]
                    : []),
                ]}
              >
                <Badge variant="outline">{t(`insurer.${item.insurerEvidence}`)}</Badge>
                <p className="text-sm text-muted-foreground">{t("traceNotice")}</p>
                {item.archive && (
                  <Button asChild variant="outline">
                    <a href={partnerApi.sourceUrl(leadId, item.offerId, true)}>{t("original")}</a>
                  </Button>
                )}
                {!!item.actions.length && (
                  <ol className="space-y-3 text-sm">
                    {item.actions.map((a) => (
                      <li key={a.id}>
                        <p>
                          {t("event", {
                            date: date(a.recordedAt),
                            label: a.input ? t(`actions.${a.input.action}`) : t("unavailable"),
                          })}
                        </p>
                        {a.input && <p className="whitespace-pre-wrap">{a.input.reason}</p>}
                        {a.input && "source" in a.input && <p>{t("citation", a.input.source)}</p>}
                        {a.superseded && <Badge variant="outline">{t("superseded")}</Badge>}
                      </li>
                    ))}
                  </ol>
                )}
                {selected === item.id && item.canSign ? (
                  <ConclusionSignatureForm
                    key={item.contentHash}
                    identity={identity}
                    item={item}
                    enabled={!!data && item.canSign}
                    onSaved={() => {
                      setSelected(undefined);
                      void cache.invalidateQueries({ queryKey: root });
                    }}
                  />
                ) : (
                  item.canSign && (
                    <Button onClick={() => setSelected(item.id)}>{t("reviewSign")}</Button>
                  )
                )}
                {item.receipt && (
                  <details className="text-sm">
                    <summary className="cursor-pointer">{t("integrity")}</summary>
                    <p className="mt-2 break-all">{item.contentHash}</p>
                    <p className="break-all">{item.receipt.integrityHash}</p>
                  </details>
                )}
              </SignatureEvidence>
            ))}
            <div className="flex flex-wrap gap-3">
              {pages.length > 1 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelected(undefined);
                    setPages(pages.slice(0, -1));
                  }}
                >
                  {t("previous")}
                </Button>
              )}
              {data.nextCursor && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelected(undefined);
                    setPages([...pages, data.nextCursor!]);
                  }}
                >
                  {t("next")}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
