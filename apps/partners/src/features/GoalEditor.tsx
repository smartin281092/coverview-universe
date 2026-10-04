import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  parseZurichDateTime,
} from "@coverview/ui";
import { PartnerApiError } from "@coverview/api-client/partner";
import {
  goalInputSchema,
  goalSchema,
  pilotageMetricSchema,
  pilotageMetricUnit,
  pilotageOptionsSchema,
  type PilotageQuery,
} from "@coverview/contracts/partner-pilotage";
import { usePartner } from "./PartnerSession";
import { partnerApi } from "../api";
import { defaultPilotageQuery } from "./pilotage-display";
import { localDateTime } from "./Field";
import { decimal } from "./EconomyForm";
import { PilotageFilterDialog } from "./PilotageFilterDialog";
const schema = z.object({
  title: z.string().min(5).max(200),
  metric: pilotageMetricSchema,
  target: z.string().min(1),
  direction: z.enum(["at_least", "at_most"]),
  from: z.string(),
  to: z.string(),
  state: z.enum(["active", "archived"]),
  reason: z.string().min(10).max(2000),
  confirmed: z.boolean().refine((v) => v),
});
export function GoalEditor({
  goal,
  options,
  enabled,
  onClose,
  onSaved,
}: {
  goal?: z.infer<typeof goalSchema>;
  options: z.infer<typeof pilotageOptionsSchema>;
  enabled: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation("pilotage"),
    session = usePartner(),
    input = goal?.current.input;
  const [query, setQuery] = useState<PilotageQuery>(
    input
      ? {
          from: input.from,
          to: input.to,
          scope: input.scope.kind,
          ...(input.scope.organizationId ? { organizationId: input.scope.organizationId } : {}),
          ...(input.scope.userIds.length ? { members: input.scope.userIds.join(",") } : {}),
          ...input.filters,
        }
      : defaultPilotageQuery(),
  );
  const [filters, setFilters] = useState(false),
    [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState("");
  const attempt = useRef<{ key: string; input: z.infer<typeof goalInputSchema> } | null>(null),
    controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: input?.title ?? "",
      metric: input?.metric ?? "contacts",
      target: input
        ? String(input.target / (pilotageMetricUnit(input.metric) === "chf_minor" ? 100 : 1))
        : "",
      direction: input?.direction ?? "at_least",
      from: localDateTime(query.from).slice(0, 10),
      to: localDateTime(query.to).slice(0, 10),
      state: input?.state ?? "active",
      reason: "",
      confirmed: false,
    },
  });
  const metric = form.watch("metric"),
    unit = pilotageMetricUnit(metric);
  async function send() {
    if (!attempt.current || pending || blocked) return;
    setPending(true);
    setError("");
    controller.current = new AbortController();
    try {
      await partnerApi.saveGoal(goal?.id ?? null, attempt.current.input, {
        csrfToken: session.identity.csrfToken,
        idempotencyKey: attempt.current.key,
        signal: controller.current.signal,
      });
      if (!controller.current.signal.aborted) {
        attempt.current = null;
        onSaved();
        onClose();
      }
    } catch (cause) {
      if (!controller.current.signal.aborted) {
        const definite =
          cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
        setBlocked(definite);
        setError(t(definite ? "changed" : "uncertain"));
      }
    } finally {
      if (!controller.current.signal.aborted) setPending(false);
    }
  }
  if (filters)
    return (
      <PilotageFilterDialog
        query={query}
        options={options}
        forGoal
        scopeLocked={!!goal}
        onClose={() => setFilters(false)}
        onApply={(value) => {
          setQuery(value);
          form.setValue("from", localDateTime(value.from).slice(0, 10));
          form.setValue("to", localDateTime(value.to).slice(0, 10));
        }}
      />
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
        closeLabel={t("close")}
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>{t(goal ? "editGoal" : "createGoal")}</DialogTitle>
          <DialogDescription>{t("goalEditorDescription")}</DialogDescription>
        </DialogHeader>
        {enabled ? (
          <form
            onSubmit={(event) => {
              void form.handleSubmit((v) => {
                try {
                  const target =
                    unit === "chf_minor"
                      ? decimal({ target: v.target }, "target")
                      : Number(v.target.replace(",", "."));
                  const value = goalInputSchema.parse({
                    expectedRevision: goal?.current.revision ?? 0,
                    title: v.title,
                    metric: v.metric,
                    target,
                    direction: v.direction,
                    from: parseZurichDateTime(`${v.from}T00:00`),
                    to: parseZurichDateTime(`${v.to}T00:00`),
                    state: v.state,
                    reason: v.reason,
                    confirmed: true,
                    scope: {
                      kind: query.scope,
                      organizationId: query.organizationId ?? null,
                      userIds: query.members?.split(",") ?? [],
                    },
                    filters: {
                      ...(query.category ? { category: query.category } : {}),
                      ...(query.source ? { source: query.source } : {}),
                      ...(query.company ? { company: query.company } : {}),
                      ...(query.product ? { product: query.product } : {}),
                    },
                  });
                  attempt.current ??= { key: crypto.randomUUID(), input: value };
                  void send();
                } catch {
                  setError(t("invalid"));
                }
              })(event);
            }}
          >
            <fieldset disabled={pending || blocked || !!attempt.current} className="space-y-4">
              <Label htmlFor="goal-title">{t("goalName")}</Label>
              <Input id="goal-title" {...form.register("title")} />
              <Label htmlFor="goal-metric">{t("indicator")}</Label>
              <select
                id="goal-metric"
                {...form.register("metric")}
                className="min-h-11 w-full rounded-md border border-input bg-background px-3"
              >
                {pilotageMetricSchema.options.map((m) => (
                  <option key={m} value={m}>
                    {t(`metrics.${m}`)}
                  </option>
                ))}
              </select>
              <p className="text-sm text-muted-foreground">{t(`definitions.${metric}`)}</p>
              <Label htmlFor="goal-target">{t("targetUnit", { unit: t(`units.${unit}`) })}</Label>
              <Input id="goal-target" inputMode="decimal" {...form.register("target")} />
              <Label htmlFor="goal-direction">{t("direction")}</Label>
              <select
                id="goal-direction"
                {...form.register("direction")}
                className="min-h-11 w-full rounded-md border border-input bg-background px-3"
              >
                {["at_least", "at_most"].map((v) => (
                  <option key={v} value={v}>
                    {t(`directions.${v}`)}
                  </option>
                ))}
              </select>
              <div className="grid gap-4 sm:grid-cols-2">
                {(["from", "to"] as const).map((name) => (
                  <div key={name}>
                    <Label htmlFor={`goal-${name}`}>{t(name)}</Label>
                    <Input id={`goal-${name}`} type="date" {...form.register(name)} />
                  </div>
                ))}
              </div>
              <p>
                {t("population")}
                {t("separator")}
                {t(`scopes.${query.scope}`)}
              </p>
              <Button type="button" variant="outline" onClick={() => setFilters(true)}>
                {t("goalFilters")}
              </Button>
              {goal && (
                <>
                  <Label htmlFor="goal-state">{t("goalState")}</Label>
                  <select
                    id="goal-state"
                    {...form.register("state")}
                    className="min-h-11 w-full rounded-md border border-input bg-background px-3"
                  >
                    <option value="active">{t("goalStates.active")}</option>
                    <option value="archived">{t("goalStates.archived")}</option>
                  </select>
                </>
              )}
              <Label htmlFor="goal-reason">{t("reason")}</Label>
              <textarea
                id="goal-reason"
                {...form.register("reason")}
                rows={4}
                className="w-full rounded-md border border-input bg-background p-3"
              />
              <label className="flex min-h-11 items-start gap-3">
                <input type="checkbox" {...form.register("confirmed")} />
                {t("confirmGoal")}
              </label>
              {Object.keys(form.formState.errors).length > 0 && <p role="alert">{t("invalid")}</p>}
              <Button type="submit">{t("save")}</Button>
            </fieldset>
          </form>
        ) : (
          <p role="alert">{t("changed")}</p>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {attempt.current && !blocked && (
          <Button disabled={pending} onClick={() => void send()}>
            {t(pending ? "saving" : "retryExact")}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
