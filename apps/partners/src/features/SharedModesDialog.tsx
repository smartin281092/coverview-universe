import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  sharedModesInputSchema,
  sharedModesAudienceSchema,
  leadAppointmentModeSchema,
  type SharedModesDossier,
  type SharedModesInput,
} from "@coverview/contracts/partner";
import { PartnerApiError } from "@coverview/api-client/partner";
import {
  Button,
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
import { formatDate } from "./Field";

function Declaration({ value }: { value: NonNullable<SharedModesDossier["current"]> }) {
  const { t, i18n } = useTranslation();
  return (
    <section className="space-y-3 text-sm">
      <h3 className="font-medium">{t(`sharedModes.action.${value.action}`)}</h3>
      <p>{t(`sharedModes.scope.${value.professionalScope}`)}</p>
      <p>
        {t("sharedModes.subject", {
          name: value.declaredName,
          organization: value.declaredOrganization,
        })}
      </p>
      <p>
        {t("sharedModes.categories", {
          values: new Intl.ListFormat(i18n.language).format(
            value.categories.map((category) => t(`category.${category}`)),
          ),
        })}
      </p>
      <p>
        {t("sharedModes.record", { revision: value.revision, date: formatDate(value.declaredAt) })}
      </p>
      {value.action === "publish" && (
        <p>
          {new Intl.ListFormat(i18n.language).format(
            value.modes.map((mode) => t(`appointment.${mode}`)),
          )}
        </p>
      )}
      <p className="text-muted-foreground">{t("sharedModes.audience")}</p>
    </section>
  );
}

function SharedModesForm({
  initial,
  current,
  action,
  onSaved,
  onBack,
  onBusy,
}: {
  initial: SharedModesDossier;
  current: SharedModesDossier;
  action: SharedModesInput["action"];
  onSaved: (value: SharedModesDossier) => void;
  onBack: () => void;
  onBusy: (value: boolean) => void;
}) {
  const { t, i18n } = useTranslation(),
    { identity } = usePartner();
  const [error, setError] = useState(""),
    [blocked, setBlocked] = useState(false),
    [frozen, setFrozen] = useState(false);
  const attempt = useRef<{ input: SharedModesInput; key: string } | null>(null);
  const schema = z.object({
    modes: sharedModesInputSchema.shape.modes.refine((values) =>
      action === "publish" ? values.length > 0 : values.length === 0,
    ),
    confirmed: z.boolean().refine(Boolean),
  });
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      modes:
        action === "publish" &&
        initial.current?.action === "publish" &&
        initial.current.professionalScope === "current"
          ? initial.current.modes
          : [],
      confirmed: false,
    },
  });
  const modes = form.watch("modes"),
    pending = form.formState.isSubmitting;
  const changed =
    current.professionalRevision !== initial.professionalRevision ||
    (current.current?.revision ?? 0) !== (initial.current?.revision ?? 0) ||
    !(action === "publish" ? current.canPublish : current.canWithdraw);
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || blocked || (changed && !attempt.current)) return;
        void form.handleSubmit(async (values) => {
          attempt.current ??= {
            input: sharedModesInputSchema.parse({
              ...values,
              action,
              revision: initial.current?.revision ?? 0,
              professionalRevision: initial.professionalRevision,
              audience: sharedModesAudienceSchema.value,
            }),
            key: crypto.randomUUID(),
          };
          setFrozen(true);
          setError("");
          onBusy(true);
          try {
            onSaved(
              await partnerApi.declareSharedModes(initial.userId, attempt.current.input, {
                csrfToken: identity.csrfToken,
                idempotencyKey: attempt.current.key,
              }),
            );
          } catch (cause) {
            const conflict =
              cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
            setBlocked(conflict);
            setError(t(`sharedModes.${conflict ? "conflict" : "retryExact"}`));
          } finally {
            onBusy(false);
          }
        })();
      }}
    >
      <h3 className="font-medium">{t(`sharedModes.${action}`)}</h3>
      <p className="text-sm">
        {t("sharedModes.subject", { name: initial.name, organization: initial.organization })}
      </p>
      <p className="text-sm">
        {t("sharedModes.categories", {
          values: new Intl.ListFormat(i18n.language).format(
            initial.categories.map((category) => t(`category.${category}`)),
          ),
        })}
      </p>
      <p className="text-sm text-muted-foreground">
        {t(action === "publish" ? "sharedModes.audience" : "sharedModes.withdrawEffect")}
      </p>
      <p className="text-sm text-muted-foreground">{t("sharedModes.limits")}</p>
      {changed && (
        <p role="alert" className="text-sm text-destructive">
          {t("sharedModes.conflict")}
        </p>
      )}
      <fieldset disabled={pending || frozen || changed} className="space-y-4">
        <legend className="sr-only">{t(`sharedModes.${action}`)}</legend>
        {action === "publish" && (
          <fieldset className="space-y-3">
            <legend className="mb-3 font-medium">{t("sharedModes.choose")}</legend>
            {leadAppointmentModeSchema.options.map((mode) => (
              <label key={mode} className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={modes.includes(mode)}
                  onChange={(event) =>
                    form.setValue(
                      "modes",
                      event.target.checked
                        ? [...modes, mode]
                        : modes.filter((value) => value !== mode),
                      { shouldValidate: true },
                    )
                  }
                />
                {t(`appointment.${mode}`)}
              </label>
            ))}
          </fieldset>
        )}
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input type="checkbox" {...form.register("confirmed")} />
          {t(action === "publish" ? "sharedModes.confirmPublish" : "sharedModes.confirmWithdraw")}
        </label>
      </fieldset>
      {Object.keys(form.formState.errors).length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {t(action === "publish" ? "sharedModes.invalid" : "sharedModes.invalidWithdraw")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" disabled={pending} onClick={onBack}>
          {t("sharedModes.back")}
        </Button>
        <Button type="submit" disabled={pending || blocked || (changed && !attempt.current)}>
          {t(
            pending
              ? "loading"
              : frozen
                ? "retry"
                : action === "publish"
                  ? "sharedModes.publish"
                  : "sharedModes.withdraw",
          )}
        </Button>
      </div>
    </form>
  );
}

export function SharedModesDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t } = useTranslation(),
    session = usePartner(),
    client = useQueryClient();
  const [before, setBefore] = useState<number>(),
    [history, setHistory] = useState(false),
    [selectedRevision, setSelectedRevision] = useState<number>(),
    [editing, setEditing] = useState<{
      initial: SharedModesDossier;
      action: SharedModesInput["action"];
    } | null>(null),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  const key = [...session.queryKey, "shared-modes", userId];
  const query = useQuery({
    queryKey: [...key, before],
    queryFn: ({ signal }) => partnerApi.sharedModes(userId, before, signal),
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
          <DialogTitle>{t("sharedModes.title")}</DialogTitle>
          <DialogDescription>{t("sharedModes.description")}</DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <LoadingState label={t("loading")} />
        ) : query.isError ? (
          <ErrorState
            title={t("error")}
            description={t("sharedModes.error")}
            retryLabel={t("retry")}
            pendingLabel={t("loading")}
            onRetry={() => void query.refetch()}
          />
        ) : editing ? (
          <SharedModesForm
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
              {t("sharedModes.back")}
            </Button>
            {selected ? (
              <Declaration value={selected} />
            ) : (
              <>
                <h3 className="font-medium">{t("sharedModes.history")}</h3>
                {query.data.history.map((item) => (
                  <Button
                    key={item.revision}
                    variant="outline"
                    className="h-auto w-full justify-start whitespace-normal text-left"
                    onClick={() => setSelectedRevision(item.revision)}
                  >
                    {t("sharedModes.record", {
                      revision: item.revision,
                      date: formatDate(item.declaredAt),
                    })}
                  </Button>
                ))}
                <div className="flex flex-wrap items-center gap-3">
                  {before && (
                    <Button variant="outline" onClick={() => setBefore(undefined)}>
                      {t("sharedModes.latest")}
                    </Button>
                  )}
                  {query.data.nextBeforeRevision && (
                    <Button
                      variant="outline"
                      onClick={() => setBefore(query.data.nextBeforeRevision!)}
                    >
                      {t("sharedModes.older")}
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
                {t("sharedModes.saved")}
              </p>
            )}
            {query.data.current ? (
              <Declaration value={query.data.current} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("sharedModes.unset")}</p>
            )}
            <p className="text-sm text-muted-foreground">{t("sharedModes.limits")}</p>
            <div className="flex flex-wrap items-center gap-3">
              {query.data.canPublish && (
                <Button
                  onClick={() => {
                    setSaved(false);
                    setEditing({ initial: query.data, action: "publish" });
                  }}
                >
                  {t("sharedModes.publish")}
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
                  {t("sharedModes.withdraw")}
                </Button>
              )}
              {query.data.history.length > 0 && (
                <Button variant="outline" onClick={() => setHistory(true)}>
                  {t("sharedModes.history")}
                </Button>
              )}
              <Button
                variant="outline"
                disabled={query.isFetching}
                onClick={() => void query.refetch()}
              >
                {t(query.isFetching ? "loading" : "sharedModes.refresh")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
