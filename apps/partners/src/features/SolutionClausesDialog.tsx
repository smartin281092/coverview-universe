import { useEffect, useRef, useState, type RefObject } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  conventionClauseFields,
  solutionClausesInputSchema,
  type SolutionClausesInput,
  type SolutionClausesDossier,
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

type Attempt = { command: { input: SolutionClausesInput; key: string } | null; blocked: boolean };
type Editing = { initial: SolutionClausesDossier; action: SolutionClausesInput["action"] };
const passageSchema = z
  .object({
    page: z.string(),
    locator: z.string().trim().max(200),
    quote: z.string().trim().max(1000),
  })
  .refine((v) =>
    v.quote
      ? v.quote.length >= 2 && v.locator.length >= 2 && /^[1-9]\d{0,3}$/u.test(v.page)
      : !v.locator && !v.page,
  );
const formSchema = z.object({
  clauses: z.object({
    parties: passageSchema,
    distribution: passageSchema,
    product: passageSchema,
    limitations: passageSchema,
    exclusions: passageSchema,
    dates: passageSchema,
  }),
  reason: solutionClausesInputSchema.shape.reason,
  validUntil: z.string(),
  confirmed: z.boolean().refine(Boolean),
  originalChecked: z.boolean(),
});
function Source({ value }: { value: SolutionClausesDossier }) {
  const { t } = useTranslation();
  const ref = value.conventionReference;
  return (
    <section className="space-y-2 text-sm">
      <p className="font-medium">{t(`convention.companies.${value.companyId}`)}</p>
      <p>
        {t("solutionClauses.references", {
          binding: value.binding.revision,
          convention: ref?.revision ?? 0,
          document: ref?.documentRevision ?? 0,
        })}
      </p>
      <p>{t(`needExpertise.sourceStatus.${value.convention.sourceStatus}`)}</p>
      {ref && value.convention.sourceStatus === "available" && (
        <Button asChild variant="outline">
          <a
            target="_blank"
            rel="noopener noreferrer"
            href={partnerApi.conventionSourceUrl(
              value.advisorId,
              value.scope.category,
              value.companyId,
              ref.decisionId,
            )}
          >
            {t("solutionClauses.original")}
          </a>
        </Button>
      )}
    </section>
  );
}
function ClausesForm({
  editing,
  current,
  attempt,
  onSaved,
  onBack,
  onBusy,
}: {
  editing: Editing;
  current: SolutionClausesDossier;
  attempt: RefObject<Attempt>;
  onSaved: (value: SolutionClausesDossier) => void;
  onBack: () => void;
  onBusy: (value: boolean) => void;
}) {
  const { t } = useTranslation(),
    { identity } = usePartner();
  const { initial, action } = editing,
    prior = attempt.current.command?.input;
  const [step, setStep] = useState(action === "withdraw" || prior ? 6 : 0);
  const [error, setError] = useState(
    attempt.current.blocked ? "conflict" : prior ? "retryExact" : "",
  );
  const [frozen, setFrozen] = useState(!!prior);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [step]);
  const passage = (name: (typeof conventionClauseFields)[number]) => ({
    page: prior?.clauses?.[name] ? String(prior.clauses[name].page) : "",
    locator: prior?.clauses?.[name]?.locator ?? "",
    quote: prior?.clauses?.[name]?.quote ?? "",
  });
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clauses: {
        parties: passage("parties"),
        distribution: passage("distribution"),
        product: passage("product"),
        limitations: passage("limitations"),
        exclusions: passage("exclusions"),
        dates: passage("dates"),
      },
      reason: prior?.reason ?? "",
      validUntil: prior?.validUntil ? localDateTime(prior.validUntil) : "",
      confirmed: !!prior,
      originalChecked: prior?.originalChecked ?? false,
    },
  });
  const pending = form.formState.isSubmitting;
  const changed =
    current.scopeFingerprint !== initial.scopeFingerprint ||
    current.revision !== initial.revision ||
    (action === "record" ? !current.canRecord : !current.canWithdraw);
  const field = conventionClauseFields[step];
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || attempt.current.blocked || (changed && !attempt.current.command)) return;
        if (field) {
          void form.trigger(`clauses.${field}`).then((valid) => {
            if (valid) setStep(step + 1);
          });
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
              const input = solutionClausesInputSchema.parse({
                revision: initial.revision,
                scopeFingerprint: initial.scopeFingerprint,
                action,
                clauses:
                  action === "record"
                    ? Object.fromEntries(
                        conventionClauseFields.map((name) => [
                          name,
                          values.clauses[name].quote
                            ? {
                                page: Number(values.clauses[name].page),
                                locator: values.clauses[name].locator,
                                quote: values.clauses[name].quote,
                              }
                            : null,
                        ]),
                      )
                    : null,
                reason: values.reason,
                validUntil: until,
                confirmed: values.confirmed,
                originalChecked: action === "record" && values.originalChecked,
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
              await partnerApi.recordSolutionClauses(
                initial.leadId,
                initial.offer.id,
                initial.companyId,
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
        {t(field ? "solutionClauses.step" : `solutionClauses.${action}`, {
          step: step + 1,
          total: 7,
        })}
      </h3>
      <p className="break-words text-sm">
        {t("solutionEvidence.version", {
          company: initial.offer.company,
          product: initial.offer.product,
          version: initial.offer.version,
        })}
      </p>
      <p className="text-sm">{initial.scope.title}</p>
      {!changed && <Source value={current} />}
      {changed && (
        <p role="alert" className="text-sm text-destructive">
          {t("solutionBinding.conflict")}
        </p>
      )}
      <fieldset disabled={pending || frozen || changed} className="space-y-4">
        <legend className="sr-only">{t(`solutionClauses.${action}`)}</legend>
        {field ? (
          <div key={field} className="space-y-3">
            <h4 className="font-medium">{t(`solutionClauses.field.${field}`)}</h4>
            <p className="text-sm text-muted-foreground">
              {t("solutionClauses.transcriptionHelp")}
            </p>
            <Label htmlFor="clause-quote">{t("solutionClauses.quote")}</Label>
            <textarea
              id="clause-quote"
              rows={5}
              maxLength={1000}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...form.register(`clauses.${field}.quote`)}
            />
            <Label htmlFor="clause-page">{t("solutionBinding.page")}</Label>
            <Input
              id="clause-page"
              type="number"
              min={1}
              max={9999}
              {...form.register(`clauses.${field}.page`)}
            />
            <Label htmlFor="clause-locator">{t("solutionClauses.locator")}</Label>
            <Input
              id="clause-locator"
              maxLength={200}
              {...form.register(`clauses.${field}.locator`)}
            />
          </div>
        ) : (
          <>
            <p className="text-sm">
              {t(action === "record" ? "solutionClauses.limits" : "solutionClauses.withdrawEffect")}
            </p>
            {action === "record" && (
              <>
                <ul className="space-y-2 text-sm">
                  {conventionClauseFields.map((name) => (
                    <li key={name}>
                      {t("solutionClauses.summary", {
                        field: t(`solutionClauses.field.${name}`),
                        state: t(
                          form.getValues(`clauses.${name}.quote`)
                            ? "solutionClauses.transcribed"
                            : "solutionBinding.unknown",
                        ),
                      })}
                    </li>
                  ))}
                </ul>
                <Label htmlFor="clauses-until">{t("capacity.validUntil")}</Label>
                <Input id="clauses-until" type="datetime-local" {...form.register("validUntil")} />
                {initial.maxValidUntil && (
                  <p className="text-sm">
                    {t("solutionClauses.maxUntil", { date: formatDate(initial.maxValidUntil) })}
                  </p>
                )}
                <label className="flex min-h-11 items-start gap-3 text-sm">
                  <input type="checkbox" {...form.register("originalChecked")} />
                  {t("solutionClauses.originalChecked")}
                </label>
              </>
            )}
            <Label htmlFor="clauses-reason">{t("solutionClauses.reason")}</Label>
            <textarea
              id="clauses-reason"
              rows={3}
              maxLength={1000}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...form.register("reason")}
            />
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input type="checkbox" {...form.register("confirmed")} />
              {t(
                action === "record" ? "solutionClauses.confirm" : "solutionBinding.confirmWithdraw",
              )}
            </label>
          </>
        )}
      </fieldset>
      {Object.keys(form.formState.errors).length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {t("solutionClauses.invalid")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(error === "invalid" ? "solutionClauses.invalid" : `solutionBinding.${error}`)}
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
                : field
                  ? "solutionBinding.next"
                  : `solutionClauses.${action}`,
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
  value: NonNullable<SolutionClausesDossier["current"]>;
  historical: boolean;
}) {
  const { t } = useTranslation();
  const [field, setField] = useState<(typeof conventionClauseFields)[number]>("parties");
  const clause = value.clauses?.[field];
  return (
    <section className="space-y-3 text-sm">
      {historical && <p>{t("solutionBinding.historical")}</p>}
      <p>
        {t("capacity.record", { revision: value.revision, date: formatDate(value.recordedAt) })}
      </p>
      <p>
        {t("solutionClauses.references", {
          binding: value.bindingRevision,
          convention: value.conventionReference?.revision ?? 0,
          document: value.conventionReference?.documentRevision ?? 0,
        })}
      </p>
      <p className="font-medium">{value.scope.title}</p>
      <p>{t(`solutionClauses.${value.action}`)}</p>
      {value.action === "record" &&
        (!value.clausesAvailable ? (
          <p role="status">{t("solutionClauses.unavailablePassages")}</p>
        ) : (
          <>
            <Label htmlFor="clause-aspect">{t("solutionClauses.aspect")}</Label>
            <select
              id="clause-aspect"
              className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={field}
              onChange={(event) =>
                setField(z.enum(conventionClauseFields).parse(event.target.value))
              }
            >
              {conventionClauseFields.map((name) => (
                <option key={name} value={name}>
                  {t(`solutionClauses.field.${name}`)}
                </option>
              ))}
            </select>
            <p>{t("solutionClauses.transcriptionLabel")}</p>
            <p className="whitespace-pre-wrap break-words">
              {clause?.quote ?? t("solutionBinding.unknown")}
            </p>
            {clause && (
              <p>{t("solutionClauses.location", { page: clause.page, locator: clause.locator })}</p>
            )}
          </>
        ))}
      <p className="whitespace-pre-wrap break-words">{value.reason}</p>
      {value.validUntil && <p>{t("capacity.until", { date: formatDate(value.validUntil) })}</p>}
    </section>
  );
}

export function SolutionClausesDialog({
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
    [saved, setSaved] = useState(false);
  const queryKey = [...session.queryKey, "solution-clauses", leadId, offerId, companyId];
  const query = useQuery({
    queryKey: [...queryKey, before],
    queryFn: ({ signal }) => partnerApi.solutionClauses(leadId, offerId, companyId, before, signal),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 10000,
    retry: false,
  });
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!query.isPending && !query.isError && !editing) heading.current?.focus();
  }, [history, selected, editing, returning, query.isPending, query.isError]);
  const reload = () => {
    setReturning(true);
    void query.refetch().finally(() => setReturning(false));
  };
  const back = () => {
    if (editing) {
      setEditing(null);
      attempt.current = { command: null, blocked: false };
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
          <DialogTitle>{t("solutionClauses.title")}</DialogTitle>
          <DialogDescription>{t("solutionClauses.privacy")}</DialogDescription>
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
            description={t("solutionClauses.error")}
            retryLabel={t("retry")}
            pendingLabel={t("loading")}
            onRetry={reload}
          />
        ) : (
          value &&
          (editing ? (
            <ClausesForm
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
                {t(history ? "capacity.history" : "solutionClauses.current")}
              </h3>
              <p>{t("solutionClauses.limits")}</p>
              <p className="text-muted-foreground">
                {t("advisorAssessment.at", { date: formatDate(value.assessedAt) })}
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
                  {saved && <p role="status">{t("solutionClauses.saved")}</p>}
                  <p className="font-medium break-words">
                    {t("solutionEvidence.version", {
                      company: value.offer.company,
                      product: value.offer.product,
                      version: value.offer.version,
                    })}
                  </p>
                  <p>{value.scope.title}</p>
                  <p>{t(`solutionBinding.status.${value.status}`)}</p>
                  {!value.canRecord && <p role="status">{t("solutionClauses.unavailable")}</p>}
                  {value.changeRequested && (
                    <p role="status">{t("advisorAssessment.changeRequested")}</p>
                  )}
                  <Source value={value} />
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
                      {t("solutionClauses.record")}
                    </Button>
                    {value.canWithdraw && (
                      <Button
                        variant="outline"
                        onClick={() => setEditing({ initial: value, action: "withdraw" })}
                      >
                        {t("solutionClauses.withdraw")}
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
