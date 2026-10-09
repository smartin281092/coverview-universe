import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Label,
} from "@coverview/ui";
import {
  evaluationContestInputSchema,
  type Evaluation,
  type EvaluationContestInput,
} from "@coverview/contracts/partner-profiles";
import {
  surveyImprovementSchema,
  surveyPositiveSchema,
} from "@coverview/contracts/partner-quality";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { readText } from "./Field";
import { numberFormat } from "@coverview/ui/number-format";

const day = new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" });
type Subject = Evaluation["contestable"][number];

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-lg font-medium">{value}</dd>
    </div>
  );
}

function ContestDialog({
  userId,
  subject,
  onClose,
}: {
  userId: string;
  subject: Subject;
  onClose: () => void;
}) {
  const { t } = useTranslation("profiles"),
    session = usePartner(),
    cache = useQueryClient(),
    reasonId = useId(),
    confirmId = useId(),
    [error, setError] = useState(false),
    attempt = useRef<{ payload: string; key: string } | null>(null),
    abort = useRef(new AbortController());
  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    return () => controller.abort();
  }, []);
  const mutation = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (input: EvaluationContestInput) => {
      const parsed = evaluationContestInputSchema.parse(input),
        payload = JSON.stringify(parsed);
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      return partnerApi.contestEvaluation(userId, parsed, {
        csrfToken: session.identity.csrfToken,
        idempotencyKey: attempt.current.key,
        signal: abort.current.signal,
      });
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: [...session.queryKey, "evaluation", userId] });
      onClose();
    },
    onError: () => setError(true),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;
    const data = new FormData(event.currentTarget);
    const parsed = evaluationContestInputSchema.safeParse({
      subjectKind: subject.subjectKind,
      subjectId: subject.subjectId,
      reason: readText(data, "reason"),
      confirmed: data.get("confirmed") === "on",
    });
    if (!parsed.success) {
      setError(true);
      return;
    }
    setError(false);
    mutation.mutate(parsed.data);
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !mutation.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("evaluation.contest")}</DialogTitle>
          <DialogDescription>
            {t(`evaluation.subject.${subject.subjectKind}`)}
            {" · "}
            {subject.leadTitle}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor={reasonId}>{t("evaluation.contestReason")}</Label>
            <textarea
              id={reasonId}
              name="reason"
              required
              minLength={10}
              maxLength={2000}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-start gap-3 text-sm" htmlFor={confirmId}>
            <input id={confirmId} name="confirmed" type="checkbox" required className="mt-1" />
            {t("evaluation.contestConfirm")}
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {t("error")}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {t("evaluation.contestSend")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProfileEvaluation({ evaluation }: { evaluation: Evaluation }) {
  const { t } = useTranslation("profiles"),
    { t: quality } = useTranslation("quality"),
    [subject, setSubject] = useState<Subject | null>(null);
  const client = evaluation.clientExperience,
    operational = evaluation.operational;
  const label = (kind: "positive" | "improvement", key: string) =>
    quality(`${kind}.${key}`, { defaultValue: key });
  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        {t("evaluation.period", {
          from: day.format(new Date(evaluation.periodFrom)),
          to: day.format(new Date(evaluation.periodTo)),
        })}
      </p>
      <section className="space-y-4 rounded-xl border border-border p-5">
        <h2 className="font-medium">{t("evaluation.clientTitle")}</h2>
        <p>
          {client.rating.status === "available"
            ? t("rating.available", {
                average:
                  typeof client.rating.average === "number"
                    ? numberFormat("fr-CH").format(client.rating.average)
                    : undefined,
              })
            : t("rating.insufficient", {
                count: client.rating.count,
                minimum: client.rating.minimum,
              })}
        </p>
        <dl className="grid grid-cols-5 gap-2" aria-label={t("evaluation.distribution")}>
          {client.distribution.map((count, index) => (
            <Stat key={index} label={t("evaluation.stars", { count: index + 1 })} value={count} />
          ))}
        </dl>
        {client.positives.length > 0 && (
          <p className="text-sm">
            {t("evaluation.positives", {
              values: client.positives
                .filter((p) => surveyPositiveSchema.safeParse(p.key).success)
                .map((p) => `${label("positive", p.key)} (${p.count})`)
                .join(", "),
            })}
          </p>
        )}
        {client.improvements.length > 0 && (
          <p className="text-sm">
            {t("evaluation.improvements", {
              values: client.improvements
                .filter((p) => surveyImprovementSchema.safeParse(p.key).success)
                .map((p) => `${label("improvement", p.key)} (${p.count})`)
                .join(", "),
            })}
          </p>
        )}
      </section>
      <section className="space-y-4 rounded-xl border border-border p-5">
        <h2 className="font-medium">{t("evaluation.operationalTitle")}</h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Stat label={t("evaluation.assigned")} value={operational.assigned} />
          <Stat
            label={t("evaluation.onTime")}
            value={
              operational.onTimeRate === null
                ? t("evaluation.noRate")
                : t("evaluation.onTimeRate", { rate: operational.onTimeRate })
            }
          />
          <Stat label={t("evaluation.complaints")} value={operational.complaints} />
          <Stat label={t("evaluation.complaintsClosed")} value={operational.complaintsClosed} />
          <Stat label={t("evaluation.activeLeads")} value={operational.activeLeads} />
          <Stat label={t("evaluation.followedUp")} value={operational.followedUp} />
        </dl>
      </section>
      {evaluation.economic && (
        <section className="space-y-4 rounded-xl border border-border p-5">
          <h2 className="font-medium">{t("evaluation.economicTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("evaluation.economicNotice")}</p>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Stat label={t("evaluation.cases")} value={evaluation.economic.cases} />
            <Stat label={t("evaluation.disputed")} value={evaluation.economic.disputed} />
            <Stat label={t("evaluation.clawbacks")} value={evaluation.economic.clawbacks} />
          </dl>
        </section>
      )}
      <p className="text-sm text-muted-foreground">{t("evaluation.method")}</p>
      <section className="space-y-3">
        <h2 className="font-medium">{t("evaluation.contestsTitle")}</h2>
        {evaluation.contests.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("evaluation.noContests")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {evaluation.contests.map((contest) => (
              <li key={contest.id} className="space-y-1 p-4 text-sm">
                <p className="font-medium">
                  {t(`evaluation.subject.${contest.subjectKind}`)}
                  {" · "}
                  {t(`evaluation.contestStatus.${contest.status}`)}
                </p>
                <p className="whitespace-pre-wrap break-words text-muted-foreground">
                  {contest.reason}
                </p>
                {contest.decisionReason && <p>{contest.decisionReason}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
      {evaluation.canContest && (
        <section className="space-y-3">
          <h2 className="font-medium">{t("evaluation.contestableTitle")}</h2>
          {evaluation.contestable.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("evaluation.noContestable")}</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {evaluation.contestable.map((item) => (
                <li
                  key={`${item.subjectKind}:${item.subjectId}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"
                >
                  <span>
                    {t(`evaluation.subject.${item.subjectKind}`)}
                    {" · "}
                    {item.leadTitle}
                    {" · "}
                    {day.format(new Date(item.occurredAt))}
                    {item.rating !== null &&
                      ` · ${t("evaluation.ratingValue", { rating: item.rating })}`}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setSubject(item)}>
                    {t("evaluation.contest")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {subject && (
        <ContestDialog
          userId={evaluation.userId}
          subject={subject}
          onClose={() => setSubject(null)}
        />
      )}
    </div>
  );
}
