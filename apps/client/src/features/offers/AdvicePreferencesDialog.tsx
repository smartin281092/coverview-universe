import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { PartnerApiError } from "@coverview/api-client/partner";
import {
  advicePreferencesInputSchema,
  professionalLanguageSchema,
  leadAppointmentModeSchema,
  swissCantonSchema,
  type AdvicePreferences,
  type AdvicePreferencesInput,
} from "@coverview/contracts/partner";
import {
  Button,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  LoadingState,
  ErrorState,
  swissCantonNamesFr,
  SelectField,
} from "@coverview/ui";
import { partnerApi } from "../../partner-api";

const formSchema = z
  .object({ ...advicePreferencesInputSchema.shape, confirmed: z.boolean() })
  .pipe(advicePreferencesInputSchema);
type Confirmation = NonNullable<AdvicePreferences["current"]>;
function Values({ value }: { value: Confirmation }) {
  const { t, i18n } = useTranslation("offers");
  const names = new Intl.DisplayNames([i18n.language], { type: "language" });
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-3">
      <div>
        <dt className="text-muted-foreground">{t("advice.language")}</dt>
        <dd>{value.languageCode ? names.of(value.languageCode) : t("advice.unknown")}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t("advice.mode")}</dt>
        <dd>{value.mode ? t(`advice.modes.${value.mode}`) : t("advice.unknown")}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t("advice.canton")}</dt>
        <dd>
          {value.canton
            ? swissCantonNamesFr[value.canton]
            : t(
                value.mode === "phone" || value.mode === "video"
                  ? "advice.remote"
                  : "advice.unknown",
              )}
        </dd>
      </div>
    </dl>
  );
}
function PreferenceForm({
  initial,
  current,
  identity,
  onSaved,
  onBusy,
  onBack,
}: {
  initial: AdvicePreferences;
  current: AdvicePreferences;
  identity: IdentityMe;
  onSaved: (value: AdvicePreferences) => void;
  onBusy: (busy: boolean) => void;
  onBack: () => void;
}) {
  const { t, i18n } = useTranslation("offers");
  const saved = initial.status === "confirmed" ? initial.current : null;
  const form = useForm<z.input<typeof formSchema>, unknown, AdvicePreferencesInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      revision: initial.revision,
      scopeRevision: initial.scopeRevision,
      profileRevision: initial.profileRevision ?? 0,
      languageCode: saved?.languageCode ?? null,
      mode: saved?.mode ?? null,
      canton: saved?.canton ?? null,
      confirmed: false,
    },
  });
  const attempt = useRef<{ input: AdvicePreferencesInput; key: string } | null>(null);
  const [frozen, setFrozen] = useState(false),
    [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState("");
  const changed =
    !current.canConfirm ||
    current.revision !== initial.revision ||
    current.scopeRevision !== initial.scopeRevision ||
    current.profileRevision !== initial.profileRevision;
  const mode = form.watch("mode");
  const names = new Intl.DisplayNames([i18n.language], { type: "language" });
  const languages = professionalLanguageSchema.options
    .map((code) => ({ code, name: names.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, i18n.language));
  async function submit(input: AdvicePreferencesInput) {
    attempt.current ??= { input, key: crypto.randomUUID() };
    setFrozen(true);
    setPending(true);
    onBusy(true);
    setError("");
    try {
      onSaved(
        await partnerApi.confirmAdvicePreferences(initial.leadId, attempt.current.input, {
          csrfToken: identity.csrfToken,
          idempotencyKey: attempt.current.key,
        }),
      );
    } catch (cause) {
      const conflict =
        cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
      setBlocked(conflict);
      setError(t(conflict ? "advice.conflict" : "advice.retryExact"));
    } finally {
      setPending(false);
      onBusy(false);
    }
  }
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || blocked || (changed && !attempt.current)) return;
        if (attempt.current) void submit(attempt.current.input);
        else void form.handleSubmit(submit)(event);
      }}
    >
      <p className="text-sm">
        {t("advice.forNeed", { name: initial.profileName, title: initial.scope.title })}
      </p>
      <p className="text-sm text-muted-foreground">
        {t("advice.category", { category: t(`categories.${initial.scope.category}`) })}
      </p>
      {initial.scope.object && (
        <p className="text-sm text-muted-foreground">
          {t("advice.object", { object: initial.scope.object })}
        </p>
      )}
      {initial.scope.context && (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{initial.scope.context}</p>
      )}
      {changed && (
        <p role="alert" className="text-sm text-destructive">
          {t("advice.conflict")}
        </p>
      )}
      <fieldset disabled={pending || frozen || changed} className="space-y-4">
        <legend className="sr-only">{t("advice.edit")}</legend>
        <div className="space-y-2">
          <Label htmlFor="advice-language">{t("advice.language")}</Label>
          <Controller
            control={form.control}
            name="languageCode"
            render={({ field }) => (
              <SelectField
                id="advice-language"
                autoFocus
                value={field.value ?? ""}
                onValueChange={(value) => field.onChange(value || null)}
                options={[
                  { value: "", label: t("advice.unknown") },
                  ...languages.map(({ code, name }) => ({ value: code, label: name })),
                ]}
              />
            )}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="advice-mode">{t("advice.mode")}</Label>
          <Controller
            control={form.control}
            name="mode"
            render={({ field }) => (
              <SelectField
                id="advice-mode"
                value={field.value ?? ""}
                onValueChange={(value) => {
                  field.onChange(value || null);
                  if (!["office", "home"].includes(value)) form.setValue("canton", null);
                }}
                options={[
                  { value: "", label: t("advice.unknown") },
                  ...leadAppointmentModeSchema.options.map((value) => ({
                    value,
                    label: t(`advice.modes.${value}`),
                  })),
                ]}
              />
            )}
          />
        </div>
        {(mode === "office" || mode === "home") && (
          <div className="space-y-2">
            <Label htmlFor="advice-canton">{t("advice.canton")}</Label>
            <Controller
              control={form.control}
              name="canton"
              render={({ field }) => (
                <SelectField
                  id="advice-canton"
                  value={field.value ?? ""}
                  onValueChange={(value) => field.onChange(value || null)}
                  options={[
                    { value: "", label: t("advice.unknown") },
                    ...swissCantonSchema.options.map((value) => ({
                      value,
                      label: swissCantonNamesFr[value],
                    })),
                  ]}
                />
              )}
            />
            <p className="text-xs text-muted-foreground">{t("advice.placeHelp")}</p>
          </div>
        )}
        <p className="text-sm text-muted-foreground">{t("advice.emptyHelp")}</p>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            {...form.register("confirmed")}
            aria-invalid={!!form.formState.errors.confirmed}
          />
          {t("advice.confirm")}
        </label>
      </fieldset>
      {(error || Object.keys(form.formState.errors).length > 0) && (
        <p role="alert" className="text-sm text-destructive">
          {error || t("advice.invalid")}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" disabled={pending} onClick={onBack}>
          {t("advice.back")}
        </Button>
        <Button type="submit" disabled={pending || blocked || (changed && !attempt.current)}>
          {t(pending ? "advice.saving" : frozen ? "advice.retry" : "advice.save")}
        </Button>
      </div>
    </form>
  );
}
export function AdvicePreferencesDialog({
  identity,
  leadId,
  onClose,
}: {
  identity: IdentityMe;
  leadId: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("offers"),
    client = useQueryClient();
  const [before, setBefore] = useState<number>(),
    [editing, setEditing] = useState<AdvicePreferences | null>(null),
    [history, setHistory] = useState(false),
    [selectedRevision, setSelectedRevision] = useState<number>(),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(false);
  const key = ["private", identity.user.id, identity.session.id, "advice", leadId];
  const query = useQuery({
    queryKey: [...key, before],
    queryFn: ({ signal }) => partnerApi.advicePreferences(leadId, before, signal, true),
    gcTime: 0,
    retry: false,
    refetchInterval: (query) => (query.state.status === "error" ? false : 10000),
  });
  const selected = query.data?.history.find((item) => item.revision === selectedRevision);
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(value),
    );
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
        closeLabel={t("close")}
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>{t("advice.title")}</DialogTitle>
          <DialogDescription>{t("advice.description")}</DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <LoadingState label={t("advice.loading")} />
        ) : query.isError ? (
          <ErrorState
            title={t("error")}
            description={t("advice.error")}
            retryLabel={t("retry")}
            pendingLabel={t("advice.loading")}
            onRetry={() => void query.refetch()}
          />
        ) : editing ? (
          <PreferenceForm
            initial={editing}
            current={query.data}
            identity={identity}
            onBusy={setBusy}
            onBack={() => {
              setEditing(null);
              void query.refetch();
            }}
            onSaved={(result) => {
              client.setQueryData([...key, undefined], result);
              setBefore(undefined);
              setEditing(null);
              setSuccess(true);
              void client.invalidateQueries({
                queryKey: ["private", identity.user.id, identity.session.id],
              });
            }}
          />
        ) : selected ? (
          <div className="space-y-4">
            <p className="text-sm">
              {t("advice.record", {
                revision: selected.revision,
                date: date(selected.confirmedAt),
              })}
            </p>
            <p className="font-medium">{selected.scope.title}</p>
            <p className="text-sm">{selected.scope.object}</p>
            <p className="text-sm">
              {t("advice.category", { category: t(`categories.${selected.scope.category}`) })}
            </p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {selected.scope.context}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(selected.currentOwnerConfirmation ? "advice.ownerCurrent" : "advice.ownerChanged")}
            </p>
            <Values value={selected} />
            <Button variant="outline" onClick={() => setSelectedRevision(undefined)}>
              {t("advice.back")}
            </Button>
          </div>
        ) : history ? (
          <div className="space-y-4">
            <h3 className="font-medium">{t("advice.history")}</h3>
            {query.data.history.map((item) => (
              <Button
                key={item.revision}
                variant="outline"
                className="w-full justify-start text-left whitespace-normal"
                onClick={() => setSelectedRevision(item.revision)}
              >
                {t("advice.record", { revision: item.revision, date: date(item.confirmedAt) })}
              </Button>
            ))}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setHistory(false);
                  setBefore(undefined);
                }}
              >
                {t("advice.back")}
              </Button>
              {before && (
                <Button variant="outline" onClick={() => setBefore(undefined)}>
                  {t("advice.latest")}
                </Button>
              )}
              {query.data.nextBeforeRevision && (
                <Button
                  variant="outline"
                  onClick={() => setBefore(query.data.nextBeforeRevision ?? undefined)}
                >
                  {t("advice.older")}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="font-medium">
              {t("advice.forNeed", { name: query.data.profileName, title: query.data.scope.title })}
            </p>
            <p className="text-sm">{t(`advice.status.${query.data.status}`)}</p>
            {success && (
              <p role="status" className="text-sm">
                {t("advice.saved")}
              </p>
            )}
            {query.data.status === "confirmed" && query.data.current && (
              <>
                <Values value={query.data.current} />
                <p className="text-xs text-muted-foreground">
                  {t("advice.record", {
                    revision: query.data.current.revision,
                    date: date(query.data.current.confirmedAt),
                  })}
                </p>
              </>
            )}
            <p className="text-sm text-muted-foreground">{t("advice.limits")}</p>
            <div className="flex flex-wrap gap-3">
              {query.data.canConfirm && (
                <Button
                  onClick={() => {
                    setSuccess(false);
                    setEditing(query.data);
                  }}
                >
                  {t("advice.edit")}
                </Button>
              )}
              {query.data.history.length > 0 && (
                <Button variant="outline" onClick={() => setHistory(true)}>
                  {t("advice.history")}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
