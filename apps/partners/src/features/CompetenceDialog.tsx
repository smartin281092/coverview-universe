import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { leadCategorySchema, type CompetenceDossier } from "@coverview/contracts/partner";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  ErrorState,
  LoadingState,
  EmptyState,
  Label,
} from "@coverview/ui";
import { usePartner } from "./PartnerSession";
import { CompetenceDeclarationForm, CompetenceDecisionForm } from "./CompetenceForm";
import { formatDate } from "./Field";
import { partnerApi } from "../api";
import { ProfessionalScopeDetails } from "./ProfessionalScopeDetails";

export function CompetenceDialog({
  userId,
  initialCategory,
  onClose,
}: {
  userId: string;
  initialCategory?: CompetenceDossier["category"];
  onClose: () => void;
}) {
  const { t } = useTranslation(),
    session = usePartner(),
    client = useQueryClient();
  const [category, setCategory] = useState<string>(
    initialCategory ?? session.context.application?.categories[0] ?? "health",
  );
  const [before, setBefore] = useState<number | undefined>(),
    [history, setHistory] = useState(false),
    [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<{
    mode: "declare" | "resume" | "review" | "withdraw";
    dossier: CompetenceDossier;
  } | null>(null);
  const [retryError, setRetryError] = useState(false);
  const query = useQuery({
    queryKey: [...session.queryKey, "competence", userId, category, before],
    queryFn: ({ signal }) => partnerApi.competence(userId, category, before, signal),
    gcTime: 0,
    refetchInterval: 10000,
    retry: false,
  });
  const value = query.isError ? undefined : query.data;
  const back = () => {
    setEdit(null);
    void query.refetch();
  };
  const saved = () => {
    setEdit(null);
    setBefore(undefined);
    void client.invalidateQueries({ queryKey: session.queryKey });
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
        closeLabel={t("close")}
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>{t("competence.title")}</DialogTitle>
          <DialogDescription>{t("competence.privacy")}</DialogDescription>
        </DialogHeader>
        {value && (
          <p className="text-sm font-medium">
            {t("competence.subject", {
              name: edit?.dossier.name ?? value.name,
              organization: edit?.dossier.organization ?? value.organization,
            })}
          </p>
        )}
        {value && !value.documentsAvailable && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("competence.documentsUnavailable")}
          </p>
        )}
        {value && edit && value.professionalRevision !== edit.dossier.professionalRevision && (
          <p role="alert" className="text-sm text-destructive">
            {t("professionalScope.changedDuringEdit")}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="competence-category">{t("competence.category")}</Label>
          <select
            id="competence-category"
            disabled={busy || !!edit}
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setBefore(undefined);
              setHistory(false);
              setRetryError(false);
            }}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {leadCategorySchema.options.map((v) => (
              <option key={v} value={v}>
                {t(`category.${v}`)}
              </option>
            ))}
          </select>
        </div>
        {query.isPending ? (
          <LoadingState label={t("loading")} />
        ) : query.isError ? (
          <ErrorState
            title={t("error")}
            description={t("error")}
            retryLabel={t("retry")}
            pendingLabel={t("loading")}
            onRetry={() => void query.refetch()}
          />
        ) : (
          value && (
            <>
              {edit ? (
                edit.mode === "declare" || edit.mode === "resume" ? (
                  <CompetenceDeclarationForm
                    key={edit.mode}
                    dossier={edit.dossier}
                    mode={edit.mode}
                    onSaved={saved}
                    onBack={back}
                    onBusy={setBusy}
                  />
                ) : (
                  <CompetenceDecisionForm
                    dossier={edit.dossier}
                    mode={edit.mode}
                    onSaved={saved}
                    onBack={back}
                    onBusy={setBusy}
                  />
                )
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={!history ? "secondary" : "ghost"}
                      onClick={() => {
                        setHistory(false);
                        setBefore(undefined);
                      }}
                    >
                      {t("competence.current")}
                    </Button>
                    <Button
                      variant={history ? "secondary" : "ghost"}
                      onClick={() => setHistory(true)}
                    >
                      {t("competence.history")}
                    </Button>
                  </div>
                  {!history ? (
                    <>
                      <Badge variant="outline">
                        {t(`competence.status.${value.summary.status}`)}
                      </Badge>
                      {value.current ? (
                        <section className="space-y-3 rounded-lg border border-border p-4">
                          <ProfessionalScopeDetails record={value.current} />
                          <p className="whitespace-pre-wrap text-sm">{value.current.declaration}</p>
                          <p className="break-words text-sm text-muted-foreground">
                            {value.current.documentName}
                          </p>
                          <p className="text-sm">
                            {t(`competence.documentStates.${value.current.documentState}`)}
                          </p>
                          {value.current.reason && (
                            <p className="whitespace-pre-wrap text-sm">{value.current.reason}</p>
                          )}
                          {value.summary.scope && (
                            <p className="whitespace-pre-wrap text-sm">
                              {t("competence.scopeValue", { scope: value.summary.scope })}
                            </p>
                          )}
                          {value.summary.validUntil && (
                            <p className="text-sm">
                              {t("competence.validity", {
                                date: formatDate(value.summary.validUntil),
                              })}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {t("competence.actor", {
                              name: value.current.actorName,
                              date: formatDate(value.current.createdAt),
                            })}
                          </p>
                          {value.current.canDownload && (
                            <Button variant="outline" asChild>
                              <a
                                href={partnerApi.competenceSourceUrl(
                                  userId,
                                  category,
                                  value.current.id,
                                )}
                              >
                                {t("competence.original")}
                              </a>
                            </Button>
                          )}
                        </section>
                      ) : (
                        <EmptyState
                          title={t("competence.status.missing")}
                          description={t("competence.empty")}
                        />
                      )}
                      <div className="flex flex-wrap gap-3">
                        {value.canDeclare && (
                          <Button onClick={() => setEdit({ mode: "declare", dossier: value })}>
                            {t("competence.declare")}
                          </Button>
                        )}
                        {value.canResume &&
                          value.current?.decision === "submitted" &&
                          value.current.documentState === "pending" && (
                            <Button
                              variant="outline"
                              onClick={() => setEdit({ mode: "resume", dossier: value })}
                            >
                              {t("competence.resume")}
                            </Button>
                          )}
                        {value.canResume &&
                          value.current?.decision === "submitted" &&
                          value.current.documentState === "failed" && (
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() => {
                                setBusy(true);
                                setRetryError(false);
                                void partnerApi
                                  .retryCompetence(
                                    userId,
                                    category,
                                    value.current!.id,
                                    value.current!.documentRevision,
                                    {
                                      csrfToken: session.identity.csrfToken,
                                      idempotencyKey: crypto.randomUUID(),
                                    },
                                  )
                                  .then(saved)
                                  .catch(() => setRetryError(true))
                                  .finally(() => setBusy(false));
                              }}
                            >
                              {t("competence.retryScan")}
                            </Button>
                          )}
                        {value.canReview && (
                          <Button
                            variant="outline"
                            onClick={() => setEdit({ mode: "review", dossier: value })}
                          >
                            {t("competence.review")}
                          </Button>
                        )}
                        {value.canWithdraw && (
                          <Button
                            variant="outline"
                            onClick={() => setEdit({ mode: "withdraw", dossier: value })}
                          >
                            {t("competence.withdraw")}
                          </Button>
                        )}
                      </div>
                      {retryError && (
                        <p role="alert" className="text-sm text-destructive">
                          {t("error")}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      {value.history.length === 0 && (
                        <p className="text-sm text-muted-foreground">{t("competence.empty")}</p>
                      )}
                      <ol className="space-y-3">
                        {value.history.map((record) => (
                          <li
                            key={record.id}
                            className="space-y-2 rounded-lg border border-border p-4 text-sm"
                          >
                            <p className="font-medium">
                              {t(`competence.decisions.${record.decision}`)}
                            </p>
                            <p className="text-muted-foreground">
                              {t("competence.actor", {
                                name: record.actorName,
                                date: formatDate(record.createdAt),
                              })}
                            </p>
                            <p className="whitespace-pre-wrap">{record.declaration}</p>
                            <ProfessionalScopeDetails record={record} />
                            {record.reason && (
                              <p className="whitespace-pre-wrap">{record.reason}</p>
                            )}
                            {record.scope && (
                              <p className="whitespace-pre-wrap">
                                {t("competence.scopeValue", { scope: record.scope })}
                              </p>
                            )}
                            {record.validUntil && (
                              <p>
                                {t("competence.validity", { date: formatDate(record.validUntil) })}
                              </p>
                            )}
                            {record.canDownload && (
                              <Button size="sm" variant="outline" asChild>
                                <a
                                  href={partnerApi.competenceSourceUrl(userId, category, record.id)}
                                >
                                  {t("competence.original")}
                                </a>
                              </Button>
                            )}
                          </li>
                        ))}
                      </ol>
                      <div className="flex flex-wrap gap-3">
                        {before && (
                          <Button variant="outline" onClick={() => setBefore(undefined)}>
                            {t("competence.latest")}
                          </Button>
                        )}
                        {value.nextBeforeRevision && (
                          <Button
                            variant="outline"
                            onClick={() => setBefore(value.nextBeforeRevision!)}
                          >
                            {t("competence.older")}
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )
        )}
        <p className="text-xs text-muted-foreground">{t("competence.limits")}</p>
      </DialogContent>
    </Dialog>
  );
}
