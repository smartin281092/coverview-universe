import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { PartnerApiError } from "@coverview/api-client/partner";
import type { BookingChoice } from "@coverview/contracts/partner";
import { Badge, Button } from "@coverview/ui";
import { partnerApi } from "../../partner-api";

export function WalletBookingChoices({
  identity,
  leadId,
  onBusy,
  unavailable,
}: {
  identity: IdentityMe;
  leadId: string;
  onBusy: (value: boolean) => void;
  unavailable: boolean;
}) {
  const { t, i18n } = useTranslation("offers"),
    client = useQueryClient();
  const root = ["private", identity.user.id, identity.session.id, "wallet-leads"],
    queryKey = [...root, "booking-proposals", leadId];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => partnerApi.bookingProposals(leadId, true, signal),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 10000,
  });
  const [selection, setSelection] = useState<{
      proposalId: string;
      slot: number;
      basis: string;
    } | null>(null),
    [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const attempt = useRef<{ proposalId: string; input: BookingChoice; key: string } | null>(null);
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Zurich",
    }).format(new Date(value));
  const current = !unavailable && !query.isError && !blocked && !error ? query.data : undefined;
  const slot = current?.proposals.find((p) => p.id === selection?.proposalId)?.slots[
    selection?.slot ?? -1
  ];
  const changed = !slot?.canBook || slot.basis !== selection?.basis;
  async function send() {
    if (pending || blocked || !attempt.current) return;
    setPending(true);
    onBusy(true);
    setError("");
    try {
      const a = attempt.current,
        value = await partnerApi.reserveBooking(leadId, a.proposalId, a.input, {
          csrfToken: identity.csrfToken,
          idempotencyKey: a.key,
        });
      await client.cancelQueries({ queryKey });
      client.setQueryData(queryKey, value);
      setSaved(true);
      setSelection(null);
      attempt.current = null;
      onBusy(false);
      void client.invalidateQueries({ queryKey: root });
    } catch (cause) {
      const definitive =
        cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
      setBlocked(definitive);
      setError(t(definitive ? "booking.conflict" : "booking.uncertain"));
      if (definitive) onBusy(false);
      client.removeQueries({ queryKey });
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className="space-y-4 border-b border-border pb-4"
      aria-labelledby="booking-choices-title"
    >
      <h3 id="booking-choices-title" className="font-medium">
        {t("booking.title")}
      </h3>
      <p className="text-sm text-muted-foreground">{t("booking.description")}</p>
      {saved && <p role="status">{t("booking.success")}</p>}
      {(query.isError || error) && <p role="alert">{error || t("booking.failed")}</p>}
      {query.isPending && !error && <p role="status">{t("loading")}</p>}
      {!!attempt.current && !blocked && (
        <Button disabled={pending} onClick={() => void send()}>
          {t(pending ? "booking.sending" : "booking.retryExact")}
        </Button>
      )}
      {(query.isError || blocked) && !(attempt.current && !blocked) && (
        <Button
          onClick={() => {
            attempt.current = null;
            setBlocked(false);
            setError("");
            setSelection(null);
            void query.refetch();
          }}
        >
          {t("retry")}
        </Button>
      )}
      {current && (
        <>
          {!current.proposals.length && <p>{t("booking.empty")}</p>}
          <ul className="space-y-3">
            {current.proposals.map((p) => (
              <li key={p.id} className="space-y-3 rounded-lg border border-border p-4">
                <Badge variant="outline">{t(`booking.state.${p.state}`)}</Badge>
                <p>{t("booking.advisor", { name: p.advisorName })}</p>
                <p>{t("booking.expires", { date: date(p.expiresAt) })}</p>
                <ul className="space-y-3">
                  {p.slots.map((s, index) => (
                    <li key={index} className="space-y-2">
                      <p className="font-medium">{date(s.appointment.startsAt)}</p>
                      <p>
                        {t("booking.terms", {
                          duration: s.appointment.durationMinutes,
                          mode: t(`appointmentLinks.mode.${s.appointment.mode}`),
                        })}
                      </p>
                      <p className="break-words">{s.appointment.location}</p>
                      {p.selectedSlot === index && <p>{t("booking.selected")}</p>}
                      {s.canBook && (
                        <Button
                          variant="outline"
                          disabled={pending || !!attempt.current}
                          onClick={() => {
                            setSaved(false);
                            setSelection({ proposalId: p.id, slot: index, basis: s.basis });
                          }}
                        >
                          {t("booking.choose", { date: date(s.appointment.startsAt) })}
                        </Button>
                      )}
                      {p.state === "offered" && !s.canBook && (
                        <p className="text-sm">{t("booking.unavailable")}</p>
                      )}
                      {selection?.proposalId === p.id && selection.slot === index && (
                        <form
                          className="space-y-3"
                          key={selection.basis + index}
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (changed || pending || attempt.current) return;
                            attempt.current = {
                              proposalId: p.id,
                              input: { slot: index, basis: selection.basis, confirmed: true },
                              key: crypto.randomUUID(),
                            };
                            void send();
                          }}
                        >
                          <p>{t("booking.confirmHelp")}</p>
                          {changed && <p role="alert">{t("booking.conflict")}</p>}
                          <label className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              required
                              disabled={changed || pending || !!attempt.current}
                            />
                            <span>{t("booking.confirm")}</span>
                          </label>
                          <Button type="submit" disabled={changed || pending || !!attempt.current}>
                            {t("booking.reserve")}
                          </Button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {current.proposals.length === 20 && <p>{t("booking.limit")}</p>}
        </>
      )}
    </section>
  );
}
