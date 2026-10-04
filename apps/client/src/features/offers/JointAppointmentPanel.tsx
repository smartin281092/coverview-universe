import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { PartnerApiError } from "@coverview/api-client/partner";
import type { JointInvitationInput } from "@coverview/contracts/partner-joint";
import { Badge, Button } from "@coverview/ui";
import { partnerApi } from "../../partner-api";

const policy = { gcTime: 0, staleTime: 0, retry: false, refetchInterval: 10000 } as const;
const root = (identity: IdentityMe) => [
  "private",
  identity.user.id,
  identity.session.id,
  "wallet-leads",
];

// C6b, brief I.12: the owner invites the advisor of another of their requests to this appointment.
// The advisor confirms on their side; availability is shown as a yes/no only.
export function JointAppointmentPanel({
  identity,
  leadId,
  appointmentId,
  onBusy,
}: {
  identity: IdentityMe;
  leadId: string;
  appointmentId: string;
  onBusy: (busy: boolean) => void;
}) {
  const { t } = useTranslation("offers"),
    cache = useQueryClient();
  const queryKey = [...root(identity), "joint", leadId, appointmentId];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => partnerApi.walletJointAppointment(leadId, appointmentId, signal),
    ...policy,
  });
  const [selected, setSelected] = useState<string | null>(null),
    [consent, setConsent] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  // The first invitation is kept: an uncertain failure is retried with the same key.
  const attempt = useRef<{ input: JointInvitationInput; key: string } | null>(null);
  async function invite() {
    const view = query.data;
    if (pending || !view || (!attempt.current && (!selected || !consent))) return;
    attempt.current ??= {
      input: { leadId: selected!, basis: view.basis, confirmed: true },
      key: crypto.randomUUID(),
    };
    setPending(true);
    onBusy(true);
    setError("");
    try {
      const value = await partnerApi.inviteJointParticipant(
        leadId,
        appointmentId,
        attempt.current.input,
        { csrfToken: identity.csrfToken, idempotencyKey: attempt.current.key },
      );
      await cache.cancelQueries({ queryKey });
      cache.setQueryData(queryKey, value);
      attempt.current = null;
      setSelected(null);
      setConsent(false);
      setSent(true);
      void cache.invalidateQueries({ queryKey: root(identity) });
    } catch (cause) {
      const definitive =
        cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
      if (definitive) {
        attempt.current = null;
        setError(t("joint.conflict"));
        void query.refetch();
      } else setError(t("joint.retryExact"));
    } finally {
      setPending(false);
      onBusy(false);
    }
  }
  if (query.isPending) return null;
  if (query.isError)
    return (
      <p role="alert" className="text-sm">
        {t("joint.failed")}
      </p>
    );
  const view = query.data;
  const available = view.candidates.filter((item) => item.status === "available");
  return (
    <section
      className="space-y-3 rounded-lg border border-border p-4"
      aria-labelledby="joint-title"
    >
      <h3 id="joint-title" className="font-medium">
        {t("joint.title")}
      </h3>
      <p className="text-sm text-muted-foreground">{t("joint.description")}</p>
      {!!view.participants.length && (
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("joint.participants")}</p>
          <ul className="space-y-1 text-sm">
            {view.participants.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2">
                <span>
                  {t("joint.participant", {
                    name: item.name ?? "",
                    organization: item.organization ?? "",
                    request: item.leadTitle,
                  })}
                </span>
                <Badge variant="outline">
                  {item.state === "confirmed" && !item.termsCurrent
                    ? t("joint.stale")
                    : t(`joint.state.${item.state}`)}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
      {sent && <p role="status">{t("joint.success")}</p>}
      {!view.canInvite ? (
        <p className="text-sm">{t("joint.closed")}</p>
      ) : !view.candidates.length ? (
        <p className="text-sm">{t("joint.none")}</p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void invite();
          }}
        >
          <fieldset disabled={pending || !!attempt.current} className="space-y-2">
            <legend className="text-sm font-medium">{t("joint.candidates")}</legend>
            {view.candidates.map((item) => (
              <label key={item.leadId} className="flex items-start gap-3 text-sm">
                <input
                  type="radio"
                  name="joint-candidate"
                  className="mt-1 size-5 shrink-0"
                  value={item.leadId}
                  disabled={item.status !== "available"}
                  checked={selected === item.leadId}
                  onChange={() => setSelected(item.leadId)}
                />
                <span>
                  {t("joint.candidate", {
                    name: item.name ?? "",
                    organization: item.organization ?? "",
                    request: item.leadTitle,
                  })}
                  <span className="block text-muted-foreground">
                    {t(`joint.status.${item.status}`)}
                  </span>
                </span>
              </label>
            ))}
            {!!available.length && (
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                <span>{t("joint.consent")}</span>
              </label>
            )}
          </fieldset>
          {error && <p role="alert">{error}</p>}
          {!!available.length && (
            <Button
              type="submit"
              variant="outline"
              disabled={pending || (!attempt.current && (!selected || !consent))}
            >
              {t(pending ? "joint.sending" : attempt.current ? "joint.retryExact" : "joint.invite")}
            </Button>
          )}
        </form>
      )}
    </section>
  );
}

// The appointments this request joins on another of the owner's requests, read only.
export function JoinedAppointments({ identity, leadId }: { identity: IdentityMe; leadId: string }) {
  const { t, i18n } = useTranslation("offers");
  const query = useQuery({
    queryKey: [...root(identity), "participations", leadId],
    queryFn: ({ signal }) => partnerApi.jointParticipations(leadId, signal, true),
    ...policy,
  });
  if (!query.data?.items.length) return null;
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Zurich",
    }).format(new Date(value));
  return (
    <section className="space-y-2" aria-labelledby="joined-title">
      <h3 id="joined-title" className="font-medium">
        {t("joint.joined")}
      </h3>
      <ul className="space-y-2 text-sm">
        {query.data.items.map((item) => (
          <li key={item.id} className="rounded-lg border border-border p-3">
            {t("joint.joinedItem", {
              date: date(item.appointment.startsAt),
              name: item.host.name ?? "",
              state:
                item.state === "confirmed" && !item.termsCurrent
                  ? t("joint.stale")
                  : t(`joint.state.${item.state}`),
            })}
          </li>
        ))}
      </ul>
    </section>
  );
}
