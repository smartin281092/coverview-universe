import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  needCapacityInputSchema,
  needCapacityPositionSchema,
  type NeedCapacityDossier,
  type NeedCapacityInput,
} from "@coverview/contracts/partner";
import { PartnerApiError } from "@coverview/api-client/partner";
import { Button, Input, Label, LoadingState, ErrorState } from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { formatDate, localDateTime, zurichInstant } from "./Field";
import { AdvisorCapacity } from "./AdvisorCapacity";

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

function DecisionForm({
  initial,
  current,
  action,
  onSaved,
  onBack,
  onBusy,
}: {
  initial: NeedCapacityDossier;
  current: NeedCapacityDossier;
  action: NeedCapacityInput["action"];
  onSaved: (value: NeedCapacityDossier) => void;
  onBack: () => void;
  onBusy: (value: boolean) => void;
}) {
  const { t } = useTranslation(),
    { identity } = usePartner();
  const [error, setError] = useState(""),
    [blocked, setBlocked] = useState(false),
    [frozen, setFrozen] = useState(false);
  const attempt = useRef<{ input: NeedCapacityInput; key: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const schema = z
    .object({
      position: needCapacityPositionSchema.or(z.literal("")),
      reason: needCapacityInputSchema.shape.reason,
      validUntil: z.string(),
      confirmed: z.boolean().refine(Boolean),
    })
    .superRefine((values, context) => {
      if (action === "withdraw" || attempt.current) return;
      try {
        if (!values.position) throw new Error("Missing decision");
        if (Date.parse(expiry(values.validUntil)) <= Date.now()) throw new Error("Past expiry");
      } catch {
        context.addIssue({ code: "custom", message: "PARTNER_ACTION_REQUIRED" });
      }
    });
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { position: "" as const, reason: "", validUntil: "", confirmed: false },
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
        if (pending || blocked || (changed && !attempt.current)) return;
        void form.handleSubmit(async (values) => {
          attempt.current ??= {
            input: needCapacityInputSchema.parse({
              ...values,
              action,
              revision: initial.revision,
              scopeFingerprint: initial.scopeFingerprint,
              position: action === "decide" ? values.position : null,
              validUntil: action === "decide" ? expiry(values.validUntil) : null,
            }),
            key: crypto.randomUUID(),
          };
          setFrozen(true);
          setError("");
          onBusy(true);
          try {
            onSaved(
              await partnerApi.decideNeedCapacity(initial.leadId, attempt.current.input, {
                csrfToken: identity.csrfToken,
                idempotencyKey: attempt.current.key,
              }),
            );
          } catch (cause) {
            const conflict =
              cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
            setBlocked(conflict);
            setError(t(conflict ? "needCapacity.conflict" : "capacity.retryExact"));
          } finally {
            onBusy(false);
          }
        })();
      }}
    >
      <h3 ref={heading} tabIndex={-1} className="font-medium">
        {t(`needCapacity.${action}`)}
      </h3>
      <p className="text-sm font-medium">{initial.scope.title}</p>
      <p className="text-sm">{initial.scope.object}</p>
      <p className="text-sm">{initial.scope.context}</p>
      <p className="text-sm text-muted-foreground">
        {t("needCapacity.basis", { date: formatDate(initial.assessedAt) })}
      </p>
      <p className="text-sm">
        {t(action === "decide" ? "needCapacity.confirmEffect" : "needCapacity.withdrawEffect")}
      </p>
      {!current.canConfirmCapacity && (
        <p role="status" className="text-sm">
          {t("advisorAssessment.changeRequested")}
        </p>
      )}
      {changed && (
        <p role="alert" className="text-sm text-destructive">
          {t("needCapacity.conflict")}
        </p>
      )}
      <fieldset className="space-y-4" disabled={pending || frozen || changed}>
        <legend className="sr-only">{t(`needCapacity.${action}`)}</legend>
        {action === "decide" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="need-capacity-position">{t("needCapacity.choose")}</Label>
              <select
                id="need-capacity-position"
                className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...form.register("position")}
              >
                <option value="">{t("capacity.select")}</option>
                {needCapacityPositionSchema.options.map((position) => (
                  <option
                    key={position}
                    value={position}
                    disabled={position === "capacity_confirmed" && !current.canConfirmCapacity}
                  >
                    {t(`needCapacity.position.${position}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="need-capacity-until">{t("needCapacity.validUntil")}</Label>
              <Input
                id="need-capacity-until"
                type="datetime-local"
                required
                aria-describedby="need-capacity-time-help"
                {...form.register("validUntil")}
              />
              <p id="need-capacity-time-help" className="text-sm text-muted-foreground">
                {t("capacity.expiryHelp")}
              </p>
            </div>
          </>
        )}
        <div className="space-y-2">
          <Label htmlFor="need-capacity-reason">{t("needCapacity.reason")}</Label>
          <textarea
            id="need-capacity-reason"
            rows={3}
            maxLength={1000}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            aria-describedby="need-capacity-reason-help"
            {...form.register("reason")}
          />
          <p id="need-capacity-reason-help" className="text-sm text-muted-foreground">
            {t("needCapacity.reasonHelp")}
          </p>
        </div>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input type="checkbox" {...form.register("confirmed")} />
          {t(action === "decide" ? "needCapacity.confirm" : "needCapacity.confirmWithdraw")}
        </label>
      </fieldset>
      {Object.keys(form.formState.errors).length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {t("needCapacity.invalid")}
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
        <Button type="submit" disabled={pending || blocked || (changed && !attempt.current)}>
          {t(pending ? "loading" : frozen ? "retry" : `needCapacity.${action}`)}
        </Button>
      </div>
    </form>
  );
}

export function NeedCapacityPanel({
  leadId,
  onBusy,
}: {
  leadId: string;
  onBusy: (value: boolean) => void;
}) {
  const { t, i18n } = useTranslation(),
    session = usePartner(),
    client = useQueryClient();
  const [view, setView] = useState<"current" | "sources" | "history">("current"),
    [before, setBefore] = useState<number>(),
    [selected, setSelected] = useState<number>(),
    [editing, setEditing] = useState<{
      initial: NeedCapacityDossier;
      action: NeedCapacityInput["action"];
    } | null>(null),
    [saved, setSaved] = useState(false);
  const key = [...session.queryKey, "need-capacity", leadId];
  const query = useQuery({
    queryKey: [...key, before],
    queryFn: ({ signal }) => partnerApi.needCapacity(leadId, before, signal),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 10000,
    retry: false,
  });
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!query.isPending && !query.isError) heading.current?.focus();
  }, [editing, view, selected, before, query.isPending, query.isError]);
  if (query.isPending) return <LoadingState label={t("loading")} />;
  if (query.isError)
    return (
      <ErrorState
        title={t("error")}
        description={t("needCapacity.error")}
        retryLabel={t("retry")}
        pendingLabel={t("loading")}
        onRetry={() => void query.refetch()}
      />
    );
  const value = query.data,
    record = value.history.find((item) => item.revision === selected);
  if (editing)
    return (
      <DecisionForm
        initial={editing.initial}
        current={value}
        action={editing.action}
        onBusy={onBusy}
        onBack={() => {
          setEditing(null);
          void query.refetch();
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
        {t("needCapacity.title")}
      </h3>
      <p>{t("needCapacity.audience")}</p>
      <p>{t("needCapacity.limits")}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          onClick={() => {
            setView(view === "sources" ? "current" : "sources");
            setSelected(undefined);
            setBefore(undefined);
          }}
        >
          {t(view === "sources" ? "capacity.back" : "advisorAssessment.sources")}
        </Button>
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
      {view === "sources" ? (
        <AdvisorCapacity value={value.assessment} />
      ) : view === "history" ? (
        <>
          <p className="text-muted-foreground">{t("needCapacity.historical")}</p>
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
                  ? t(`needCapacity.position.${record.position}`)
                  : t("needCapacity.withdraw")}
              </p>
              <p className="whitespace-pre-wrap break-words">{record.reason}</p>
              {record.validUntil && (
                <p>{t("capacity.until", { date: formatDate(record.validUntil) })}</p>
              )}
              <p>
                {t("needCapacity.basis", { date: formatDate(record.basis.workload.observedAt) })}
              </p>
              <dl className="space-y-2">
                {(["accepted", "proposed", "contributing"] as const).map((bucket) => (
                  <div key={bucket} className="flex justify-between gap-4">
                    <dt>{t(`capacity.workload.${bucket}`)}</dt>
                    <dd>
                      {new Intl.NumberFormat(i18n.language).format(record.basis.workload[bucket])}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <>
              {value.history.length === 0 && <p>{t("needCapacity.noHistory")}</p>}
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
          {saved && <p role="status">{t("needCapacity.saved")}</p>}
          <p className="font-medium">{value.scope.title}</p>
          <p>{t(`needCapacity.status.${value.status}`)}</p>
          {value.effectivePosition && (
            <p className="font-medium">{t(`needCapacity.position.${value.effectivePosition}`)}</p>
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
            <p className="whitespace-pre-wrap break-words">{value.current.reason}</p>
          )}
          {!value.canConfirmCapacity && (
            <p role="status">{t("advisorAssessment.changeRequested")}</p>
          )}
          <p>{t(`advisorAssessment.continuity.${value.assessment.continuity.status}`)}</p>
          <p className="text-muted-foreground">
            {t("needCapacity.basis", { date: formatDate(value.assessedAt) })}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => {
                setSaved(false);
                setEditing({ initial: value, action: "decide" });
              }}
            >
              {t("needCapacity.decide")}
            </Button>
            {value.canWithdraw && (
              <Button
                variant="outline"
                onClick={() => {
                  setSaved(false);
                  setEditing({ initial: value, action: "withdraw" });
                }}
              >
                {t("needCapacity.withdraw")}
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
