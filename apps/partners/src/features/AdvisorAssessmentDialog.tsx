import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  LoadingState,
  ErrorState,
} from "@coverview/ui";
import { swissCantonNamesFr } from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { formatDate } from "./Field";
import { NeedConflictPanel } from "./NeedConflictPanel";
import { NeedCapacityPanel } from "./NeedCapacityPanel";
import { AdvisorCapacity } from "./AdvisorCapacity";
import { NeedExpertiseDialog } from "./NeedExpertiseDialog";
import { CounselDialog } from "./CounselDialog";

export function AdvisorAssessmentDialog({
  leadId,
  title,
  onClose,
}: {
  leadId: string;
  title: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation(),
    session = usePartner();
  const [view, setView] = useState<
    "assessment" | "sources" | "capacity" | "decision" | "conflicts" | "expertise" | "counsel"
  >("assessment");
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState(false);
  const query = useQuery({
    queryKey: [...session.queryKey, "advisor-assessment", 2, leadId],
    queryFn: ({ signal }) => partnerApi.advisorCapacityAssessment(leadId, signal),
    enabled: view !== "expertise" && view !== "counsel",
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 10000,
    retry: false,
  });
  const value = query.data;
  const language = (code: string) =>
    new Intl.DisplayNames([i18n.language], { type: "language" }).of(code) ?? code;
  const list = (values: string[]) =>
    values.length
      ? new Intl.ListFormat(i18n.language).format(values)
      : t("advisorAssessment.unspecified");
  if (view === "counsel")
    return (
      <CounselDialog
        leadId={leadId}
        onClose={() => {
          setReturning(true);
          setView("assessment");
          void query.refetch().finally(() => setReturning(false));
        }}
      />
    );
  if (view === "expertise")
    return (
      <NeedExpertiseDialog
        leadId={leadId}
        onClose={() => {
          setReturning(true);
          setView("assessment");
          void query.refetch().finally(() => setReturning(false));
        }}
      />
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl" closeLabel={t("close")}>
        <DialogHeader>
          <DialogTitle>{t("advisorAssessment.title")}</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        {query.isPending || returning ? (
          <LoadingState label={t("loading")} />
        ) : query.isError ? (
          <ErrorState
            title={t("error")}
            description={t("advisorAssessment.error")}
            retryLabel={t("retry")}
            pendingLabel={t("loading")}
            onRetry={() => void query.refetch()}
          />
        ) : (
          value && (
            <>
              <p className="text-xs text-muted-foreground">
                {t("advisorAssessment.at", { date: formatDate(value.assessedAt) })}
              </p>
              {value.continuity.changeRequested && (
                <p
                  role="status"
                  className="rounded-lg border border-border p-3 text-sm font-medium"
                >
                  {t("advisorAssessment.changeRequested")}
                </p>
              )}
              <p className="text-sm">
                {t(`advisorAssessment.continuity.${value.continuity.status}`)}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={busy} onClick={() => setView("counsel")}>
                  {t("counsel.title")}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setView(view === "sources" ? "assessment" : "sources")}
                >
                  {t(view === "sources" ? "advisorAssessment.back" : "advisorAssessment.sources")}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setView(view === "capacity" ? "assessment" : "capacity")}
                >
                  {t(
                    view === "capacity"
                      ? "advisorAssessment.back"
                      : "advisorAssessment.capacity.open",
                  )}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setView(view === "decision" ? "assessment" : "decision")}
                >
                  {t(view === "decision" ? "advisorAssessment.back" : "needCapacity.open")}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setView(view === "conflicts" ? "assessment" : "conflicts")}
                >
                  {t(view === "conflicts" ? "advisorAssessment.back" : "needConflict.open")}
                </Button>
                <Button
                  variant="outline"
                  disabled={query.isFetching || busy}
                  onClick={() => void query.refetch()}
                >
                  {t(query.isFetching ? "loading" : "advisorAssessment.refresh")}
                </Button>
              </div>
              {view === "conflicts" ? (
                <NeedConflictPanel leadId={leadId} onBusy={setBusy} />
              ) : view === "decision" ? (
                <NeedCapacityPanel leadId={leadId} onBusy={setBusy} />
              ) : view === "capacity" ? (
                <AdvisorCapacity value={value} />
              ) : view === "sources" ? (
                <section className="space-y-4 text-sm">
                  <h3 className="font-medium">{t("advisorAssessment.sources")}</h3>
                  <div className="space-y-2">
                    <h4 className="font-medium">{t("advisorAssessment.clientSource")}</h4>
                    <p>{t(`advisorAssessment.preferenceStatus.${value.preferences.status}`)}</p>
                    {value.preferences.current && (
                      <>
                        <p>
                          {t("advisorAssessment.confirmed", {
                            date: formatDate(value.preferences.current.confirmedAt),
                          })}
                        </p>
                        <p>
                          {t("advisorAssessment.languageValue", {
                            value: value.preferences.current.languageCode
                              ? language(value.preferences.current.languageCode)
                              : t("advisorAssessment.unspecified"),
                          })}
                        </p>
                        <p>
                          {t("advisorAssessment.modeValue", {
                            value: value.preferences.current.mode
                              ? t(`advice.modes.${value.preferences.current.mode}`)
                              : t("advisorAssessment.unspecified"),
                          })}
                        </p>
                        <p>
                          {t("advisorAssessment.cantonValue", {
                            value: value.preferences.current.canton
                              ? swissCantonNamesFr[value.preferences.current.canton]
                              : t("advisorAssessment.unspecified"),
                          })}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">{t("advisorAssessment.practiceSource")}</h4>
                    <p>{t(`practice.summary.${value.practice.status}`)}</p>
                    <p>
                      {t("advisorAssessment.declared", {
                        date: formatDate(value.practice.declaredAt),
                      })}
                    </p>
                    <p>
                      {t("advisorAssessment.languageValue", {
                        value: list(value.practice.languageCodes.map(language)),
                      })}
                    </p>
                    <p>
                      {t("advisorAssessment.cantonValue", {
                        value: list(value.practice.cantons.map((code) => swissCantonNamesFr[code])),
                      })}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">{t("advisorAssessment.modeSource")}</h4>
                    <p>{t(`advisorAssessment.modeStatus.${value.modes.status}`)}</p>
                    <p>
                      {t("advisorAssessment.declared", {
                        date: formatDate(value.modes.declaredAt),
                      })}
                    </p>
                    <p>{list(value.modes.values.map((mode) => t(`advice.modes.${mode}`)))}</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">{t("advisorAssessment.competence")}</h4>
                    <p>{t(`competence.status.${value.competence.status}`)}</p>
                    {value.competence.scope && <p>{value.competence.scope}</p>}
                    <p>
                      {t("advisorAssessment.reviewed", {
                        date: formatDate(value.competence.reviewedAt),
                        until: formatDate(value.competence.validUntil),
                      })}
                    </p>
                    <p className="text-muted-foreground">{t("competence.limits")}</p>
                    <Button variant="outline" onClick={() => setView("expertise")}>
                      {t("needExpertise.open")}
                    </Button>
                  </div>
                </section>
              ) : (
                <section className="space-y-4">
                  <h3 className="font-medium">{t("advisorAssessment.criteriaTitle")}</h3>
                  <ul className="space-y-3">
                    {(["language", "canton", "mode"] as const).map((criterion) => (
                      <li
                        key={criterion}
                        className="space-y-2 rounded-lg border border-border p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">
                            {t(`advisorAssessment.criteria.${criterion}`)}
                          </span>
                          <Badge variant="outline">
                            {t(`advisorAssessment.status.${value.criteria[criterion].status}`)}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">
                          {t(`advisorAssessment.reason.${value.criteria[criterion].reason}`)}
                        </p>
                      </li>
                    ))}
                    <li className="space-y-2 rounded-lg border border-border p-3 text-sm">
                      <p className="font-medium">{t("advisorAssessment.competence")}</p>
                      <p>{t(`competence.status.${value.competence.status}`)}</p>
                      <p className="text-muted-foreground">{t("competence.limits")}</p>
                      <Button variant="outline" onClick={() => setView("expertise")}>
                        {t("needExpertise.open")}
                      </Button>
                    </li>
                  </ul>
                  <h3 className="font-medium">{t("advisorAssessment.remainingTitle")}</h3>
                  <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                    {value.remainingChecks.map((check) => (
                      <li key={check}>{t(`advisorAssessment.remaining.${check}`)}</li>
                    ))}
                  </ul>
                </section>
              )}
              <p className="text-sm text-muted-foreground">{t("advisorAssessment.limits")}</p>
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
