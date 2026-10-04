import { useEffect, useRef, useState, type RefObject } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  needExpertiseInputSchema,
  needExpertisePositionSchema,
  type NeedExpertiseDossier,
  type NeedExpertiseInput,
} from "@coverview/contracts/partner";
import { PartnerApiError } from "@coverview/api-client/partner";
import { Button, Input, Label, LoadingState, ErrorState } from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { NeedExpertiseEvidenceDetails } from "./NeedExpertiseEvidenceDetails";
import { formatDate, localDateTime, zurichInstant } from "./Field";

function expiry(value: string) {
  const instant = zurichInstant(value),
    time = Date.parse(instant);
  if (
    [-3600000, 3600000].some(
      (delta) => localDateTime(new Date(time + delta).toISOString()) === value,
    )
  )
    throw new Error("Ambiguous local time");
  return instant;
}

type DecisionAttempt = {
  command: { input: NeedExpertiseInput; key: string } | null;
  blocked: boolean;
};

function DecisionForm({
  initial,
  current,
  action,
  retryState,
  onSaved,
  onBack,
  onBusy,
}: {
  initial: NeedExpertiseDossier;
  current: NeedExpertiseDossier;
  action: NeedExpertiseInput["action"];
  retryState: RefObject<DecisionAttempt>;
  onSaved: (value: NeedExpertiseDossier) => void;
  onBack: () => void;
  onBusy: (value: boolean) => void;
}) {
  const { t } = useTranslation(),
    { identity } = usePartner();
  const [error, setError] = useState(
      retryState.current.blocked
        ? t("needExpertiseDecision.conflict")
        : retryState.current.command
          ? t("capacity.retryExact")
          : "",
    ),
    [blocked, setBlocked] = useState(retryState.current.blocked),
    [frozen, setFrozen] = useState(!!retryState.current.command);
  const priorInput = retryState.current.command?.input;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const schema = z
    .object({
      position: needExpertisePositionSchema.or(z.literal("")),
      reviewedScope: z.string(),
      limitations: z.string(),
      nextStep: z.string(),
      reason: needExpertiseInputSchema.shape.reason,
      validUntil: z.string(),
      confirmed: z.boolean().refine(Boolean),
    })
    .superRefine((values, context) => {
      if (action === "withdraw" || retryState.current.command) return;
      try {
        if (
          !values.position ||
          !needExpertiseInputSchema.shape.reviewedScope.safeParse(values.reviewedScope).success ||
          !needExpertiseInputSchema.shape.limitations.safeParse(values.limitations).success ||
          !needExpertiseInputSchema.shape.nextStep.safeParse(values.nextStep).success
        )
          throw new Error("Missing review");
        if (Date.parse(expiry(values.validUntil)) <= Date.now()) throw new Error("Past expiry");
      } catch {
        context.addIssue({ code: "custom", message: "PARTNER_ACTION_REQUIRED" });
      }
    });
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      position: priorInput?.position ?? ("" as const),
      reviewedScope: priorInput?.reviewedScope ?? "",
      limitations: priorInput?.limitations ?? "",
      nextStep: priorInput?.nextStep ?? "",
      reason: priorInput?.reason ?? "",
      validUntil: priorInput?.validUntil ? localDateTime(priorInput.validUntil) : "",
      confirmed: !!priorInput,
    },
  });
  const pending = form.formState.isSubmitting;
  const changed =
    current.scopeFingerprint !== initial.scopeFingerprint ||
    current.revision !== initial.revision ||
    (action === "withdraw" && !current.canWithdraw);
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || blocked || (changed && !retryState.current.command)) return;
        void form.handleSubmit(async (values) => {
          retryState.current.command ??= {
            input: needExpertiseInputSchema.parse({
              ...values,
              action,
              revision: initial.revision,
              scopeFingerprint: initial.scopeFingerprint,
              position: action === "decide" ? values.position : null,
              reviewedScope: action === "decide" ? values.reviewedScope : null,
              limitations: action === "decide" ? values.limitations : null,
              nextStep: action === "decide" ? values.nextStep : null,
              validUntil: action === "decide" ? expiry(values.validUntil) : null,
            }),
            key: crypto.randomUUID(),
          };
          setFrozen(true);
          setError("");
          onBusy(true);
          try {
            onSaved(
              await partnerApi.decideNeedExpertise(
                initial.leadId,
                retryState.current.command.input,
                {
                  csrfToken: identity.csrfToken,
                  idempotencyKey: retryState.current.command.key,
                },
              ),
            );
          } catch (cause) {
            const conflict =
              cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
            setBlocked(conflict);
            retryState.current.blocked = conflict;
            setError(t(conflict ? "needExpertiseDecision.conflict" : "capacity.retryExact"));
          } finally {
            onBusy(false);
          }
        })();
      }}
    >
      <h3 ref={heading} tabIndex={-1} className="font-medium">
        {t(`needExpertiseDecision.${action}`)}
      </h3>
      <p className="text-sm font-medium">{initial.scope.title}</p>
      <p className="text-sm">{initial.scope.object}</p>
      <p className="text-sm">{initial.scope.context}</p>
      <p className="text-sm text-muted-foreground">
        {t("needExpertiseDecision.basis", { date: formatDate(initial.assessedAt) })}
      </p>
      <p className="text-sm">
        {t(
          action === "decide"
            ? "needExpertiseDecision.confirmEffect"
            : "needExpertiseDecision.withdrawEffect",
        )}
      </p>
      <SourceReference source={initial.basis.source} />
      {!current.canConfirmExpertise && (
        <p role="status" className="text-sm">
          {t("needExpertiseDecision.positiveUnavailable")}
        </p>
      )}
      {changed && (
        <p role="alert" className="text-sm text-destructive">
          {t("needExpertiseDecision.conflict")}
        </p>
      )}
      <fieldset className="space-y-4" disabled={pending || frozen || changed}>
        <legend className="sr-only">{t(`needExpertiseDecision.${action}`)}</legend>
        {action === "decide" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="need-expertise-position">{t("needExpertiseDecision.choose")}</Label>
              <select
                id="need-expertise-position"
                className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...form.register("position")}
              >
                <option value="">{t("capacity.select")}</option>
                {needExpertisePositionSchema.options.map((position) => (
                  <option
                    key={position}
                    value={position}
                    disabled={
                      position === "expertise_confirmed_within_scope" &&
                      !current.canConfirmExpertise
                    }
                  >
                    {t(`needExpertiseDecision.position.${position}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="need-expertise-scope">
                {t("needExpertiseDecision.reviewedScope")}
              </Label>
              <textarea
                id="need-expertise-scope"
                rows={3}
                maxLength={500}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                aria-describedby="need-expertise-scope-help"
                {...form.register("reviewedScope")}
              />
              <p id="need-expertise-scope-help" className="text-sm text-muted-foreground">
                {t("needExpertiseDecision.scopeHelp")}
              </p>
            </div>
            {(["limitations", "nextStep"] as const).map((field) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={"need-expertise-" + field}>
                  {t("needExpertiseDecision." + field)}
                </Label>
                <textarea
                  id={"need-expertise-" + field}
                  rows={3}
                  maxLength={1000}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...form.register(field)}
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="need-expertise-until">{t("needExpertiseDecision.validUntil")}</Label>
              <Input
                id="need-expertise-until"
                type="datetime-local"
                required
                aria-describedby="need-expertise-time-help"
                {...form.register("validUntil")}
              />
              <p id="need-expertise-time-help" className="text-sm text-muted-foreground">
                {t("capacity.expiryHelp")}
              </p>
            </div>
          </>
        )}
        <div className="space-y-2">
          <Label htmlFor="need-expertise-reason">{t("needExpertiseDecision.reason")}</Label>
          <textarea
            id="need-expertise-reason"
            rows={3}
            maxLength={1000}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            aria-describedby="need-expertise-reason-help"
            {...form.register("reason")}
          />
          <p id="need-expertise-reason-help" className="text-sm text-muted-foreground">
            {t("needExpertiseDecision.reasonHelp")}
          </p>
        </div>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input type="checkbox" {...form.register("confirmed")} />
          {t(
            action === "decide"
              ? "needExpertiseDecision.confirm"
              : "needExpertiseDecision.confirmWithdraw",
          )}
        </label>
      </fieldset>
      {Object.keys(form.formState.errors).length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {t("needExpertiseDecision.invalid")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" disabled={pending} onClick={onBack}>
          {t("capacity.back")}
        </Button>
        <Button
          type="submit"
          disabled={pending || blocked || (changed && !retryState.current.command)}
        >
          {t(pending ? "loading" : frozen ? "retry" : `needExpertiseDecision.${action}`)}
        </Button>
      </div>
    </form>
  );
}

export function NeedExpertisePanel({
  leadId,
  onBusy,
  onDossier,
}: {
  onDossier: (value: NeedExpertiseDossier) => void;
  leadId: string;
  onBusy: (value: boolean) => void;
}) {
  const { t } = useTranslation(),
    session = usePartner(),
    client = useQueryClient();
  // A failed background read masks the form but must not discard an uncertain command.
  const retryState = useRef<DecisionAttempt>({ command: null, blocked: false });
  const [view, setView] = useState<"current" | "history" | "sources">("current"),
    [before, setBefore] = useState<number>(),
    [selected, setSelected] = useState<number>(),
    [editing, setEditing] = useState<{
      initial: NeedExpertiseDossier;
      action: NeedExpertiseInput["action"];
    } | null>(null),
    [saved, setSaved] = useState(false),
    [returning, setReturning] = useState(false);
  const key = [...session.queryKey, "need-expertise", leadId];
  const query = useQuery({
    queryKey: [...key, before],
    queryFn: ({ signal }) => partnerApi.needExpertise(leadId, before, signal),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 10000,
    retry: false,
  });
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!query.isPending && !query.isError) heading.current?.focus();
  }, [editing, view, selected, before, query.isPending, query.isError]);
  const reload = () => {
    setReturning(true);
    void query.refetch().finally(() => setReturning(false));
  };
  if (query.isPending || returning) return <LoadingState label={t("loading")} />;
  if (query.isError)
    return (
      <ErrorState
        title={t("error")}
        description={t("needExpertiseDecision.error")}
        retryLabel={t("retry")}
        pendingLabel={t("loading")}
        onRetry={() => void query.refetch()}
      />
    );
  const value = query.data,
    record = value.history.find((item) => item.revision === selected);
  if (view === "sources")
    return (
      <section className="space-y-4">
        <h3 ref={heading} tabIndex={-1} className="font-medium">
          {t("needExpertise.evidence")}
        </h3>
        <Button
          variant="outline"
          onClick={() => {
            setView("current");
            reload();
          }}
        >
          {t("capacity.back")}
        </Button>
        <NeedExpertiseEvidenceDetails
          value={{
            ...value,
            version: 1,
            scope: value.scope,
            scopeRevision: value.basis.scopeRevision,
            assessment: "human_review_required",
          }}
          onDossier={() => onDossier(value)}
        />
      </section>
    );
  if (editing)
    return (
      <DecisionForm
        initial={editing.initial}
        current={value}
        action={editing.action}
        retryState={retryState}
        onBusy={onBusy}
        onBack={() => {
          setEditing(null);
          reload();
        }}
        onSaved={(result) => {
          client.setQueryData([...key, undefined], result);
          setBefore(undefined);
          setEditing(null);
          setSaved(true);
          void client.invalidateQueries({ queryKey: session.queryKey });
        }}
      />
    );
  return (
    <section className="space-y-4 text-sm">
      <h3 ref={heading} tabIndex={-1} className="font-medium">
        {t("needExpertiseDecision.title")}
      </h3>
      <p>{t("needExpertiseDecision.audience")}</p>
      <p>{t("needExpertiseDecision.limits")}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          onClick={() => {
            setView(view === "history" ? "current" : "history");
            setSelected(undefined);
            setBefore(undefined);
          }}
        >
          {t(view === "history" ? "capacity.back" : "capacity.history")}
        </Button>
        <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>
          {t(query.isFetching ? "loading" : "capacity.refresh")}
        </Button>
      </div>
      {view === "history" ? (
        <>
          <p className="text-muted-foreground">{t("needExpertiseDecision.historical")}</p>
          {record ? (
            <div className="space-y-3">
              <Button variant="outline" onClick={() => setSelected(undefined)}>
                {t("capacity.back")}
              </Button>
              <p className="font-medium">{record.scope.title}</p>
              <p>{record.scope.object}</p>
              <p>
                {t("capacity.record", {
                  revision: record.revision,
                  date: formatDate(record.recordedAt),
                })}
              </p>
              <p>
                {record.position
                  ? t(`needExpertiseDecision.position.${record.position}`)
                  : t("needExpertiseDecision.withdraw")}
              </p>
              {record.reviewedScope && (
                <p className="whitespace-pre-wrap break-words">
                  {t("needExpertiseDecision.scopeValue", { value: record.reviewedScope })}
                </p>
              )}
              <SourceReference source={record.basis.source} />
              <ReviewDetails record={record} />
              <p className="whitespace-pre-wrap break-words">{record.reason}</p>
              {record.validUntil && (
                <p>{t("capacity.until", { date: formatDate(record.validUntil) })}</p>
              )}
            </div>
          ) : (
            <>
              {value.history.length === 0 && <p>{t("needExpertiseDecision.noHistory")}</p>}
              {value.history.map((item) => (
                <Button
                  key={item.revision}
                  variant="outline"
                  className="h-auto w-full justify-start whitespace-normal text-left"
                  onClick={() => setSelected(item.revision)}
                >
                  {t("capacity.record", {
                    revision: item.revision,
                    date: formatDate(item.recordedAt),
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
                  <Button variant="outline" onClick={() => setBefore(value.nextBeforeRevision!)}>
                    {t("capacity.older")}
                  </Button>
                )}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {saved && <p role="status">{t("needExpertiseDecision.saved")}</p>}
          <p className="font-medium">{value.scope.title}</p>
          <SourceReference source={value.basis.source} />
          <Button variant="outline" onClick={() => setView("sources")}>
            {t("needExpertiseDecision.sources")}
          </Button>
          <p>{t(`needExpertiseDecision.status.${value.status}`)}</p>
          {value.effectivePosition && (
            <p className="font-medium">
              {t(`needExpertiseDecision.position.${value.effectivePosition}`)}
            </p>
          )}
          {value.current && (
            <p>
              {t("capacity.record", {
                revision: value.current.revision,
                date: formatDate(value.current.recordedAt),
              })}
            </p>
          )}
          {value.current?.validUntil && (
            <p>{t("capacity.until", { date: formatDate(value.current.validUntil) })}</p>
          )}
          {value.current && (
            <div className="space-y-2">
              {value.status !== "recorded" && <p>{t("needExpertiseDecision.historical")}</p>}
              {value.current.reviewedScope && (
                <p className="whitespace-pre-wrap break-words">
                  {t("needExpertiseDecision.scopeValue", { value: value.current.reviewedScope })}
                </p>
              )}
              <SourceReference source={value.current.basis.source} />
              <ReviewDetails record={value.current} />
              <p className="whitespace-pre-wrap break-words">{value.current.reason}</p>
            </div>
          )}
          {!value.canConfirmExpertise && (
            <p role="status">{t("advisorAssessment.changeRequested")}</p>
          )}
          <p className="text-muted-foreground">
            {t("needExpertiseDecision.basis", { date: formatDate(value.assessedAt) })}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => {
                retryState.current = { command: null, blocked: false };
                setSaved(false);
                setEditing({ initial: value, action: "decide" });
              }}
            >
              {t("needExpertiseDecision.decide")}
            </Button>
            {value.canWithdraw && (
              <Button
                variant="outline"
                onClick={() => {
                  retryState.current = { command: null, blocked: false };
                  setSaved(false);
                  setEditing({ initial: value, action: "withdraw" });
                }}
              >
                {t("needExpertiseDecision.withdraw")}
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function SourceReference({ source }: { source: NeedExpertiseDossier["basis"]["source"] }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1 break-words text-xs text-muted-foreground">
      {source ? (
        <>
          <p>
            {t("needExpertiseDecision.reference", {
              declaration: source.declarationId,
              decision: source.decisionId,
              revision: source.decisionRevision,
            })}
          </p>
          <p>
            {t("needExpertiseDecision.sourceVersions", {
              current: source.documentRevision,
              reviewed: source.reviewedDocumentRevision ?? t("advisorAssessment.unspecified"),
            })}
          </p>
          <p>{t("needExpertise.sourceStatus." + source.sourceStatus)}</p>
          <p>{t("competence.status." + source.summaryStatus)}</p>
          {source.validUntil && (
            <p>{t("needExpertiseDecision.sourceUntil", { date: formatDate(source.validUntil) })}</p>
          )}
        </>
      ) : (
        <p>{t("needExpertise.missing")}</p>
      )}
    </div>
  );
}
function ReviewDetails({ record }: { record: NonNullable<NeedExpertiseDossier["current"]> }) {
  const { t } = useTranslation();
  return (
    <>
      {(["limitations", "nextStep"] as const).map(
        (field) =>
          record[field] && (
            <div key={field}>
              <h4 className="font-medium">{t("needExpertiseDecision." + field)}</h4>
              <p className="whitespace-pre-wrap break-words">{record[field]}</p>
            </div>
          ),
      )}
    </>
  );
}
