import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  capacityInputSchema,
  capacityPositionSchema,
  type CapacityDossier,
  type CapacityInput,
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
import { usePartner } from "./PartnerSession";
import { partnerApi } from "../api";
import { formatDate, localDateTime, zurichInstant } from "./Field";

function expiry(value: string) {
  const result = zurichInstant(value),
    time = Date.parse(result);
  if (
    [-3600000, 3600000].some(
      (delta) => localDateTime(new Date(time + delta).toISOString()) === value,
    )
  )
    throw new Error("Ambiguous local time");
  return result;
}

function Declaration({
  value,
  historical = false,
}: {
  value: NonNullable<CapacityDossier["current"]>;
  historical?: boolean;
}) {
  const { t, i18n } = useTranslation();
  return (
    <section className="space-y-3 text-sm">
      <h3 className="font-medium">{t(`capacity.action.${value.action}`)}</h3>
      <p>{t(historical ? "capacity.historical" : `capacity.status.${value.status}`)}</p>
      <p>
        {t("capacity.subject", {
          name: value.declaredName,
          organization: value.declaredOrganization,
        })}
      </p>
      <p>
        {t("capacity.categories", {
          values: new Intl.ListFormat(i18n.language).format(
            value.categories.map((category) => t(`category.${category}`)),
          ),
        })}
      </p>
      <p>
        {t("capacity.record", { revision: value.revision, date: formatDate(value.declaredAt) })}
      </p>
      {value.position && <p>{t(`capacity.position.${value.position}`)}</p>}
      {value.validUntil && <p>{t("capacity.until", { date: formatDate(value.validUntil) })}</p>}
      <p className="text-muted-foreground">{t("capacity.audience")}</p>
    </section>
  );
}

function Workload({ value }: { value: CapacityDossier }) {
  const { t } = useTranslation();
  return (
    <section className="space-y-3 rounded-lg border border-border p-4 text-sm">
      <h3 className="font-medium">{t("capacity.workload.title")}</h3>
      <p>{t("capacity.workload.observed", { date: formatDate(value.workload.observedAt) })}</p>
      <dl className="space-y-2">
        {(["accepted", "proposed", "contributing"] as const).map((key) => (
          <div key={key} className="flex justify-between gap-4">
            <dt>{t(`capacity.workload.${key}`)}</dt>
            <dd className="font-medium tabular-nums">{value.workload[key]}</dd>
          </div>
        ))}
      </dl>
      <p className="text-muted-foreground">{t("capacity.workload.definition")}</p>
      <p>{t(value.activeAdvisor ? "capacity.active" : "capacity.inactive")}</p>
    </section>
  );
}

function CapacityForm({
  initial,
  current,
  action,
  onSaved,
  onBack,
  onBusy,
}: {
  initial: CapacityDossier;
  current: CapacityDossier;
  action: CapacityInput["action"];
  onSaved: (value: CapacityDossier) => void;
  onBack: () => void;
  onBusy: (value: boolean) => void;
}) {
  const { t, i18n } = useTranslation(),
    { identity } = usePartner();
  const [error, setError] = useState(""),
    [blocked, setBlocked] = useState(false),
    [frozen, setFrozen] = useState(false);
  const attempt = useRef<{ input: CapacityInput; key: string } | null>(null);
  const schema = z
    .object({
      position: capacityPositionSchema.or(z.literal("")),
      validUntil: z.string(),
      confirmed: z.boolean().refine(Boolean),
    })
    .superRefine((values, context) => {
      if (action === "withdraw") return;
      try {
        if (!values.position) throw new Error("Missing position");
        expiry(values.validUntil);
      } catch {
        context.addIssue({ code: "custom", message: "PARTNER_ACTION_REQUIRED" });
      }
    });
  const applicable = initial.current?.status === "declared" ? initial.current : null;
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      position: action === "declare" ? (applicable?.position ?? ("" as const)) : ("" as const),
      validUntil:
        action === "declare" && applicable?.validUntil ? localDateTime(applicable.validUntil) : "",
      confirmed: false,
    },
  });
  const pending = form.formState.isSubmitting;
  const changed =
    current.professionalRevision !== initial.professionalRevision ||
    (current.current?.revision ?? 0) !== (initial.current?.revision ?? 0) ||
    !(action === "declare" ? current.canDeclare : current.canWithdraw);
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || blocked || (changed && !attempt.current)) return;
        void form.handleSubmit(async (values) => {
          attempt.current ??= {
            input: capacityInputSchema.parse({
              ...values,
              action,
              revision: initial.current?.revision ?? 0,
              professionalRevision: initial.professionalRevision,
              position: action === "declare" ? values.position : null,
              validUntil: action === "declare" ? expiry(values.validUntil) : null,
            }),
            key: crypto.randomUUID(),
          };
          setFrozen(true);
          setError("");
          onBusy(true);
          try {
            onSaved(
              await partnerApi.declareCapacity(initial.userId, attempt.current.input, {
                csrfToken: identity.csrfToken,
                idempotencyKey: attempt.current.key,
              }),
            );
          } catch (cause) {
            const conflict =
              cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
            setBlocked(conflict);
            setError(t(`capacity.${conflict ? "conflict" : "retryExact"}`));
          } finally {
            onBusy(false);
          }
        })();
      }}
    >
      <Workload value={current} />
      <h3 className="font-medium">{t(`capacity.${action}`)}</h3>
      <p className="text-sm">
        {t("capacity.subject", { name: initial.name, organization: initial.organization })}
      </p>
      <p className="text-sm">
        {t("capacity.categories", {
          values: new Intl.ListFormat(i18n.language).format(
            initial.categories.map((category) => t(`category.${category}`)),
          ),
        })}
      </p>
      <p className="text-sm text-muted-foreground">
        {t(action === "declare" ? "capacity.audience" : "capacity.withdrawEffect")}
      </p>
      <p className="text-sm text-muted-foreground">{t("capacity.limits")}</p>
      {changed && (
        <p role="alert" className="text-sm text-destructive">
          {t("capacity.conflict")}
        </p>
      )}
      <fieldset disabled={pending || frozen || changed} className="space-y-4">
        <legend className="sr-only">{t(`capacity.${action}`)}</legend>
        {action === "declare" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="capacity-position">{t("capacity.choose")}</Label>
              <select
                id="capacity-position"
                className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...form.register("position")}
              >
                <option value="">{t("capacity.select")}</option>
                {capacityPositionSchema.options.map((position) => (
                  <option key={position} value={position}>
                    {t(`capacity.position.${position}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity-valid-until">{t("capacity.validUntil")}</Label>
              <Input
                id="capacity-valid-until"
                type="datetime-local"
                required
                aria-describedby="capacity-expiry-help"
                {...form.register("validUntil")}
              />
              <p id="capacity-expiry-help" className="text-sm text-muted-foreground">
                {t("capacity.expiryHelp")}
              </p>
            </div>
          </div>
        )}
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input type="checkbox" {...form.register("confirmed")} />
          {t(action === "declare" ? "capacity.confirmDeclare" : "capacity.confirmWithdraw")}
        </label>
      </fieldset>
      {Object.keys(form.formState.errors).length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {t(action === "declare" ? "capacity.invalid" : "capacity.invalidWithdraw")}
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
          {t(
            pending
              ? "loading"
              : frozen
                ? "retry"
                : action === "declare"
                  ? "capacity.declare"
                  : "capacity.withdraw",
          )}
        </Button>
      </div>
    </form>
  );
}

export function CapacityDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t } = useTranslation(),
    session = usePartner(),
    client = useQueryClient();
  const [before, setBefore] = useState<number>(),
    [history, setHistory] = useState(false),
    [selectedRevision, setSelectedRevision] = useState<number>(),
    [editing, setEditing] = useState<{
      initial: CapacityDossier;
      action: CapacityInput["action"];
    } | null>(null),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  const key = [...session.queryKey, "capacity", userId];
  const query = useQuery({
    queryKey: [...key, before],
    queryFn: ({ signal }) => partnerApi.capacity(userId, before, signal),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 10000,
    retry: false,
  });
  const selected = query.data?.history.find((item) => item.revision === selectedRevision);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl" closeLabel={t("close")}>
        <DialogHeader>
          <DialogTitle>{t("capacity.title")}</DialogTitle>
          <DialogDescription>{t("capacity.description")}</DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <LoadingState label={t("loading")} />
        ) : query.isError ? (
          <ErrorState
            title={t("error")}
            description={t("capacity.error")}
            retryLabel={t("retry")}
            pendingLabel={t("loading")}
            onRetry={() => void query.refetch()}
          />
        ) : editing ? (
          <CapacityForm
            initial={editing.initial}
            current={query.data}
            action={editing.action}
            onBusy={setBusy}
            onBack={() => {
              setEditing(null);
              void query.refetch();
            }}
            onSaved={(result) => {
              client.setQueryData([...key, undefined], result);
              setEditing(null);
              setBefore(undefined);
              setSaved(true);
              void client.invalidateQueries({ queryKey: session.queryKey });
            }}
          />
        ) : history ? (
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => {
                if (selectedRevision) setSelectedRevision(undefined);
                else {
                  setHistory(false);
                  setBefore(undefined);
                }
              }}
            >
              {t("capacity.back")}
            </Button>
            {selected ? (
              <Declaration value={selected} historical />
            ) : (
              <>
                <h3 className="font-medium">{t("capacity.history")}</h3>
                {query.data.history.map((item) => (
                  <Button
                    key={item.revision}
                    variant="outline"
                    className="h-auto w-full justify-start whitespace-normal text-left"
                    onClick={() => setSelectedRevision(item.revision)}
                  >
                    {t("capacity.record", {
                      revision: item.revision,
                      date: formatDate(item.declaredAt),
                    })}
                  </Button>
                ))}
                <div className="flex flex-wrap items-center gap-3">
                  {before && (
                    <Button variant="outline" onClick={() => setBefore(undefined)}>
                      {t("capacity.latest")}
                    </Button>
                  )}
                  {query.data.nextBeforeRevision && (
                    <Button
                      variant="outline"
                      onClick={() => setBefore(query.data.nextBeforeRevision!)}
                    >
                      {t("capacity.older")}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {saved && (
              <p role="status" className="text-sm">
                {t("capacity.saved")}
              </p>
            )}
            <Workload value={query.data} />
            {query.data.current ? (
              <Declaration value={query.data.current} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("capacity.unset")}</p>
            )}
            <p className="text-sm text-muted-foreground">{t("capacity.limits")}</p>
            <div className="flex flex-wrap items-center gap-3">
              {query.data.canDeclare && (
                <Button
                  onClick={() => {
                    setSaved(false);
                    setEditing({ initial: query.data, action: "declare" });
                  }}
                >
                  {t("capacity.declare")}
                </Button>
              )}
              {query.data.canWithdraw && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSaved(false);
                    setEditing({ initial: query.data, action: "withdraw" });
                  }}
                >
                  {t("capacity.withdraw")}
                </Button>
              )}
              {query.data.history.length > 0 && (
                <Button variant="outline" onClick={() => setHistory(true)}>
                  {t("capacity.history")}
                </Button>
              )}
              <Button
                variant="outline"
                disabled={query.isFetching}
                onClick={() => void query.refetch()}
              >
                {t(query.isFetching ? "loading" : "capacity.refresh")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
