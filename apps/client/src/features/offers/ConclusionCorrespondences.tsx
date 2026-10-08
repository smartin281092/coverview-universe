import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import {
  conclusionCorrespondenceInputSchema,
  type ConclusionCorrespondenceInput,
} from "@coverview/contracts/partner-conclusion";
import { Button, Label, Input, SelectField } from "@coverview/ui";
import { partnerApi } from "../../partner-api";

export function ConclusionCorrespondences({
  identity,
  leadId,
  onSaved,
}: {
  identity: IdentityMe;
  leadId: string;
  onSaved: () => void;
}) {
  const { t } = useTranslation("conclusion");
  const [open, setOpen] = useState(false),
    [pages, setPages] = useState<(string | undefined)[]>([undefined]),
    [candidatesPages, setCandidatesPages] = useState<(string | undefined)[]>([undefined]),
    [selected, setSelected] = useState(""),
    [consent, setConsent] = useState(false),
    [reason, setReason] = useState("");
  const policy = { enabled: open, gcTime: 0, staleTime: 0, retry: false, refetchInterval: 10000 };
  const root = [
    "private",
    identity.user.id,
    identity.session.id,
    "conclusion-correspondences",
    leadId,
  ];
  const query = useQuery({
    queryKey: [...root, "shared", pages.at(-1)],
    queryFn: ({ signal }) =>
      partnerApi.conclusionCorrespondences(leadId, true, pages.at(-1), signal),
    ...policy,
  });
  const candidates = useQuery({
    queryKey: [...root, "candidates", candidatesPages.at(-1)],
    queryFn: ({ signal }) =>
      partnerApi.conclusionCandidates(leadId, candidatesPages.at(-1), signal),
    ...policy,
  });
  const attempt = useRef<{ payload: string; key: string } | null>(null),
    abort = useRef(new AbortController());
  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    return () => controller.abort();
  }, []);
  const mutation = useMutation({
    mutationKey: root,
    gcTime: 0,
    retry: false,
    mutationFn: (input: ConclusionCorrespondenceInput) => {
      const parsed = conclusionCorrespondenceInputSchema.parse(input),
        payload = JSON.stringify(parsed);
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      return partnerApi.shareConclusionCorrespondence(leadId, parsed, {
        csrfToken: identity.csrfToken,
        idempotencyKey: attempt.current.key,
        signal: abort.current.signal,
      });
    },
    onSuccess: () => {
      if (!abort.current.signal.aborted) {
        setSelected("");
        setConsent(false);
        setReason("");
        onSaved();
        void query.refetch();
      }
    },
  });
  const data = query.isError ? undefined : query.data,
    documents = candidates.isError ? undefined : candidates.data;
  const disabled = mutation.isPending || !data;
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <Button variant="outline" onClick={() => setOpen(!open)} aria-expanded={open}>
        {t("correspondences")}
      </Button>
      {open && (
        <>
          <p className="text-sm text-muted-foreground">{t("correspondenceHelp")}</p>
          {(query.isError || candidates.isError || mutation.isError) && (
            <div role="alert">
              <p>{t("error")}</p>
              <Button
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => {
                  mutation.reset();
                  void query.refetch();
                  void candidates.refetch();
                }}
              >
                {t("reload")}
              </Button>
            </div>
          )}
          {query.isPending && <p>{t("loading")}</p>}
          {data?.canShare && (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                const doc = documents?.items.find((i) => i.documentId === selected);
                if (doc && consent)
                  mutation.mutate({
                    action: "share",
                    leadRevision: data.leadRevision,
                    documentId: doc.documentId,
                    fingerprint: doc.fingerprint,
                    consent: true,
                  });
              }}
            >
              <Label htmlFor="correspondence-document">{t("selectCorrespondence")}</Label>
              <SelectField
                id="correspondence-document"
                value={selected}
                disabled={disabled || !documents}
                placeholder={t("choose")}
                onValueChange={(value) => {
                  setSelected(value);
                  setConsent(false);
                }}
                options={(documents?.items ?? []).map((d) => ({
                  value: d.documentId,
                  label: d.name,
                }))}
              />
              {documents && !documents.items.length && (
                <p className="text-sm">{t("noCandidates")}</p>
              )}
              <div className="flex flex-wrap gap-3">
                {candidatesPages.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelected("");
                      setConsent(false);
                      setCandidatesPages(candidatesPages.slice(0, -1));
                    }}
                  >
                    {t("previous")}
                  </Button>
                )}
                {documents?.nextCursor && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelected("");
                      setConsent(false);
                      setCandidatesPages([...candidatesPages, documents.nextCursor!]);
                    }}
                  >
                    {t("next")}
                  </Button>
                )}
              </div>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={disabled}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                {t("correspondenceConsent")}
              </label>
              <Button type="submit" disabled={disabled || !selected || !consent || !documents}>
                {t("shareCorrespondence")}
              </Button>
            </form>
          )}
          {data && (
            <>
              {!data.items.length && <p>{t("noCorrespondences")}</p>}
              <Label htmlFor="correspondence-reason">{t("withdrawReason")}</Label>
              <Input
                id="correspondence-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={2000}
                disabled={disabled}
              />
              <ul className="space-y-3">
                {data.items.map((item) => (
                  <li key={item.id} className="space-y-2">
                    <p>
                      {t("correspondenceCaption", { name: item.name ?? t("unavailable") })}{" "}
                      {t(
                        item.current
                          ? "correspondenceShared"
                          : item.active
                            ? "correspondenceChanged"
                            : "correspondenceWithdrawn",
                      )}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {item.canDownload && (
                        <Button asChild variant="outline">
                          <a
                            href={partnerApi.conclusionCorrespondenceSourceUrl(
                              leadId,
                              item.id,
                              true,
                            )}
                          >
                            {t("correspondenceOriginal")}
                          </a>
                        </Button>
                      )}
                      {item.active && (
                        <Button
                          variant="outline"
                          disabled={disabled || reason.trim().length < 5}
                          onClick={() =>
                            mutation.mutate({
                              action: "withdraw",
                              leadRevision: data.leadRevision,
                              id: item.id,
                              reason,
                            })
                          }
                        >
                          {t("withdrawCorrespondence")}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
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
        </>
      )}
    </section>
  );
}
