import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { createPartnerClient, PartnerApiError } from "@coverview/api-client/partner";
import {
  partnerContinuityUpdateSchema,
  type PartnerContinuityUpdate,
  type PartnerContinuitySettings,
} from "@coverview/contracts/partner";
import {
  Button,
  Input,
  LoadingState,
  ErrorState,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@coverview/ui";
import { AdminBoundary } from "../features/users/AdminBoundary";

const client = createPartnerClient(
  import.meta.env.VITE_API_URL ??
    (import.meta.env.DEV ? "http://127.0.0.1:4100" : window.location.origin),
);
const timeValue = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

function SettingsForm({
  settings,
  identity,
  blocked,
  onSaved,
}: {
  settings: PartnerContinuitySettings;
  identity: IdentityMe;
  blocked: boolean;
  onSaved: (settings: PartnerContinuitySettings) => void;
}) {
  const { t, i18n } = useTranslation("partner");
  const form = useForm<PartnerContinuityUpdate>({
    resolver: zodResolver(partnerContinuityUpdateSchema),
    defaultValues: { ...settings.current, reason: "" },
  });
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const [closedDatesText, setClosedDatesText] = useState(
    settings.current.policy.calendar.closedDates.join("\n"),
  );
  const [history, setHistory] = useState<PartnerContinuitySettings["history"][number] | null>(null);
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  const mutation = useMutation({
    mutationFn: (input: PartnerContinuityUpdate) => {
      const payload = JSON.stringify(input);
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      return client.updateContinuitySettings(input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: attempt.current.key,
      });
    },
    onSuccess: onSaved,
  });
  const enabled = form.watch("policy.calendar.enabled");
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Zurich",
    }).format(new Date(value));
  return (
    <div className="space-y-8" ref={setPortal}>
      <form
        onSubmit={(event) => {
          void form.handleSubmit((input) => mutation.mutate(input))(event);
        }}
        className="space-y-6"
      >
        <fieldset disabled={blocked || mutation.isPending} className="space-y-6">
          <div className="rounded-xl border border-border p-5 space-y-3">
            <p className="font-medium">{t("continuity.reference")}</p>
            <p className="text-sm text-muted-foreground">{t("continuity.scope")}</p>
            <label className="grid gap-2 max-w-sm" htmlFor="acceptance-hours">
              {t("continuity.acceptanceHours")}
              <Input
                id="acceptance-hours"
                type="number"
                min={1}
                max={24}
                {...form.register("policy.acceptanceHours", { valueAsNumber: true })}
              />
            </label>
          </div>
          <div className="rounded-xl border border-border p-5 space-y-4">
            <label className="flex items-center gap-3" htmlFor="calendar-enabled">
              <Input
                id="calendar-enabled"
                type="checkbox"
                className="size-4"
                {...form.register("policy.calendar.enabled")}
              />
              {t("continuity.calendarEnabled")}
            </label>
            <p className="text-sm text-muted-foreground">{t("continuity.calendarHelp")}</p>
            <fieldset disabled={!enabled} className="space-y-4 disabled:opacity-60">
              <legend className="text-sm mb-3">{t("continuity.serviceDays")}</legend>
              <Controller
                name="policy.calendar.weekdays"
                control={form.control}
                render={({ field }) => (
                  <div className="flex flex-wrap gap-4">
                    {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                      <label key={day} className="flex items-center gap-2">
                        <Input
                          type="checkbox"
                          className="size-4"
                          checked={field.value.includes(day)}
                          onChange={(event) =>
                            field.onChange(
                              event.target.checked
                                ? [...field.value, day].sort()
                                : field.value.filter((d) => d !== day),
                            )
                          }
                        />
                        {t(`continuity.days.${day}`)}
                      </label>
                    ))}
                  </div>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                {(["opensAt", "closesAt"] as const).map((name) => (
                  <label key={name} className="grid gap-2" htmlFor={name}>
                    {t(`continuity.${name}`)}
                    <Controller
                      name={`policy.calendar.${name}`}
                      control={form.control}
                      render={({ field }) => (
                        <Input
                          id={name}
                          type="time"
                          step={900}
                          value={timeValue(field.value % 1440)}
                          onChange={(event) => {
                            const [h, m] = event.target.value.split(":").map(Number);
                            const minutes = (h ?? 0) * 60 + (m ?? 0);
                            field.onChange(name === "closesAt" && minutes === 0 ? 1440 : minutes);
                          }}
                        />
                      )}
                    />
                  </label>
                ))}
              </div>
              <label className="grid gap-2" htmlFor="closed-dates">
                {t("continuity.closedDates")}
                <Controller
                  name="policy.calendar.closedDates"
                  control={form.control}
                  render={({ field }) => (
                    <textarea
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      id="closed-dates"
                      rows={3}
                      value={closedDatesText}
                      onChange={(event) => {
                        setClosedDatesText(event.target.value);
                        field.onChange(event.target.value.split(/\s+/u).filter(Boolean));
                      }}
                      aria-describedby="closed-dates-help"
                    />
                  )}
                />
              </label>
              <p id="closed-dates-help" className="text-xs text-muted-foreground">
                {t("continuity.closedDatesHelp")}
              </p>
            </fieldset>
          </div>
          <label className="grid gap-2" htmlFor="change-reason">
            {t("continuity.reason")}
            <textarea
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              id="change-reason"
              maxLength={2000}
              rows={2}
              {...form.register("reason")}
            />
          </label>
          {Object.keys(form.formState.errors).length > 0 && (
            <p role="alert" className="text-sm text-destructive">
              {t("continuity.invalid")}
            </p>
          )}
          {mutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t(
                mutation.error instanceof PartnerApiError &&
                  mutation.error.code === "PARTNER_CONFLICT"
                  ? "continuity.conflict"
                  : "continuity.failed",
              )}
            </p>
          )}
          <Button type="submit">
            {t(mutation.isPending ? "continuity.saving" : "continuity.save")}
          </Button>
        </fieldset>
      </form>
      <section className="space-y-4" aria-labelledby="policy-history">
        <h2 id="policy-history" className="text-xl font-semibold">
          {t("continuity.history")}
        </h2>
        {settings.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("continuity.default")}</p>
        ) : (
          settings.history.map((version) => (
            <div
              key={version.revision}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3"
            >
              <div>
                <p className="font-medium">
                  {t("continuity.version", { revision: version.revision })}
                </p>
                <p className="text-sm text-muted-foreground">{date(version.createdAt)}</p>
              </div>
              <Button variant="outline" onClick={() => setHistory(version)}>
                {t("continuity.inspect")}
              </Button>
            </div>
          ))
        )}
      </section>
      <Sheet
        open={!!history && !blocked}
        onOpenChange={(open) => {
          if (!open) setHistory(null);
        }}
      >
        <SheetContent portalContainer={portal} className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t("continuity.version", { revision: history?.revision })}</SheetTitle>
            <SheetDescription>{t("continuity.historyHelp")}</SheetDescription>
          </SheetHeader>
          {history && (
            <dl className="space-y-4 p-6 text-sm">
              <div>
                <dt className="text-muted-foreground">{t("continuity.changedBy")}</dt>
                <dd className="break-all">{history.changedBy}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("continuity.reason")}</dt>
                <dd className="whitespace-pre-wrap">{history.reason}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("continuity.acceptanceHours")}</dt>
                <dd>{history.policy.acceptanceHours}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("continuity.calendarEnabled")}</dt>
                <dd>
                  {t(
                    history.policy.calendar.enabled ? "continuity.enabled" : "continuity.disabled",
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("continuity.serviceDays")}</dt>
                <dd>
                  {new Intl.ListFormat(i18n.language).format(
                    history.policy.calendar.weekdays.map((d) => t(`continuity.days.${d}`)),
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("continuity.hours")}</dt>
                <dd>
                  {t("continuity.hoursValue", {
                    start: timeValue(history.policy.calendar.opensAt),
                    end: timeValue(history.policy.calendar.closesAt),
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("continuity.closedDates")}</dt>
                <dd>{history.policy.calendar.closedDates.join(", ") || t("continuity.none")}</dd>
              </div>
            </dl>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Configuration({ identity, blocked }: { identity: IdentityMe; blocked: boolean }) {
  const { t } = useTranslation("partner"),
    cache = useQueryClient();
  const [saved, setSaved] = useState(false);
  const queryKey = ["private", identity.user.id, identity.session.id, "partner-continuity"];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => client.continuitySettings(signal),
    enabled: !blocked,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-3">
        <Link to="/partner" className="text-sm underline">
          {t("continuity.back")}
        </Link>
        <h1 className="cv-app-heading">{t("continuity.title")}</h1>
        <p className="text-muted-foreground">{t("continuity.description")}</p>
      </header>
      {saved && <p role="status">{t("continuity.saved")}</p>}
      <Button
        variant="outline"
        disabled={query.isFetching || blocked}
        onClick={() => {
          setSaved(false);
          void query.refetch();
        }}
      >
        {t("retry")}
      </Button>
      {query.isError ? (
        <ErrorState
          title={t("error")}
          description={t("retryDescription")}
          retryLabel={t("retry")}
          pendingLabel={t("loading")}
          onRetry={() => void query.refetch()}
        />
      ) : query.data ? (
        <SettingsForm
          key={query.data.current.revision}
          settings={query.data}
          identity={identity}
          blocked={blocked || query.isFetching}
          onSaved={(settings) => {
            cache.setQueryData(queryKey, settings);
            setSaved(true);
          }}
        />
      ) : (
        <LoadingState label={t("loading")} />
      )}
    </div>
  );
}
export function PartnerContinuityPage() {
  return (
    <AdminBoundary>
      {(identity, blocked) => <Configuration identity={identity} blocked={blocked} />}
    </AdminBoundary>
  );
}
