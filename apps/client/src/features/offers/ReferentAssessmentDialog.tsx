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
  swissCantonNamesFr,
} from "@coverview/ui";
import type { IdentityMe } from "@coverview/api-client";
import { partnerApi } from "../../partner-api";

export function ReferentAssessmentDialog({
  identity,
  leadId,
  onClose,
}: {
  identity: IdentityMe;
  leadId: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("offers");

  const [sources, setSources] = useState(false);
  const query = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "referent-assessment", leadId],
    queryFn: ({ signal }) => partnerApi.referentAssessment(leadId, true, signal),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 10000,
    retry: false,
  });
  const value = query.isError ? undefined : query.data;
  const assessment = value?.assessment;
  const date = (instant: string | null) =>
    instant
      ? new Intl.DateTimeFormat(i18n.language, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Europe/Zurich",
        }).format(new Date(instant))
      : t("referentAssessment.unspecified");
  const language = (code: string) =>
    new Intl.DisplayNames([i18n.language], { type: "language" }).of(code) ?? code;
  const list = (values: string[]) =>
    values.length
      ? new Intl.ListFormat(i18n.language).format(values)
      : t("referentAssessment.unspecified");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl" closeLabel={t("close")}>
        <DialogHeader>
          <DialogTitle>{t("referentAssessment.title")}</DialogTitle>
          <DialogDescription>
            {value
              ? t("referentAssessment.subject", {
                  title: value.title,
                  category: t(`categories.${value.category}`),
                })
              : t("referentAssessment.description")}
          </DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <LoadingState label={t("loading")} />
        ) : query.isError ? (
          <ErrorState
            title={t("error")}
            description={t("referentAssessment.error")}
            retryLabel={t("retry")}
            pendingLabel={t("loading")}
            onRetry={() => void query.refetch()}
          />
        ) : (
          value && (
            <>
              <p className="text-xs text-muted-foreground">
                {t("referentAssessment.at", { date: date(value.assessedAt) })}
              </p>
              {value.selection?.advisor && (
                <p className="text-sm font-medium">
                  {t("referentAssessment.advisor", {
                    name: value.selection.advisor.name,
                    organization: value.selection.advisor.organization,
                  })}
                </p>
              )}
              <p role="status" className="text-sm">
                {t(`referentAssessment.state.${value.status}`)}
              </p>
              <div className="flex flex-wrap gap-3">
                {assessment && (
                  <Button variant="outline" onClick={() => setSources(!sources)}>
                    {t(sources ? "referentAssessment.back" : "referentAssessment.sources")}
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={query.isFetching}
                  onClick={() => void query.refetch()}
                >
                  {t(query.isFetching ? "loading" : "referentAssessment.refresh")}
                </Button>
              </div>
              {assessment &&
                (sources ? (
                  <div className="space-y-5 text-sm">
                    <section className="space-y-2">
                      <h3 className="font-medium">{t("referentAssessment.selectionSource")}</h3>
                      <p>
                        {t("referentAssessment.confirmed", {
                          date: date(value.selection?.confirmedAt ?? null),
                        })}
                      </p>
                    </section>
                    <section className="space-y-2">
                      <h3 className="font-medium">{t("referentAssessment.clientSource")}</h3>
                      <p>
                        {t(`referentAssessment.preferenceStatus.${assessment.preferences.status}`)}
                      </p>
                      {assessment.preferences.confirmedAt && (
                        <p>
                          {t("referentAssessment.confirmed", {
                            date: date(assessment.preferences.confirmedAt),
                          })}
                        </p>
                      )}
                      <p>
                        {t("referentAssessment.languageValue", {
                          value: assessment.preferences.languageCode
                            ? language(assessment.preferences.languageCode)
                            : t("referentAssessment.unspecified"),
                        })}
                      </p>
                      <p>
                        {t("referentAssessment.cantonValue", {
                          value: assessment.preferences.canton
                            ? swissCantonNamesFr[assessment.preferences.canton]
                            : t("referentAssessment.unspecified"),
                        })}
                      </p>
                      <p>
                        {t("referentAssessment.modeValue", {
                          value: assessment.preferences.mode
                            ? t(`advice.modes.${assessment.preferences.mode}`)
                            : t("referentAssessment.unspecified"),
                        })}
                      </p>
                    </section>
                    <section className="space-y-2">
                      <h3 className="font-medium">{t("referentAssessment.practiceSource")}</h3>
                      <p>{t(`referentAssessment.practiceStatus.${assessment.practice.status}`)}</p>
                      {assessment.practice.declaredAt && (
                        <p>
                          {t("referentAssessment.declared", {
                            date: date(assessment.practice.declaredAt),
                          })}
                        </p>
                      )}
                      <p>
                        {t("referentAssessment.languageValue", {
                          value: list(assessment.practice.languageCodes.map(language)),
                        })}
                      </p>
                      <p>
                        {t("referentAssessment.cantonValue", {
                          value: list(
                            assessment.practice.cantons.map((code) => swissCantonNamesFr[code]),
                          ),
                        })}
                      </p>
                    </section>
                    <section className="space-y-2">
                      <h3 className="font-medium">{t("referentAssessment.modesSource")}</h3>
                      <p>{t(`referentAssessment.modesStatus.${assessment.sharedModes.status}`)}</p>
                      {assessment.sharedModes.declaredAt && (
                        <p>
                          {t("referentAssessment.declared", {
                            date: date(assessment.sharedModes.declaredAt),
                          })}
                        </p>
                      )}
                      {assessment.sharedModes.modes.length > 0 && (
                        <p>
                          {list(
                            assessment.sharedModes.modes.map((mode) => t(`advice.modes.${mode}`)),
                          )}
                        </p>
                      )}
                    </section>
                    <section className="space-y-2">
                      <h3 className="font-medium">{t("referentAssessment.competence")}</h3>
                      <p>{t(`referents.competenceStatus.${assessment.competence.status}`)}</p>
                      {assessment.competence.scope && (
                        <p className="whitespace-pre-wrap">{assessment.competence.scope}</p>
                      )}
                      {assessment.competence.reviewedAt && (
                        <p>
                          {t("referentAssessment.reviewed", {
                            date: date(assessment.competence.reviewedAt),
                            until: date(assessment.competence.validUntil),
                          })}
                        </p>
                      )}
                    </section>
                  </div>
                ) : (
                  <div className="space-y-5 text-sm">
                    <dl className="space-y-4">
                      {(["language", "canton", "mode"] as const).map((criterion) => (
                        <div key={criterion} className="space-y-2">
                          <dt className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">
                              {t(`referentAssessment.criteria.${criterion}`)}
                            </span>
                            <Badge variant="secondary">
                              {t(
                                `referentAssessment.status.${assessment.criteria[criterion].status}`,
                              )}
                            </Badge>
                          </dt>
                          <dd className="text-muted-foreground">
                            {t(
                              `referentAssessment.reason.${assessment.criteria[criterion].reason}`,
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <section className="space-y-2">
                      <h3 className="font-medium">{t("referentAssessment.competence")}</h3>
                      <p>{t(`referents.competenceStatus.${assessment.competence.status}`)}</p>
                    </section>
                    <section className="space-y-2">
                      <h3 className="font-medium">{t("referentAssessment.remainingTitle")}</h3>
                      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                        {assessment.remainingChecks.map((check) => (
                          <li key={check}>{t(`referentAssessment.remaining.${check}`)}</li>
                        ))}
                      </ul>
                    </section>
                  </div>
                ))}
              <p className="text-sm text-muted-foreground">{t("referentAssessment.limits")}</p>
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
