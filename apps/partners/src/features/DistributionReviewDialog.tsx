import { useEffect, useRef, useState, type RefObject } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  conventionClauseFields,
  distributionPositions,
  distributionReviewSchema,
  distributionReviewInputSchema,
  type DistributionReviewInput,
  type DistributionReviewDossier,
} from "@coverview/contracts/partner";
import { PartnerApiError } from "@coverview/api-client/partner";
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  LoadingState,
  ErrorState,
} from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { formatDate, localDateTime, zurichInstant } from "./Field";

type Attempt = {
  command: { input: DistributionReviewInput; key: string } | null;
  blocked: boolean;
};
type Editing = { initial: DistributionReviewDossier; action: DistributionReviewInput["action"] };
const formSchema = z.object({
  position: z.string(),
  aspects: z.array(z.enum(conventionClauseFields)),
  examinedScope: z.string().trim().max(500),
  limitations: z.string().trim().max(1000),
  nextStep: z.string().trim().max(1000),
  reason: distributionReviewInputSchema.shape.reason,
  validUntil: z.string(),
  confirmed: z.boolean().refine(Boolean),
  originalsChecked: z.boolean(),
  transcriptionChecked: z.boolean(),
});
function Sources({ value }: { value: DistributionReviewDossier }) {
  const { t } = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const [aspect, setAspect] = useState<(typeof conventionClauseFields)[number]>("parties");
  const source = value.source,
    ref = source.conventionReference;
  const passage = source.status === "recorded" ? source.current?.clauses?.[aspect] : null;
  return (
    <section className="space-y-3 text-sm">
      <h3 ref={heading} tabIndex={-1} className="font-medium">
        {t("distributionReview.sources")}
      </h3>
      <p className="font-medium">{t(`convention.companies.${source.companyId}`)}</p>
      <p>
        {t("distributionReview.references", {
          clauses: source.revision,
          binding: source.binding.revision,
          convention: ref?.revision ?? 0,
          document: ref?.documentRevision ?? 0,
        })}
      </p>
      <p>{t(`solutionBinding.status.${source.status}`)}</p>
      <p>{t(`convention.status.${source.convention.summary.status}`)}</p>
      <p>{t("distributionReview.sourceLimits")}</p>
      <div className="flex flex-wrap items-center gap-3">
        {source.offer.sourceStatus === "current" && (
          <Button asChild variant="outline">
            <a
              target="_blank"
              rel="noopener noreferrer"
              href={partnerApi.sourceUrl(source.leadId, source.offer.id)}
            >
              {t("distributionReview.offerOriginal")}
            </a>
          </Button>
        )}
        {ref && source.convention.sourceStatus === "available" && (
          <Button asChild variant="outline">
            <a
              target="_blank"
              rel="noopener noreferrer"
              href={partnerApi.conventionSourceUrl(
                source.advisorId,
                source.scope.category,
                source.companyId,
                ref.decisionId,
              )}
            >
              {t("solutionClauses.original")}
            </a>
          </Button>
        )}
      </div>
      <Label htmlFor="distribution-source-aspect">{t("solutionClauses.aspect")}</Label>
      <select
        id="distribution-source-aspect"
        className="min-h-11 w-full rounded-md border border-input bg-background px-3"
        value={aspect}
        onChange={(event) => setAspect(z.enum(conventionClauseFields).parse(event.target.value))}
      >
        {conventionClauseFields.map((name) => (
          <option key={name} value={name}>
            {t(`solutionClauses.field.${name}`)}
          </option>
        ))}
      </select>
      <p>{t("solutionClauses.transcriptionLabel")}</p>
      <p className="whitespace-pre-wrap break-words">
        {passage?.quote ?? t("solutionBinding.unknown")}
      </p>
      {passage && (
        <p>{t("solutionClauses.location", { page: passage.page, locator: passage.locator })}</p>
      )}
    </section>
  );
}
function ReviewForm({
  editing,
  current,
  attempt,
  onSaved,
  onBack,
  onBusy,
}: {
  editing: Editing;
  current: DistributionReviewDossier;
  attempt: RefObject<Attempt>;
  onSaved: (value: DistributionReviewDossier) => void;
  onBack: () => void;
  onBusy: (value: boolean) => void;
}) {
  const { t } = useTranslation(),
    { identity } = usePartner();
  const { initial, action } = editing,
    prior = attempt.current.command?.input;
  const [step, setStep] = useState(action === "withdraw" || prior ? 3 : 0);
  const [error, setError] = useState(
    attempt.current.blocked ? "conflict" : prior ? "retryExact" : "",
  );
  const [frozen, setFrozen] = useState(!!prior);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [step]);
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      position: prior?.review?.position ?? "",
      aspects: prior?.review?.aspects ?? [],
      examinedScope: prior?.review?.examinedScope ?? "",
      limitations: prior?.review?.limitations ?? "",
      nextStep: prior?.review?.nextStep ?? "",
      reason: prior?.reason ?? "",
      validUntil: prior?.validUntil ? localDateTime(prior.validUntil) : "",
      confirmed: !!prior,
      originalsChecked: prior?.originalsChecked ?? false,
      transcriptionChecked: prior?.transcriptionChecked ?? false,
    },
  });
  const pending = form.formState.isSubmitting;
  const changed =
    current.scopeFingerprint !== initial.scopeFingerprint ||
    current.revision !== initial.revision ||
    (action === "record" ? !current.canRecord : !current.canWithdraw);
  const textField = (
    name: "examinedScope" | "limitations" | "nextStep" | "reason",
    max: number,
  ) => (
    <div className="space-y-2" key={name}>
      <Label htmlFor={`distribution-${name}`}>{t(`distributionReview.${name}`)}</Label>
      <textarea
        id={`distribution-${name}`}
        rows={3}
        maxLength={max}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        {...form.register(name)}
      />
    </div>
  );
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || attempt.current.blocked || (changed && !attempt.current.command)) return;
        if (step < 3) {
          const values = form.getValues();
          const valid =
            step === 0 ||
            (step === 1
              ? distributionReviewSchema
                  .pick({ position: true, aspects: true, examinedScope: true })
                  .safeParse({
                    position: values.position,
                    aspects: values.aspects,
                    examinedScope: values.examinedScope,
                  }).success
              : distributionReviewSchema
                  .pick({ limitations: true, nextStep: true })
                  .safeParse({ limitations: values.limitations, nextStep: values.nextStep })
                  .success &&
                distributionReviewInputSchema.shape.reason.safeParse(values.reason).success);
          if (!valid) {
            setError("invalid");
            return;
          }
          setError("");
          setStep(step + 1);
          return;
        }
        void form.handleSubmit(async (values) => {
          if (!attempt.current.command) {
            try {
              const until = action === "record" ? zurichInstant(values.validUntil) : null;
              if (
                until &&
                (Date.parse(until) <= Date.now() ||
                  [-3600000, 3600000].some(
                    (delta) =>
                      localDateTime(new Date(Date.parse(until) + delta).toISOString()) ===
                      values.validUntil,
                  ))
              )
                throw new Error("Invalid expiry");
              const input = distributionReviewInputSchema.parse({
                revision: initial.revision,
                scopeFingerprint: initial.scopeFingerprint,
                action,
                review:
                  action === "record"
                    ? {
                        position: values.position,
                        aspects: values.aspects,
                        examinedScope: values.examinedScope,
                        limitations: values.limitations,
                        nextStep: values.nextStep,
                      }
                    : null,
                reason: values.reason,
                validUntil: until,
                confirmed: values.confirmed,
                originalsChecked: action === "record" && values.originalsChecked,
                transcriptionChecked: action === "record" && values.transcriptionChecked,
              });
              attempt.current.command = { input, key: crypto.randomUUID() };
            } catch {
              setError("invalid");
              return;
            }
          }
          setFrozen(true);
          setError("");
          onBusy(true);
          try {
            onSaved(
              await partnerApi.recordDistributionReview(
                initial.source.leadId,
                initial.source.offer.id,
                initial.source.companyId,
                attempt.current.command.input,
                { csrfToken: identity.csrfToken, idempotencyKey: attempt.current.command.key },
              ),
            );
          } catch (cause) {
            attempt.current.blocked =
              cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
            setError(attempt.current.blocked ? "conflict" : "retryExact");
          } finally {
            onBusy(false);
          }
        })();
      }}
    >
      <h3 ref={heading} tabIndex={-1} className="font-medium">
        {t("distributionReview.step", { step: step + 1, total: 4 })}
      </h3>
      <p className="break-words text-sm">
        {t("solutionEvidence.version", {
          company: initial.source.offer.company,
          product: initial.source.offer.product,
          version: initial.source.offer.version,
        })}
      </p>
      <p className="text-sm">{initial.source.scope.title}</p>
      {changed && (
        <p role="alert" className="text-sm text-destructive">
          {t("solutionBinding.conflict")}
        </p>
      )}
      <fieldset disabled={pending || frozen || changed} className="space-y-4">
        <legend className="sr-only">{t(`distributionReview.${action}`)}</legend>
        {step === 0 ? (
          !changed && <Sources value={current} />
        ) : step === 1 ? (
          <>
            <Label htmlFor="distribution-position">{t("distributionReview.position")}</Label>
            <select
              id="distribution-position"
              className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...form.register("position")}
            >
              <option value="">{t("distributionReview.choose")}</option>
              {distributionPositions.map((position) => (
                <option value={position} key={position}>
                  {t(`distributionReview.positions.${position}`)}
                </option>
              ))}
            </select>
            <fieldset className="space-y-2">
              <legend>{t("distributionReview.aspects")}</legend>
              {conventionClauseFields.map((aspect) => (
                <label key={aspect} className="flex min-h-11 items-center gap-3 text-sm">
                  <input type="checkbox" value={aspect} {...form.register("aspects")} />
                  {t(`solutionClauses.field.${aspect}`)}
                </label>
              ))}
            </fieldset>
            <p className="text-sm">{t("distributionReview.citationRequired")}</p>
            {textField("examinedScope", 500)}
          </>
        ) : step === 2 ? (
          <>
            {textField("reason", 1000)}
            {textField("limitations", 1000)}
            {textField("nextStep", 1000)}
          </>
        ) : (
          <>
            <p className="text-sm">
              {t(
                action === "record"
                  ? "distributionReview.limits"
                  : "distributionReview.withdrawEffect",
              )}
            </p>
            {action === "record" ? (
              <>
                <p>{t(`distributionReview.positions.${form.getValues("position")}`)}</p>
                <p className="whitespace-pre-wrap break-words">{form.getValues("examinedScope")}</p>
                <Label htmlFor="distribution-until">{t("capacity.validUntil")}</Label>
                <Input
                  id="distribution-until"
                  type="datetime-local"
                  {...form.register("validUntil")}
                />
                {initial.maxValidUntil && (
                  <p className="text-sm">
                    {t("solutionClauses.maxUntil", { date: formatDate(initial.maxValidUntil) })}
                  </p>
                )}
                <label className="flex min-h-11 items-start gap-3 text-sm">
                  <input type="checkbox" {...form.register("originalsChecked")} />
                  {t("distributionReview.originalsChecked")}
                </label>
                <label className="flex min-h-11 items-start gap-3 text-sm">
                  <input type="checkbox" {...form.register("transcriptionChecked")} />
                  {t("distributionReview.transcriptionChecked")}
                </label>
              </>
            ) : (
              textField("reason", 1000)
            )}
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input type="checkbox" {...form.register("confirmed")} />
              {t(
                action === "record"
                  ? "distributionReview.confirm"
                  : "solutionBinding.confirmWithdraw",
              )}
            </label>
          </>
        )}
      </fieldset>
      {Object.keys(form.formState.errors).length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {t("distributionReview.invalid")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(error === "invalid" ? "distributionReview.invalid" : `solutionBinding.${error}`)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (step > 0 && !frozen && action === "record") setStep(step - 1);
            else onBack();
          }}
        >
          {t("capacity.back")}
        </Button>
        <Button
          type="submit"
          disabled={pending || attempt.current.blocked || (changed && !attempt.current.command)}
        >
          {t(
            pending
              ? "loading"
              : frozen
                ? "retry"
                : step < 3
                  ? "solutionBinding.next"
                  : `distributionReview.${action}`,
          )}
        </Button>
      </div>
    </form>
  );
}
function RecordDetails({
  value,
  historical,
}: {
  value: NonNullable<DistributionReviewDossier["current"]>;
  historical: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section className="space-y-3 text-sm">
      {historical && <p>{t("solutionBinding.historical")}</p>}
      <p>
        {t("capacity.record", { revision: value.revision, date: formatDate(value.recordedAt) })}
      </p>
      <p>
        {t("distributionReview.references", {
          clauses: value.clausesRevision,
          binding: value.bindingRevision,
          convention: value.conventionReference?.revision ?? 0,
          document: value.conventionReference?.documentRevision ?? 0,
        })}
      </p>
      <p className="font-medium">{value.scope.title}</p>
      {value.review && (
        <>
          {!value.sourcesCurrent && (
            <p role="status">{t("distributionReview.historicalSources")}</p>
          )}
          <p>{t(`distributionReview.positions.${value.review.position}`)}</p>
          <p>
            {value.review.aspects.map((name) => t(`solutionClauses.field.${name}`)).join(" · ")}
          </p>
          {(["examinedScope", "limitations", "nextStep"] as const).map((name) => (
            <div key={name}>
              <h4 className="font-medium">{t(`distributionReview.${name}`)}</h4>
              <p className="whitespace-pre-wrap break-words">{value.review![name]}</p>
            </div>
          ))}
        </>
      )}
      <p className="whitespace-pre-wrap break-words">{value.reason}</p>
      {value.validUntil && <p>{t("capacity.until", { date: formatDate(value.validUntil) })}</p>}
    </section>
  );
}

export function DistributionReviewDialog({
  leadId,
  offerId,
  companyId,
  onClose,
}: {
  leadId: string;
  offerId: string;
  companyId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(),
    session = usePartner(),
    client = useQueryClient();
  const attempt = useRef<Attempt>({ command: null, blocked: false });
  const [editing, setEditing] = useState<Editing | null>(null),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState(false),
    [before, setBefore] = useState<number>(),
    [selected, setSelected] = useState<number>(),
    [returning, setReturning] = useState(false),
    [sources, setSources] = useState(false),
    [saved, setSaved] = useState(false);
  const queryKey = [...session.queryKey, "distribution-review", leadId, offerId, companyId];
  const query = useQuery({
    queryKey: [...queryKey, before],
    queryFn: ({ signal }) =>
      partnerApi.distributionReview(leadId, offerId, companyId, before, signal),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 10000,
    retry: false,
  });
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!query.isPending && !query.isError && !editing) heading.current?.focus();
  }, [history, sources, selected, editing, returning, query.isPending, query.isError]);
  const reload = () => {
    setReturning(true);
    void query.refetch().finally(() => setReturning(false));
  };
  const back = () => {
    if (editing) {
      setEditing(null);
      attempt.current = { command: null, blocked: false };
      reload();
    } else if (sources) {
      setSources(false);
      reload();
    } else if (history) {
      if (selected !== undefined) setSelected(undefined);
      else {
        setHistory(false);
        setBefore(undefined);
      }
      reload();
    } else onClose();
  };
  const value = query.isError ? undefined : query.data,
    record = value?.history.find((entry) => entry.revision === selected);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-xl"
        closeLabel={t("close")}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("distributionReview.title")}</DialogTitle>
          <DialogDescription>{t("distributionReview.privacy")}</DialogDescription>
        </DialogHeader>
        {(!editing || query.isError) && (
          <Button variant="outline" disabled={busy} onClick={back}>
            {t("capacity.back")}
          </Button>
        )}
        {query.isPending || returning ? (
          <LoadingState label={t("loading")} />
        ) : query.isError ? (
          <ErrorState
            title={t("error")}
            description={t("distributionReview.error")}
            retryLabel={t("retry")}
            pendingLabel={t("loading")}
            onRetry={reload}
          />
        ) : (
          value &&
          (sources ? (
            <Sources value={value} />
          ) : editing ? (
            <ReviewForm
              editing={editing}
              current={value}
              attempt={attempt}
              onBack={back}
              onBusy={setBusy}
              onSaved={(result) => {
                client.setQueryData([...queryKey, undefined], result);
                setBefore(undefined);
                setEditing(null);
                setSaved(true);
                attempt.current = { command: null, blocked: false };
                void client.invalidateQueries({ queryKey });
              }}
            />
          ) : (
            <section className="space-y-4 text-sm">
              <h3 ref={heading} tabIndex={-1} className="font-medium">
                {t(history ? "capacity.history" : "distributionReview.current")}
              </h3>
              <p>{t("distributionReview.limits")}</p>
              <p className="text-muted-foreground">
                {t("advisorAssessment.at", { date: formatDate(value.source.assessedAt) })}
              </p>
              {history ? (
                record ? (
                  <RecordDetails key={record.revision} value={record} historical />
                ) : (
                  <>
                    <p>{t("solutionBinding.historical")}</p>
                    {value.history.length === 0 && <p>{t("solutionBinding.noHistory")}</p>}
                    {value.history.map((entry) => (
                      <Button
                        key={entry.revision}
                        variant="outline"
                        className="h-auto w-full whitespace-normal text-left"
                        onClick={() => setSelected(entry.revision)}
                      >
                        {t("capacity.record", {
                          revision: entry.revision,
                          date: formatDate(entry.recordedAt),
                        })}
                      </Button>
                    ))}
                    <div className="flex flex-wrap items-center gap-3">
                      {before && (
                        <Button variant="outline" onClick={() => setBefore(undefined)}>
                          {t("capacity.latest")}
                        </Button>
                      )}
                      {value.nextBeforeRevision && (
                        <Button
                          variant="outline"
                          onClick={() => setBefore(value.nextBeforeRevision!)}
                        >
                          {t("capacity.older")}
                        </Button>
                      )}
                    </div>
                  </>
                )
              ) : (
                <>
                  {saved && <p role="status">{t("distributionReview.saved")}</p>}
                  <p className="font-medium break-words">
                    {t("solutionEvidence.version", {
                      company: value.source.offer.company,
                      product: value.source.offer.product,
                      version: value.source.offer.version,
                    })}
                  </p>
                  <p>{value.source.scope.title}</p>
                  <p>{t(`solutionBinding.status.${value.status}`)}</p>
                  {!value.canRecord && <p role="status">{t("distributionReview.unavailable")}</p>}
                  {value.source.changeRequested && (
                    <p role="status">{t("advisorAssessment.changeRequested")}</p>
                  )}
                  {value.position && <p>{t(`distributionReview.positions.${value.position}`)}</p>}
                  <Button variant="outline" onClick={() => setSources(true)}>
                    {t("distributionReview.sources")}
                  </Button>
                  {value.current && (
                    <RecordDetails
                      key={value.current.revision}
                      value={value.current}
                      historical={value.status !== "recorded"}
                    />
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      disabled={!value.canRecord}
                      onClick={() => {
                        setSaved(false);
                        setEditing({ initial: value, action: "record" });
                      }}
                    >
                      {t("distributionReview.record")}
                    </Button>
                    {value.canWithdraw && (
                      <Button
                        variant="outline"
                        onClick={() => setEditing({ initial: value, action: "withdraw" })}
                      >
                        {t("distributionReview.withdraw")}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => {
                        setHistory(true);
                        setBefore(undefined);
                        reload();
                      }}
                    >
                      {t("capacity.history")}
                    </Button>
                    <Button variant="outline" disabled={query.isFetching} onClick={reload}>
                      {t(query.isFetching ? "loading" : "capacity.refresh")}
                    </Button>
                  </div>
                </>
              )}
            </section>
          ))
        )}
      </DialogContent>
    </Dialog>
  );
}
