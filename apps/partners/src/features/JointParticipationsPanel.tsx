import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type {
  JointParticipation,
  JointParticipationAction,
} from "@coverview/contracts/partner-joint";
import { PartnerApiError } from "@coverview/api-client/partner";
import { Badge, Button, Input, Label } from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { formatDate } from "./Field";

type Action = JointParticipationAction["action"];
const virtual = (mode: string) => mode === "phone" || mode === "video";

// C6b: appointments this request joins on another request of the same client. The invited
// professional confirms with their own buffers, declines, withdraws or records their outcome;
// this request keeps its own stage and next action.
export function JointParticipationsPanel({ leadId }: { leadId: string }) {
  const { t } = useTranslation(),
    session = usePartner(),
    cache = useQueryClient();
  const queryKey = [...session.queryKey, "participations", leadId];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => partnerApi.jointParticipations(leadId, signal),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 15000,
  });
  const [form, setForm] = useState<{ item: JointParticipation; action: Action } | null>(null),
    [notice, setNotice] = useState("");
  if (query.isError)
    return (
      <div className="space-y-2 rounded-xl border border-border p-5">
        <p role="alert">{t("joint.failed")}</p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          {t("joint.retry")}
        </Button>
      </div>
    );
  if (!query.data?.items.length) return null;
  return (
    <section
      className="space-y-3 rounded-xl border border-border p-5"
      aria-labelledby="joint-title"
    >
      <h3 id="joint-title" className="font-semibold">
        {t("joint.title")}
      </h3>
      <p className="text-sm text-muted-foreground">{t("joint.description")}</p>
      {notice && <p role="alert">{notice}</p>}
      <ul className="space-y-3">
        {query.data.items.map((item) => (
          <li key={item.id} className="space-y-2 rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{formatDate(item.appointment.startsAt)}</p>
              <Badge variant="outline">
                {t(`joint.state.${item.state}`)}
                {item.state === "confirmed" && !item.termsCurrent && ` · ${t("joint.stale")}`}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t(`appointment.${item.appointment.mode}`)}
              {" · "}
              {item.appointment.location}
              {" · "}
              {new Intl.NumberFormat("fr-CH", { style: "unit", unit: "minute" }).format(
                item.appointment.durationMinutes,
              )}
            </p>
            <p className="text-sm">
              {item.host.name
                ? t("joint.host", {
                    name: item.host.name,
                    organization: item.host.organization ?? "",
                  })
                : t("joint.unknownHost")}
            </p>
            {item.appointmentState !== "scheduled" && (
              <p className="text-sm">
                {t("joint.appointmentState", {
                  state: t(`appointment.${item.appointmentState}`),
                })}
              </p>
            )}
            {item.outcome && (
              <p className="text-sm">
                {t("joint.outcomeValue", { outcome: t(`joint.outcomes.${item.outcome}`) })}
              </p>
            )}
            {item.check && item.state === "invited" && (
              <p className="text-sm" role="status">
                {item.check.conflict
                  ? t("joint.check.conflict")
                  : item.check.mode === "offered" && item.check.period === "covered"
                    ? t("joint.check.covered")
                    : t("joint.check.uncovered")}
              </p>
            )}
            {form?.item.id === item.id ? (
              <DecisionForm
                key={`${item.id}:${form.action}`}
                leadId={leadId}
                item={item}
                action={form.action}
                onDone={(value, changed) => {
                  setNotice(changed ? t("joint.changed") : "");
                  if (value) {
                    cache.setQueryData(queryKey, value);
                    void cache.invalidateQueries({
                      queryKey: [...session.queryKey, "lead", leadId],
                    });
                    void cache.invalidateQueries({ queryKey: [...session.queryKey, "work"] });
                  } else void query.refetch();
                  setForm(null);
                }}
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {item.canConfirm && (
                  <Button size="sm" onClick={() => setForm({ item, action: "confirm" })}>
                    {t("joint.confirm")}
                  </Button>
                )}
                {item.canDecline && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setForm({ item, action: "decline" })}
                  >
                    {t("joint.decline")}
                  </Button>
                )}
                {item.canWithdraw && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setForm({ item, action: "withdraw" })}
                  >
                    {t("joint.withdraw")}
                  </Button>
                )}
                {item.canRecordOutcome && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setForm({ item, action: "outcome" })}
                  >
                    {t("joint.outcome")}
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function DecisionForm({
  leadId,
  item,
  action,
  onDone,
}: {
  leadId: string;
  item: JointParticipation;
  action: Action;
  onDone: (
    value: Awaited<ReturnType<typeof partnerApi.jointParticipations>> | null,
    changed?: boolean,
  ) => void;
}) {
  const { t } = useTranslation(),
    { identity } = usePartner();
  const [minutes, setMinutes] = useState({ preparation: 15, before: 0, after: 0 }),
    [checks, setChecks] = useState({ commitments: false, capacity: false }),
    [reason, setReason] = useState(""),
    [outcome, setOutcome] = useState<"completed" | "client_absent" | "advisor_absent">("completed"),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  // The first command is kept: an uncertain failure is retried with the same idempotency key.
  const attempt = useRef<{ input: JointParticipationAction; key: string } | null>(null);
  const noTravel = virtual(item.appointment.mode);
  const bounded = (value: number) => Number.isInteger(value) && value >= 0 && value <= 240;
  const valid =
    action === "confirm"
      ? checks.commitments &&
        checks.capacity &&
        bounded(minutes.preparation) &&
        bounded(minutes.before) &&
        bounded(minutes.after)
      : action === "withdraw"
        ? reason.trim().length >= 3 && reason.trim().length <= 1000
        : true;
  function input(): JointParticipationAction {
    if (action === "confirm")
      return {
        action,
        basis: item.basis,
        preparationMinutes: minutes.preparation,
        travelBeforeMinutes: noTravel ? 0 : minutes.before,
        travelAfterMinutes: noTravel ? 0 : minutes.after,
        externalCommitmentsChecked: true,
        capacityConfirmed: true,
      };
    if (action === "withdraw") return { action, basis: item.basis, reason: reason.trim() };
    if (action === "outcome") return { action, basis: item.basis, outcome };
    return { action: "decline", basis: item.basis };
  }
  async function send() {
    if (pending || (!attempt.current && !valid)) return;
    attempt.current ??= { input: input(), key: crypto.randomUUID() };
    setPending(true);
    setError("");
    try {
      onDone(
        await partnerApi.decideJointParticipation(leadId, item.id, attempt.current.input, {
          csrfToken: identity.csrfToken,
          idempotencyKey: attempt.current.key,
        }),
      );
    } catch (cause) {
      const definitive =
        cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
      // A refusal is final for this attempt: the list is re-read and the panel says why.
      if (definitive) onDone(null, true);
      else setError(t("joint.retryExact"));
    } finally {
      setPending(false);
    }
  }
  const frozen = pending || !!attempt.current;
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <fieldset disabled={frozen} className="space-y-3">
        <legend className="sr-only">{t(`joint.${action}`)}</legend>
        {action === "confirm" && (
          <>
            <p className="text-sm text-muted-foreground">{t("joint.confirmHelp")}</p>
            {(
              [
                ["preparation", "preparationMinutes"],
                ["before", "travelBeforeMinutes"],
                ["after", "travelAfterMinutes"],
              ] as const
            ).map(([field, label]) => (
              <div key={field} className="space-y-1">
                <Label htmlFor={`joint-${item.id}-${field}`}>{t(`appointmentTime.${label}`)}</Label>
                <Input
                  id={`joint-${item.id}-${field}`}
                  type="number"
                  min={0}
                  max={240}
                  step={1}
                  disabled={field !== "preparation" && noTravel}
                  value={field !== "preparation" && noTravel ? 0 : minutes[field]}
                  onChange={(event) =>
                    setMinutes((current) => ({ ...current, [field]: event.target.valueAsNumber }))
                  }
                />
              </div>
            ))}
            {noTravel && (
              <p className="text-sm text-muted-foreground">{t("joint.travelVirtual")}</p>
            )}
            {(
              [
                ["commitments", "externalCommitments"],
                ["capacity", "capacity"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0"
                  checked={checks[field]}
                  onChange={(event) =>
                    setChecks((current) => ({ ...current, [field]: event.target.checked }))
                  }
                />
                <span>{t(`joint.${label}`)}</span>
              </label>
            ))}
          </>
        )}
        {action === "decline" && <p className="text-sm">{t("joint.declineHelp")}</p>}
        {action === "withdraw" && (
          <div className="space-y-1">
            <Label htmlFor={`joint-${item.id}-reason`}>{t("joint.reason")}</Label>
            <textarea
              id={`joint-${item.id}-reason`}
              className="min-h-20 w-full rounded-md border border-input bg-background p-3 text-sm"
              maxLength={1000}
              aria-describedby={`joint-${item.id}-reason-help`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <p id={`joint-${item.id}-reason-help`} className="text-sm text-muted-foreground">
              {t("joint.reasonHelp")}
            </p>
          </div>
        )}
        {action === "outcome" && (
          <div className="space-y-1">
            <Label htmlFor={`joint-${item.id}-outcome`}>{t("joint.outcome")}</Label>
            <select
              id={`joint-${item.id}-outcome`}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={outcome}
              onChange={(event) => setOutcome(event.target.value as typeof outcome)}
            >
              {(["completed", "client_absent", "advisor_absent"] as const).map((value) => (
                <option key={value} value={value}>
                  {t(`joint.outcomes.${value}`)}
                </option>
              ))}
            </select>
          </div>
        )}
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending || (!attempt.current && !valid)}>
          {t(pending ? "joint.sending" : attempt.current ? "joint.retryExact" : "joint.submit")}
        </Button>
        {!attempt.current && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => onDone(null)}
          >
            {t("joint.cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}
