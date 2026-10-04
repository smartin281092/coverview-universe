import { useEffect, useRef, useState, type RefObject } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { insuranceCompanyIdSchema } from "@coverview/contracts";
import {
  solutionBindingFields,
  solutionBindingInputSchema,
  type SolutionBindingInput,
  type SolutionBindingDossier,
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

type Attempt = { command: { input: SolutionBindingInput; key: string } | null; blocked: boolean };
type Editing = { initial: SolutionBindingDossier; action: SolutionBindingInput["action"] };
const mentionFormSchema = z
  .object({ page: z.string(), quote: z.string().trim().max(500) })
  .refine(
    (value) =>
      !value.quote ||
      (value.quote.length >= 2 && /^[1-9]\d?$/u.test(value.page) && Number(value.page) <= 20),
  );
const formSchema = z.object({
  companyId: insuranceCompanyIdSchema.or(z.literal("")),
  mentions: z.object({
    company: mentionFormSchema,
    legalParty: mentionFormSchema,
    product: mentionFormSchema,
    variant: mentionFormSchema,
    productVersion: mentionFormSchema,
  }),
  reason: solutionBindingInputSchema.shape.reason,
  validUntil: z.string(),
  confirmed: z.boolean().refine(Boolean),
});
function expiry(value: string) {
  const at = zurichInstant(value);
  if (
    [-3600000, 3600000].some(
      (delta) => localDateTime(new Date(Date.parse(at) + delta).toISOString()) === value,
    )
  )
    throw new Error("Ambiguous local time");
  return at;
}
function SourceText({ value, onBack }: { value: SolutionBindingDossier; onBack: () => void }) {
  const { t } = useTranslation(),
    session = usePartner();
  const [page, setPage] = useState(value.sourcePages[0] ?? 1);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const query = useQuery({
    queryKey: [...session.queryKey, "solution-binding-source", value.leadId, value.offer.id, page],
    queryFn: ({ signal }) =>
      partnerApi.solutionBinding(value.leadId, value.offer.id, undefined, signal, page),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 10000,
    retry: false,
  });
  const excerpt =
    !query.isError && !query.isFetching && query.data?.scopeFingerprint === value.scopeFingerprint
      ? query.data.sourcePage
      : null;
  return (
    <section className="space-y-3">
      <h3 ref={heading} tabIndex={-1} className="font-medium">
        {t("solutionBinding.readText")}
      </h3>
      <Button type="button" variant="outline" onClick={onBack}>
        {t("capacity.back")}
      </Button>
      <>
        <p className="text-sm text-muted-foreground">{t("solutionBinding.textHelp")}</p>
        <Label htmlFor="solution-source-page">{t("solutionBinding.page")}</Label>
        <select
          id="solution-source-page"
          value={page}
          onChange={(event) => setPage(Number(event.target.value))}
          className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {value.sourcePages.map((number) => (
            <option key={number} value={number}>
              {t("solutionBinding.pageValue", { page: number })}
            </option>
          ))}
        </select>
        {query.isPending || query.isFetching ? (
          <LoadingState label={t("loading")} />
        ) : query.isError ? (
          <ErrorState
            title={t("error")}
            description={t("solutionBinding.error")}
            retryLabel={t("retry")}
            pendingLabel={t("loading")}
            onRetry={() => {
              void query.refetch();
            }}
          />
        ) : excerpt ? (
          <p
            tabIndex={0}
            className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-sm"
            aria-label={t("solutionBinding.pageValue", { page: excerpt.page })}
          >
            {excerpt.text}
          </p>
        ) : (
          <p role="status">{t("solutionBinding.mentionsUnavailable")}</p>
        )}
      </>
    </section>
  );
}
function BindingForm({
  editing,
  current,
  attempt,
  onSaved,
  onBack,
  onBusy,
}: {
  editing: Editing;
  current: SolutionBindingDossier;
  attempt: RefObject<Attempt>;
  onSaved: (value: SolutionBindingDossier) => void;
  onBack: () => void;
  onBusy: (value: boolean) => void;
}) {
  const { t } = useTranslation(),
    { identity } = usePartner();
  const { initial, action } = editing,
    prior = attempt.current.command?.input;
  const [step, setStep] = useState(action === "withdraw" || prior ? 5 : 0);
  const [error, setError] = useState(
    attempt.current.blocked ? "conflict" : prior ? "retryExact" : "",
  );
  const [frozen, setFrozen] = useState(!!prior);
  const [reading, setReading] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [step, reading]);
  const mention = (field: (typeof solutionBindingFields)[number]) => ({
    page: prior?.mentions?.[field] ? String(prior.mentions[field].page) : "",
    quote: prior?.mentions?.[field]?.quote ?? "",
  });
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyId: prior?.companyId ?? ("" as const),
      mentions: {
        company: mention("company"),
        legalParty: mention("legalParty"),
        product: mention("product"),
        variant: mention("variant"),
        productVersion: mention("productVersion"),
      },
      reason: prior?.reason ?? "",
      validUntil: prior?.validUntil ? localDateTime(prior.validUntil) : "",
      confirmed: !!prior,
    },
  });
  const pending = form.formState.isSubmitting;
  const changed =
    current.scopeFingerprint !== initial.scopeFingerprint ||
    current.revision !== initial.revision ||
    (action === "record" ? !current.canRecord : !current.canWithdraw);
  const field = solutionBindingFields[step];
  const back = () => {
    if (step > 0 && !frozen && action === "record") setStep(step - 1);
    else onBack();
  };
  if (reading) return <SourceText value={initial} onBack={() => setReading(false)} />;
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || attempt.current.blocked || (changed && !attempt.current.command)) return;
        if (field) {
          void form.trigger(`mentions.${field}`).then((valid) => {
            if (valid) setStep(step + 1);
          });
          return;
        }
        void form.handleSubmit(async (values) => {
          if (!attempt.current.command) {
            try {
              const input = solutionBindingInputSchema.parse({
                revision: initial.revision,
                scopeFingerprint: initial.scopeFingerprint,
                action,
                companyId: action === "record" && values.companyId ? values.companyId : null,
                mentions:
                  action === "record"
                    ? Object.fromEntries(
                        solutionBindingFields.map((name) => [
                          name,
                          values.mentions[name].quote
                            ? {
                                page: Number(values.mentions[name].page),
                                quote: values.mentions[name].quote,
                              }
                            : null,
                        ]),
                      )
                    : null,
                reason: values.reason,
                validUntil: action === "record" ? expiry(values.validUntil) : null,
                confirmed: values.confirmed,
              });
              if (input.validUntil && Date.parse(input.validUntil) <= Date.now())
                throw new Error("Past expiry");
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
              await partnerApi.recordSolutionBinding(
                initial.leadId,
                initial.offer.id,
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
        {t(field ? "solutionBinding.step" : `solutionBinding.${action}`, {
          step: step + 1,
          total: 6,
        })}
      </h3>
      <p className="text-sm font-medium break-words">
        {t("solutionEvidence.version", {
          company: initial.offer.company,
          product: initial.offer.product,
          version: initial.offer.version,
        })}
      </p>
      <p className="text-sm">{initial.scope.title}</p>
      {current.offer.canDownload && (
        <Button asChild variant="outline">
          <a href={partnerApi.sourceUrl(initial.leadId, initial.offer.id)}>{t("offer.source")}</a>
        </Button>
      )}
      {changed && (
        <p role="alert" className="text-sm text-destructive">
          {t("solutionBinding.conflict")}
        </p>
      )}
      <fieldset disabled={pending || frozen || changed} className="space-y-4">
        <legend className="sr-only">{t(`solutionBinding.${action}`)}</legend>
        {field ? (
          <div key={field} className="space-y-4">
            <h4 className="font-medium">{t(`solutionBinding.field.${field}`)}</h4>
            <p className="text-sm text-muted-foreground">{t("solutionBinding.mentionHelp")}</p>
            <Button type="button" variant="outline" onClick={() => setReading(true)}>
              {t("solutionBinding.readText")}
            </Button>
            <Label htmlFor="solution-quote">{t("solutionBinding.quote")}</Label>
            <textarea
              id="solution-quote"
              rows={5}
              maxLength={500}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...form.register(`mentions.${field}.quote`)}
            />
            <Label htmlFor="solution-page">{t("solutionBinding.page")}</Label>
            <Input
              id="solution-page"
              type="number"
              min={1}
              max={20}
              {...form.register(`mentions.${field}.page`)}
            />
          </div>
        ) : (
          <>
            {action === "record" && (
              <>
                <p className="text-sm">{t("solutionBinding.confirmEffect")}</p>
                <Label htmlFor="binding-company">{t("solutionBinding.company")}</Label>
                <select
                  id="binding-company"
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  {...form.register("companyId")}
                >
                  <option value="">{t("solutionBinding.unknown")}</option>
                  {insuranceCompanyIdSchema.options.map((id) => (
                    <option key={id} value={id}>
                      {t(`convention.companies.${id}`)}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-muted-foreground">{t("solutionBinding.companyHelp")}</p>
                <Label htmlFor="binding-until">{t("capacity.validUntil")}</Label>
                <Input id="binding-until" type="datetime-local" {...form.register("validUntil")} />
                <p className="text-sm text-muted-foreground">{t("solutionBinding.expiryHelp")}</p>
                <div className="space-y-2 text-sm">
                  {solutionBindingFields.map((name) => (
                    <div key={name} className="break-words">
                      <h4 className="font-medium">{t(`solutionBinding.field.${name}`)}</h4>
                      <p>
                        {form.getValues(`mentions.${name}.quote`) || t("solutionBinding.unknown")}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
            {action === "withdraw" && (
              <p className="text-sm">{t("solutionBinding.withdrawEffect")}</p>
            )}
            <Label htmlFor="binding-reason">{t("solutionBinding.reason")}</Label>
            <textarea
              id="binding-reason"
              rows={3}
              maxLength={1000}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...form.register("reason")}
            />
            <p className="text-sm text-muted-foreground">{t("solutionBinding.reasonHelp")}</p>
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input type="checkbox" {...form.register("confirmed")} />
              {t(
                action === "record" ? "solutionBinding.confirm" : "solutionBinding.confirmWithdraw",
              )}
            </label>
          </>
        )}
      </fieldset>
      {Object.keys(form.formState.errors).length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {t("solutionBinding.invalid")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(`solutionBinding.${error}`)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" disabled={pending} onClick={back}>
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
                  : `solutionBinding.${action}`,
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
  value: NonNullable<SolutionBindingDossier["current"]>;
  historical: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section className="space-y-3 text-sm">
      {historical && <p>{t("solutionBinding.historical")}</p>}
      <p>
        {t("capacity.record", { revision: value.revision, date: formatDate(value.recordedAt) })}
      </p>
      <p className="font-medium">{value.scope.title}</p>
      <p>{t(`solutionBinding.${value.action}`)}</p>
      <p>
        {value.companyId
          ? t("solutionBinding.directoryValue", {
              company: t(`convention.companies.${value.companyId}`),
            })
          : t("solutionBinding.noDirectory")}
      </p>
      {value.action === "record" &&
        (!value.mentionsAvailable ? (
          <p role="status">{t("solutionBinding.mentionsUnavailable")}</p>
        ) : (
          solutionBindingFields.map((field) => (
            <div key={field}>
              <h4 className="font-medium">{t(`solutionBinding.field.${field}`)}</h4>
              <p className="whitespace-pre-wrap break-words">
                {value.mentions?.[field]?.quote ?? t("solutionBinding.unknown")}
              </p>
              {value.mentions?.[field] && (
                <p className="text-muted-foreground">
                  {t("solutionBinding.pageValue", { page: value.mentions[field].page })}
                </p>
              )}
            </div>
          ))
        ))}
      <p className="whitespace-pre-wrap break-words">{value.reason}</p>
      {value.validUntil && <p>{t("capacity.until", { date: formatDate(value.validUntil) })}</p>}
    </section>
  );
}

export function SolutionBindingDialog({
  leadId,
  offerId,
  onClose,
}: {
  leadId: string;
  offerId: string;
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
  const queryKey = [...session.queryKey, "solution-binding", leadId, offerId];
  const query = useQuery({
    queryKey: [...queryKey, before],
    queryFn: ({ signal }) => partnerApi.solutionBinding(leadId, offerId, before, signal),
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
  const leaveView = () => {
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
  const value = query.isError ? undefined : query.data;
  const record = value?.history.find((entry) => entry.revision === selected);
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
          <DialogTitle>{t("solutionBinding.title")}</DialogTitle>
          <DialogDescription>{t("solutionBinding.privacy")}</DialogDescription>
        </DialogHeader>
        {!editing && (
          <Button variant="outline" disabled={busy} onClick={leaveView}>
            {t("capacity.back")}
          </Button>
        )}
        {query.isPending || returning ? (
          <LoadingState label={t("loading")} />
        ) : query.isError ? (
          <ErrorState
            title={t("error")}
            description={t("solutionBinding.error")}
            retryLabel={t("retry")}
            pendingLabel={t("loading")}
            onRetry={reload}
          />
        ) : (
          value &&
          (editing ? (
            <BindingForm
              editing={editing}
              current={value}
              attempt={attempt}
              onBack={leaveView}
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
                {t(history ? "capacity.history" : "solutionBinding.current")}
              </h3>
              <p>{t("solutionBinding.limits")}</p>
              <p className="text-muted-foreground">
                {t("advisorAssessment.at", { date: formatDate(value.assessedAt) })}
              </p>
              {value.changeRequested && (
                <p role="status">{t("advisorAssessment.changeRequested")}</p>
              )}
              {history ? (
                record ? (
                  <RecordDetails value={record} historical />
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
                  {saved && <p role="status">{t("solutionBinding.saved")}</p>}
                  <p className="font-medium break-words">
                    {t("solutionEvidence.version", {
                      company: value.offer.company,
                      product: value.offer.product,
                      version: value.offer.version,
                    })}
                  </p>
                  <p>{value.scope.title}</p>
                  <p>{t(`solutionBinding.status.${value.status}`)}</p>
                  {!value.canRecord && <p role="status">{t("solutionBinding.unavailable")}</p>}
                  {value.current && (
                    <RecordDetails value={value.current} historical={value.status !== "recorded"} />
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      disabled={!value.canRecord}
                      onClick={() => {
                        setSaved(false);
                        setEditing({ initial: value, action: "record" });
                      }}
                    >
                      {t("solutionBinding.record")}
                    </Button>
                    {value.canWithdraw && (
                      <Button
                        variant="outline"
                        onClick={() => setEditing({ initial: value, action: "withdraw" })}
                      >
                        {t("solutionBinding.withdraw")}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => {
                        setHistory(true);
                        setSelected(undefined);
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
