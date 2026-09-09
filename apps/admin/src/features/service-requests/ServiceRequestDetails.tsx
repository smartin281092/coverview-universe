import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import type { z } from "zod";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import { serviceRequestTransitionInputSchema, type ServiceRequest } from "@coverview/contracts";
import { Button, Input, Label } from "@coverview/ui";
import { api } from "../../api";
import { ServiceRequestFailure } from "./ServiceRequestFailure";

type InputValues = z.input<typeof serviceRequestTransitionInputSchema>;
type Transition = InputValues["state"];

function TransitionForm({
  request,
  state,
  identity,
  blocked,
  onPending,
  onSaved,
  onRefresh,
}: {
  request: ServiceRequest;
  state: Transition;
  identity: IdentityMe;
  blocked: boolean;
  onPending: (pending: boolean) => void;
  onSaved: () => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation("serviceRequests");
  const client = useQueryClient();
  const form = useForm<InputValues>({
    resolver: zodResolver(serviceRequestTransitionInputSchema),
    defaultValues: {
      userId: request.userId,
      id: request.id,
      revision: request.revision,
      state,
      ...(state !== "in_progress" ? { evidence: { occurredAt: "", reference: "" } } : {}),
    },
  });
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const busy = useRef(false);
  const blockedNow = useRef(blocked);
  blockedNow.current = blocked;
  const controller = useRef<AbortController | null>(null);
  const command = useRef<{ signature: string; key: string } | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const conflict = failure instanceof ApiError && failure.status === 409;
  const accessFailure =
    failure instanceof ApiError && (failure.status === 401 || failure.status === 403);
  const save = form.handleSubmit(async (input) => {
    if (busy.current || blockedNow.current || conflict) return;
    busy.current = true;
    setPending(true);
    onPending(true);
    setFailure(null);
    const active = new AbortController();
    controller.current = active;
    const signature = JSON.stringify(input);
    if (command.current?.signature !== signature)
      command.current = { signature, key: crypto.randomUUID() };
    try {
      await api.transitionServiceRequest(input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: command.current.key,
        signal: active.signal,
      });
      if (active.signal.aborted) return;
      await client.invalidateQueries({
        queryKey: ["private", identity.user.id, identity.session.id, "service-requests"],
      });
      if (!active.signal.aborted) onSaved();
    } catch (error) {
      if (!active.signal.aborted) setFailure(error);
    } finally {
      if (!active.signal.aborted) {
        busy.current = false;
        setPending(false);
        onPending(false);
      }
    }
  });
  if (accessFailure)
    return <ServiceRequestFailure error={failure} onRetry={() => setFailure(null)} />;
  return (
    <form
      className="space-y-5 border-t border-border pt-5"
      onSubmit={(event) => {
        void save(event);
      }}
      aria-busy={pending}
    >
      <p className="text-sm text-muted-foreground">
        {t(
          state === "in_progress"
            ? "progressHelp"
            : state === "notified"
              ? "notifiedHelp"
              : "confirmedHelp",
        )}
      </p>
      {failure ? (
        <ServiceRequestFailure
          error={failure}
          onRetry={() => {
            if (conflict) onRefresh();
            else void save();
          }}
        />
      ) : null}
      {state !== "in_progress" && (
        <fieldset disabled={pending || blocked || conflict} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service-evidence-date">{t("date")}</Label>
            <Input
              id="service-evidence-date"
              type="datetime-local"
              className="min-h-11"
              aria-invalid={!!form.formState.errors.evidence?.occurredAt}
              aria-describedby="service-evidence-timezone"
              {...form.register("evidence.occurredAt", {
                setValueAs: (value: string) => {
                  const parsed = new Date(value);
                  return value && Number.isFinite(parsed.getTime()) ? parsed.toISOString() : value;
                },
              })}
            />
            <p id="service-evidence-timezone" className="text-xs text-muted-foreground">
              {t("timezone", { timezone: new Intl.DateTimeFormat().resolvedOptions().timeZone })}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="service-evidence-reference">{t("reference")}</Label>
            <Input
              id="service-evidence-reference"
              maxLength={500}
              className="min-h-11"
              aria-invalid={!!form.formState.errors.evidence?.reference}
              aria-describedby="service-evidence-reference-help"
              {...form.register("evidence.reference")}
            />
            <p id="service-evidence-reference-help" className="text-xs text-muted-foreground">
              {t("referenceHelp")}
            </p>
          </div>
        </fieldset>
      )}
      {Object.keys(form.formState.errors).length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {t("invalid")}
        </p>
      )}
      <Button type="submit" className="min-h-11" disabled={pending || blocked || conflict}>
        {t(pending ? "saving" : `transitions.${state}`)}
      </Button>
    </form>
  );
}

export function ServiceRequestDetails({
  request,
  identity,
  blocked,
  onPending,
  onSaved,
  onRefresh,
}: {
  request: ServiceRequest;
  identity: IdentityMe;
  blocked: boolean;
  onPending: (pending: boolean) => void;
  onSaved: () => void;
  onRefresh: () => void;
}) {
  const { t, i18n } = useTranslation("serviceRequests");
  const { t: fields } = useTranslation("users");
  const [transition, setTransition] = useState<Transition | null>(null);
  const [pending, setPending] = useState(false);
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  if (transition)
    return (
      <div className="space-y-5">
        <Button variant="ghost" disabled={pending} onClick={() => setTransition(null)}>
          {t("back")}
        </Button>
        <h3 className="font-medium">{t(`transitions.${transition}`)}</h3>
        <TransitionForm
          key={`${request.id}:${request.revision}:${transition}`}
          request={request}
          state={transition}
          identity={identity}
          blocked={blocked}
          onPending={(value) => {
            setPending(value);
            onPending(value);
          }}
          onSaved={onSaved}
          onRefresh={onRefresh}
        />
      </div>
    );
  return (
    <div className="space-y-6">
      {request.superseded && (
        <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {t("superseded")}
        </p>
      )}
      <div className="space-y-2">
        <p className="text-sm font-medium">{t(`states.${request.state}`)}</p>
        <p className="text-xs text-muted-foreground">
          {t("created", { date: date.format(new Date(request.createdAt)) })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("updated", { date: date.format(new Date(request.updatedAt)) })}
        </p>
      </div>
      <section className="space-y-3">
        <h3 className="font-medium">{t("values")}</h3>
        <dl className="space-y-2 text-sm">
          {Object.entries(request.values).map(([key, value]) => (
            <div key={key} className="grid grid-cols-2 gap-3">
              <dt className="text-muted-foreground">{fields(`fields.${key}`)}</dt>
              <dd className="break-words font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">{t("snapshot")}</p>
        <Button asChild variant="outline" className="min-h-11">
          <Link
            to="/users/$userId"
            params={{ userId: request.userId }}
            search={{ profile: request.profileId, tab: "general" }}
          >
            {t("openProfile")}
          </Link>
        </Button>
      </section>
      {request.evidence && (
        <section className="space-y-2 border-t border-border pt-5 text-sm">
          <h3 className="font-medium">{t("evidenceTitle")}</h3>
          <p>
            {t("evidenceDate", {
              kind: t(`states.${request.evidence.kind}`),
              date: date.format(new Date(request.evidence.occurredAt)),
            })}
          </p>
          <p className="break-words">{request.evidence.reference}</p>
          <p className="text-xs text-muted-foreground">
            {t("evidenceRecorded", { date: date.format(new Date(request.evidence.recordedAt)) })}
          </p>
        </section>
      )}
      {request.allowedTransitions.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {request.allowedTransitions.map((state) => (
            <Button
              key={state}
              variant={transition === state ? "default" : "outline"}
              disabled={pending || blocked}
              aria-pressed={transition === state}
              onClick={() => setTransition(state)}
            >
              {t(`transitions.${state}`)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
