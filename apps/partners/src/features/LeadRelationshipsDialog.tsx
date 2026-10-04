import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { z } from "zod";
import {
  leadRelationshipInputSchema,
  leadRelationshipsSchema,
  type LeadRelationshipInput,
} from "@coverview/contracts/partner-relationships";
import type { LeadSummary } from "@coverview/contracts/partner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
  Label,
  parseZurichDateTime,
} from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
type Relation = z.infer<typeof leadRelationshipsSchema>["items"][number];
type Editor =
  | {
      action: "link";
      sourceRevision: number;
      target: LeadSummary;
      kind: "related" | "duplicate";
      tasks: number | null;
      appointments: number | null;
    }
  | { action: "withdraw"; item: Relation };
export function LeadRelationshipsDialog({
  leadId,
  onClose,
}: {
  leadId: string;
  onClose: () => void;
}) {
  const session = usePartner(),
    cache = useQueryClient(),
    { t, i18n } = useTranslation("relationships");
  const [pages, setPages] = useState<(string | undefined)[]>([undefined]),
    [candidatePages, setCandidatePages] = useState<(string | undefined)[]>([undefined]),
    [editor, setEditor] = useState<Editor | null>(null),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [cancelWork, setCancelWork] = useState(false),
    [nextAction, setNextAction] = useState(""),
    [dueAt, setDueAt] = useState(""),
    [error, setError] = useState("");
  const root = [...session.queryKey, "relationships", leadId],
    policy = { gcTime: 0, staleTime: 0, retry: false, refetchInterval: 10000 };
  const query = useQuery({
    queryKey: [...root, "history", pages.at(-1)],
    queryFn: ({ signal }) => partnerApi.leadRelationships(leadId, false, pages.at(-1), signal),
    ...policy,
  });
  const candidates = useQuery({
    queryKey: [...root, "candidates", candidatePages.at(-1)],
    queryFn: ({ signal }) =>
      partnerApi.leadRelationshipCandidates(leadId, candidatePages.at(-1), signal),
    enabled: !!query.data?.assessment.canGroup && !query.isError,
    ...policy,
  });
  const data = query.isError ? undefined : query.data,
    choices = candidates.isError ? undefined : candidates.data;
  const abort = useRef(new AbortController()),
    attempt = useRef<{ payload: string; key: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    return () => controller.abort();
  }, []);
  const mutation = useMutation({
    mutationKey: root,
    gcTime: 0,
    retry: false,
    mutationFn: (input: LeadRelationshipInput) => {
      const parsed = leadRelationshipInputSchema.parse(input),
        payload = JSON.stringify(parsed);
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      return partnerApi.changeLeadRelationship(leadId, parsed, {
        csrfToken: session.identity.csrfToken,
        idempotencyKey: attempt.current.key,
        signal: abort.current.signal,
      });
    },
    onSuccess: () => {
      if (!abort.current.signal.aborted) {
        setEditor(null);
        void cache.invalidateQueries({ queryKey: session.queryKey });
      }
    },
  });
  const current =
    editor?.action === "withdraw" ? data?.items.find((i) => i.id === editor.item.id) : null;
  const stale =
    !!editor &&
    (editor.action === "link"
      ? data?.leadRevision !== editor.sourceRevision ||
        !choices?.items.some(
          (c) =>
            c.lead.id === editor.target.id &&
            c.lead.revision === editor.target.revision &&
            (editor.kind === "related" ? c.canGroup : c.canMerge),
        )
      : !current?.canWithdraw ||
        current.source.revision !== editor.item.source.revision ||
        current.target.revision !== editor.item.target.revision);
  const start = (value: Editor) => {
    setEditor(value);
    setReason("");
    setConfirmed(false);
    setCancelWork(false);
    setNextAction("");
    setDueAt("");
    setError("");
    mutation.reset();
  };
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
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <DialogContent
        closeLabel={t("close")}
        showCloseButton={!mutation.isPending}
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {query.isError ? (
          <div role="alert">
            <p>{t("error")}</p>
            <Button onClick={() => void query.refetch()}>{t("retry")}</Button>
          </div>
        ) : !data ? (
          <p>{t("loading")}</p>
        ) : editor ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (stale || !confirmed || mutation.isPending) return;
              try {
                setError("");
                const input =
                  editor.action === "link"
                    ? {
                        action: "link" as const,
                        sourceRevision: editor.sourceRevision,
                        targetRevision: editor.target.revision,
                        targetLeadId: editor.target.id,
                        kind: editor.kind,
                        reason,
                        confirmed: true as const,
                        cancelOpenWork: cancelWork,
                      }
                    : {
                        action: "withdraw" as const,
                        id: editor.item.id,
                        sourceRevision: editor.item.source.revision,
                        targetRevision: editor.item.target.revision,
                        reason,
                        ...(editor.item.kind === "duplicate"
                          ? { nextAction, dueAt: parseZurichDateTime(dueAt) }
                          : {}),
                      };
                const parsed = leadRelationshipInputSchema.safeParse(input);
                if (!parsed.success) {
                  setError(t("invalid"));
                  return;
                }
                mutation.mutate(parsed.data);
              } catch {
                setError(t("invalid"));
              }
            }}
          >
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setEditor(null)}
            >
              {t("back")}
            </Button>
            <h3 className="font-semibold">
              {t(
                editor.action === "withdraw"
                  ? "withdraw"
                  : editor.kind === "duplicate"
                    ? "merge"
                    : "group",
              )}
            </h3>
            <p>
              {t("main", {
                title: editor.action === "link" ? editor.target.title : editor.item.target.title,
              })}
            </p>
            {editor.action === "link" && editor.kind === "duplicate" && (
              <p className="text-sm">
                {t("mergeEffects", { tasks: editor.tasks, appointments: editor.appointments })}
              </p>
            )}
            {editor.action === "withdraw" && editor.item.kind === "duplicate" && (
              <p className="text-sm">{t("undoEffects")}</p>
            )}
            <fieldset className="space-y-4" disabled={stale || mutation.isPending}>
              <Label htmlFor="relationship-reason">{t("reason")}</Label>
              <textarea
                id="relationship-reason"
                className="min-h-24 w-full rounded-md border border-input bg-background p-3"
                value={reason}
                maxLength={2000}
                onChange={(e) => setReason(e.target.value)}
                required
              />
              {editor.action === "link" && editor.kind === "duplicate" && (
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={cancelWork}
                    onChange={(e) => setCancelWork(e.target.checked)}
                  />
                  {t("cancelWork")}
                </label>
              )}
              {editor.action === "withdraw" && editor.item.kind === "duplicate" && (
                <>
                  <Label htmlFor="relationship-next">{t("nextAction")}</Label>
                  <Input
                    id="relationship-next"
                    value={nextAction}
                    maxLength={240}
                    onChange={(e) => setNextAction(e.target.value)}
                    required
                  />
                  <Label htmlFor="relationship-date">{t("dueAt")}</Label>
                  <Input
                    id="relationship-date"
                    type="datetime-local"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    required
                  />
                </>
              )}
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                {t(
                  editor.action === "link" && editor.kind === "duplicate"
                    ? "confirmDuplicate"
                    : "confirm",
                )}
              </label>
            </fieldset>
            {(stale || error || mutation.isError) && (
              <p role="alert">{error || t(stale ? "changed" : "error")}</p>
            )}
            <Button
              type="submit"
              disabled={
                stale ||
                mutation.isPending ||
                !confirmed ||
                (editor.action === "link" && editor.kind === "duplicate" && !cancelWork)
              }
            >
              {t(mutation.isPending ? "saving" : "save")}
            </Button>
          </form>
        ) : (
          <>
            {!!data.assessment.blockers.length && (
              <ul className="space-y-2 text-sm">
                {data.assessment.blockers.map((b) => (
                  <li key={b}>{t(`blockers.${b}`)}</li>
                ))}
              </ul>
            )}
            {data.assessment.canGroup && (
              <section className="space-y-3">
                <h3 className="font-semibold">{t("candidates")}</h3>
                <p className="text-sm text-muted-foreground">{t("candidateHelp")}</p>
                {candidates.isError ? (
                  <p role="alert">{t("error")}</p>
                ) : candidates.isPending ? (
                  <p>{t("loading")}</p>
                ) : !choices?.items.length ? (
                  <p>{t("noCandidates")}</p>
                ) : (
                  choices.items.map((candidate) => (
                    <article className="space-y-2 rounded-lg border p-3" key={candidate.lead.id}>
                      <p>{candidate.lead.title}</p>
                      <div className="flex flex-wrap gap-3">
                        <Button
                          variant="outline"
                          disabled={!candidate.canGroup}
                          onClick={() =>
                            start({
                              action: "link",
                              kind: "related",
                              sourceRevision: data.leadRevision,
                              target: candidate.lead,
                              tasks: data.assessment.openTasks,
                              appointments: data.assessment.futureAppointments,
                            })
                          }
                        >
                          {t("group")}
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!candidate.canMerge}
                          onClick={() =>
                            start({
                              action: "link",
                              kind: "duplicate",
                              sourceRevision: data.leadRevision,
                              target: candidate.lead,
                              tasks: data.assessment.openTasks,
                              appointments: data.assessment.futureAppointments,
                            })
                          }
                        >
                          {t("merge")}
                        </Button>
                      </div>
                    </article>
                  ))
                )}
                <div className="flex flex-wrap gap-3">
                  {candidatePages.length > 1 && (
                    <Button
                      variant="outline"
                      onClick={() => setCandidatePages(candidatePages.slice(0, -1))}
                    >
                      {t("previous")}
                    </Button>
                  )}
                  {choices?.nextCursor && (
                    <Button
                      variant="outline"
                      onClick={() => setCandidatePages([...candidatePages, choices.nextCursor!])}
                    >
                      {t("next")}
                    </Button>
                  )}
                </div>
              </section>
            )}
            <section className="space-y-3">
              <h3 className="font-semibold">{t("history")}</h3>
              {!data.items.length && <p>{t("empty")}</p>}
              {data.items.map((item) => (
                <article key={item.id} className="space-y-3 rounded-lg border p-4">
                  <p>
                    {t("entry", {
                      kind: t(`kinds.${item.kind}`),
                      date: date(item.createdAt),
                      state: t(item.active ? "active" : "withdrawn"),
                    })}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild variant="outline">
                      <Link to="/leads/$leadId" params={{ leadId: item.source.id }}>
                        {t("source", { title: item.source.title })}
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/leads/$leadId" params={{ leadId: item.target.id }}>
                        {t("main", { title: item.target.title })}
                      </Link>
                    </Button>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{item.reason}</p>
                  {item.withdrawalReason && (
                    <p className="whitespace-pre-wrap text-sm">
                      {t("withdrawalReason", { reason: item.withdrawalReason })}
                    </p>
                  )}
                  {item.canWithdraw && (
                    <Button variant="outline" onClick={() => start({ action: "withdraw", item })}>
                      {t("withdraw")}
                    </Button>
                  )}
                </article>
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
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
