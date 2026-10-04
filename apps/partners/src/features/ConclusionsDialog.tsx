import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Conclusion } from "@coverview/contracts/partner-conclusion";
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
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { ConclusionForm } from "./ConclusionForm";
export function ConclusionsDialog({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation("conclusion"),
    session = usePartner(),
    cache = useQueryClient();
  const [pages, setPages] = useState<(string | undefined)[]>([undefined]);
  const [editor, setEditor] = useState<
    | { kind: "prepare"; revision: number }
    | { kind: "correct"; item: Conclusion; targetActionId: string }
    | { kind: Conclusion["availableActions"][number]; item: Conclusion }
    | null
  >(null);
  const policy = { gcTime: 0, staleTime: 0, retry: false, refetchInterval: 10000 };
  const query = useQuery({
    queryKey: [...session.queryKey, "conclusions", leadId, pages.at(-1)],
    queryFn: ({ signal }) => partnerApi.conclusions(leadId, false, pages.at(-1), signal),
    ...policy,
  });
  const leadQuery = useQuery({
    queryKey: [...session.queryKey, "lead", leadId],
    queryFn: ({ signal }) => partnerApi.lead(leadId, signal),
    ...policy,
  });
  const data = query.isError ? undefined : query.data,
    lead = leadQuery.isError ? undefined : leadQuery.data;
  const date = (s: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Zurich",
    }).format(new Date(s));
  const editing =
    editor && editor.kind !== "prepare" ? data?.items.find((i) => i.id === editor.item.id) : null;
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
        {query.isError || leadQuery.isError ? (
          <div role="alert">
            <p>{t("error")}</p>
            <Button
              onClick={() => {
                setEditor(null);
                void query.refetch();
                void leadQuery.refetch();
              }}
            >
              {t("reload")}
            </Button>
          </div>
        ) : !data || !lead ? (
          <p>{t("loading")}</p>
        ) : editor ? (
          <ConclusionForm
            key={
              editor.kind === "prepare"
                ? `prepare:${editor.revision}`
                : `${editor.item.id}:${editor.item.revision}:${editor.kind}`
            }
            lead={lead}
            editor={editor}
            enabled={
              editor.kind === "prepare"
                ? data.canPrepare
                : !!editing &&
                  editing.revision === editor.item.revision &&
                  (editor.kind === "correct"
                    ? editing.actions.some((a) => a.id === editor.targetActionId && a.canCorrect)
                    : editing.availableActions.includes(editor.kind))
            }
            onBack={() => setEditor(null)}
            onSaved={() => {
              setEditor(null);
              void cache.invalidateQueries({ queryKey: session.queryKey });
            }}
          />
        ) : (
          <>
            {data.canPrepare && (
              <Button onClick={() => setEditor({ kind: "prepare", revision: lead.revision })}>
                {t("prepare")}
              </Button>
            )}
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
                      ]
                    : []),
                  ...(item.receipt
                    ? [
                        { label: t("signer"), value: item.receipt.signerName },
                        { label: t("signedAt"), value: date(item.receipt.signedAt) },
                      ]
                    : []),
                ]}
              >
                <Badge variant="outline">{t(`insurer.${item.insurerEvidence}`)}</Badge>
                <p className="text-sm text-muted-foreground">{t("traceNotice")}</p>
                {item.archive && (
                  <Button asChild variant="outline">
                    <a href={partnerApi.sourceUrl(leadId, item.offerId)}>{t("original")}</a>
                  </Button>
                )}
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
                      {a.canCorrect && (
                        <Button
                          variant="outline"
                          onClick={() => setEditor({ kind: "correct", item, targetActionId: a.id })}
                        >
                          {t("actions.correct")}
                        </Button>
                      )}
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap gap-3">
                  {item.availableActions.map((kind) => (
                    <Button key={kind} variant="outline" onClick={() => setEditor({ kind, item })}>
                      {t(`actions.${kind}`)}
                    </Button>
                  ))}
                </div>
              </SignatureEvidence>
            ))}
            <div className="flex flex-wrap gap-3">
              {pages.length > 1 && (
                <Button variant="outline" onClick={() => setPages(pages.slice(0, -1))}>
                  {t("previous")}
                </Button>
              )}
              {data.nextCursor && (
                <Button variant="outline" onClick={() => setPages([...pages, data.nextCursor!])}>
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
