import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Clock3, CircleAlert } from "lucide-react";
import type {
  CompanyAction,
  CompanyActionObservation,
  CompanyActionValues,
} from "@coverview/contracts";
import { Button } from "@coverview/ui";

export function CompanyActionValuesView({ values }: { values: CompanyActionValues }) {
  const { t } = useTranslation("actions");
  const { t: fields } = useTranslation("documents");
  return Object.keys(values).length ? (
    <dl className="space-y-2 text-sm">
      {Object.entries(values).map(([key, value]) => (
        <div key={key} className="grid grid-cols-2 gap-3">
          <dt className="text-muted-foreground">{fields(`field.${key}`)}</dt>
          <dd className="break-words font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  ) : (
    <p className="text-sm text-muted-foreground">{t("noValue")}</p>
  );
}

export function CompanyActionStatus({
  action,
  detail = false,
}: {
  action: CompanyAction;
  detail?: boolean;
}) {
  const { t } = useTranslation("actions");
  const green = ["current", "notified", "confirmed"].includes(action.status);
  const waiting = ["requested", "in_progress"].includes(action.status);
  const Icon = green ? CheckCircle2 : waiting ? Clock3 : CircleAlert;
  return (
    <div
      className={`flex items-start gap-2 rounded-lg p-3 text-sm ${green ? "bg-emerald-50 text-emerald-800" : waiting ? "bg-muted text-muted-foreground" : "bg-amber-50 text-amber-900"}`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium">{t(`status.${action.status}`)}</p>
        {detail && <p>{t(`help.${action.status}`)}</p>}
      </div>
    </div>
  );
}

export function CompanyActionDetails({
  action,
  pending,
  onRequest,
  onReview,
}: {
  action: CompanyAction;
  pending: boolean;
  onRequest: () => void;
  onReview: (observation: CompanyActionObservation) => void;
}) {
  const { t, i18n } = useTranslation("actions");
  const [page, setPage] = useState(0);
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  const documentDate = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  const observations = action.observations.slice(page * 6, page * 6 + 6);
  return (
    <div className="space-y-6">
      <CompanyActionStatus action={action} detail />
      <section className="space-y-3">
        <h3 className="font-medium">{t("currentValues")}</h3>
        <CompanyActionValuesView values={action.currentValues} />
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/profile" search={{ person: action.profileId, tab: "general" }}>
            {t("openProfile")}
          </Link>
        </Button>
      </section>
      {action.evidence && (
        <section className="space-y-2 border-t border-border pt-5 text-sm">
          <h3 className="font-medium">
            {t("evidenceDate", {
              kind: t(`status.${action.evidence.kind}`),
              date: date.format(new Date(action.evidence.occurredAt)),
            })}
          </h3>
          <p className="break-words">{t("reference", { reference: action.evidence.reference })}</p>
          <p className="text-muted-foreground">
            {t("evidenceRecorded", { date: date.format(new Date(action.evidence.recordedAt)) })}
          </p>
        </section>
      )}
      <section className="space-y-3 border-t border-border pt-5">
        <h3 className="font-medium">{t("observations")}</h3>
        <ul className="divide-y divide-border">
          {observations.map((observation) => (
            <li
              key={`${observation.documentId}:${observation.recordedAt}`}
              className="space-y-3 py-4"
            >
              <Link
                to="/documents/$documentId"
                params={{ documentId: observation.documentId }}
                className="inline-flex min-h-11 items-center font-medium text-indigo-600 underline underline-offset-4"
              >
                {observation.documentTitle}
              </Link>
              <CompanyActionValuesView values={observation.values} />
              {observation.ambiguous && (
                <p className="text-sm text-amber-900">{t("ambiguousSource")}</p>
              )}
              <Button
                variant="outline"
                className="min-h-11"
                disabled={pending}
                onClick={() => onReview(observation)}
              >
                {t("verifySource")}
              </Button>
              <p className="text-xs text-muted-foreground">
                {observation.documentDate
                  ? t("documentDate", {
                      date: documentDate.format(new Date(`${observation.documentDate}T00:00:00Z`)),
                    })
                  : t("unknownDate")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("observedAt", { date: date.format(new Date(observation.recordedAt)) })}
              </p>
            </li>
          ))}
        </ul>
        {action.observations.length > 6 && (
          <nav className="flex gap-3" aria-label={t("sourcePagination")}>
            <Button
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((value) => value - 1)}
            >
              {t("previous")}
            </Button>
            <Button
              variant="outline"
              disabled={(page + 1) * 6 >= action.observations.length}
              onClick={() => setPage((value) => value + 1)}
            >
              {t("next")}
            </Button>
          </nav>
        )}
      </section>
      {action.canRequest && (
        <div className="space-y-3 border-t border-border pt-5">
          <p className="text-sm text-muted-foreground">{t("requestHelp")}</p>
          <Button className="min-h-11" disabled={pending} onClick={onRequest}>
            {t(pending ? "requesting" : "request")}
          </Button>
        </div>
      )}
    </div>
  );
}
