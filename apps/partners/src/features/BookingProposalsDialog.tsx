import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  bookingProposalInputSchema,
  type BookingProposalInput,
  type LeadDetail,
  type PersonalAppointmentPreview,
} from "@coverview/contracts/partner";
import { PartnerApiError } from "@coverview/api-client/partner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Label,
  Badge,
} from "@coverview/ui";
import { usePartner } from "./PartnerSession";
import { PersonalAppointmentDialog } from "./PersonalAppointmentDialog";
import { formatDate, localDateTime, zurichInstant } from "./Field";
import { partnerApi } from "../api";

export function BookingProposalsDialog({
  lead,
  onClose,
  unavailable = false,
}: {
  lead: LeadDetail;
  onClose: () => void;
  unavailable?: boolean;
}) {
  const { t } = useTranslation(),
    session = usePartner(),
    client = useQueryClient();
  const queryKey = [...session.queryKey, "booking-proposals", lead.id];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => partnerApi.bookingProposals(lead.id, false, signal),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 10000,
  });
  const [slots, setSlots] = useState<PersonalAppointmentPreview[]>([]),
    [adding, setAdding] = useState(false),
    [expires, setExpires] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [blocked, setBlocked] = useState(false),
    [withdrawing, setWithdrawing] = useState<string | null>(null);
  const attempt = useRef<
    { key: string; input: BookingProposalInput } | { key: string; proposalId: string } | null
  >(null);
  const [invalid, setInvalid] = useState(false);
  const uncertain = !!attempt.current && !blocked;
  async function send() {
    const current = attempt.current;
    if (!current || pending) return;
    setPending(true);
    setError("");
    try {
      const options = { csrfToken: session.identity.csrfToken, idempotencyKey: current.key };
      const value =
        "input" in current
          ? await partnerApi.proposeBooking(lead.id, current.input, options)
          : await partnerApi.withdrawBooking(lead.id, current.proposalId, options);
      await client.cancelQueries({ queryKey });
      client.setQueryData(queryKey, value);
      attempt.current = null;
      setSlots([]);
      setWithdrawing(null);
      void client.invalidateQueries({ queryKey: session.queryKey });
    } catch (cause) {
      const definitive =
        cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
      setBlocked(definitive);
      setError(t(definitive ? "booking.conflict" : "booking.uncertain"));
      client.removeQueries({ queryKey });
      setSlots([]);
    } finally {
      setPending(false);
    }
  }
  if (adding && !unavailable)
    return (
      <PersonalAppointmentDialog
        lead={lead}
        onClose={() => setAdding(false)}
        onSelect={(value) => {
          setSlots((items) => [...items, value]);
          setAdding(false);
        }}
      />
    );
  const visible = !unavailable && !query.isError && !blocked && !error ? query.data : undefined;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending && !uncertain) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!pending && !uncertain}
        className="max-h-[90svh] overflow-y-auto sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>{t("booking.title")}</DialogTitle>
          <DialogDescription>{t("booking.description")}</DialogDescription>
        </DialogHeader>
        {(query.isError || error) && <p role="alert">{error || t("booking.failed")}</p>}
        {query.isPending && !error && <p role="status">{t("loading")}</p>}
        {(blocked || query.isError) && !uncertain && (
          <Button
            onClick={() => {
              setBlocked(false);
              setError("");
              attempt.current = null;
              void query.refetch();
            }}
          >
            {t("retry")}
          </Button>
        )}
        {uncertain && !pending && (
          <Button onClick={() => void send()}>{t("booking.retryExact")}</Button>
        )}
        {visible && (
          <>
            <ul className="space-y-3">
              {visible.proposals.map((p) => (
                <li key={p.id} className="space-y-2 rounded-lg border border-border p-3">
                  <Badge variant="outline">{t(`booking.state.${p.state}`)}</Badge>
                  <p>{t("booking.expires", { date: formatDate(p.expiresAt) })}</p>
                  <ul>
                    {p.slots.map((s, index) => (
                      <li key={index} className="py-2">
                        <p>
                          {t("booking.terms", {
                            date: formatDate(s.appointment.startsAt),
                            duration: s.appointment.durationMinutes,
                            mode: t(`appointment.${s.appointment.mode}`),
                          })}
                        </p>
                        <p className="break-words">{s.appointment.location}</p>
                        {p.selectedSlot === index && <p>{t("booking.selected")}</p>}
                      </li>
                    ))}
                  </ul>
                  {p.canWithdraw && !withdrawing && (
                    <Button
                      variant="outline"
                      disabled={pending || uncertain}
                      onClick={() => setWithdrawing(p.id)}
                    >
                      {t("booking.withdraw")}
                    </Button>
                  )}
                  {withdrawing === p.id && (
                    <form
                      className="space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (pending || attempt.current) return;
                        attempt.current = { key: crypto.randomUUID(), proposalId: p.id };
                        void send();
                      }}
                    >
                      <label className="flex items-start gap-3">
                        <input type="checkbox" required disabled={pending || uncertain} />
                        <span>{t("booking.withdrawConfirm")}</span>
                      </label>
                      <Button type="submit" disabled={pending || uncertain}>
                        {t("booking.withdraw")}
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            {!visible.proposals.length && <p>{t("booking.empty")}</p>}
            {visible.proposals.length === 20 && <p>{t("booking.limit")}</p>}
            {visible.canPropose && (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (pending || attempt.current) return;
                  try {
                    const expiresAt = zurichInstant(expires);
                    if (
                      [-3600000, 3600000].some(
                        (delta) =>
                          localDateTime(new Date(Date.parse(expiresAt) + delta).toISOString()) ===
                          expires,
                      )
                    )
                      throw Error("Ambiguous time");
                    const input = bookingProposalInputSchema.parse({
                      slots: slots.map((s) => ({ ...s.proposal, basis: s.basis })),
                      expiresAt,
                      offeredConfirmed: true,
                      externalCommitmentsChecked: true,
                      capacityConfirmed: true,
                      preparationAndTravelChecked: true,
                    });
                    attempt.current = { input, key: crypto.randomUUID() };
                    void send();
                  } catch {
                    setInvalid(true);
                  }
                }}
              >
                <h3 className="font-medium">{t("booking.new")}</h3>
                {invalid && <p role="alert">{t("booking.invalid")}</p>}
                <ul>
                  {slots.map((s, index) => (
                    <li key={index} className="space-y-2 border-b py-3">
                      <p>
                        {t("booking.terms", {
                          date: formatDate(s.proposal.appointment.startsAt),
                          duration: s.proposal.appointment.durationMinutes,
                          mode: t(`appointment.${s.proposal.appointment.mode}`),
                        })}
                      </p>
                      <p>{s.proposal.appointment.location}</p>
                      <p>
                        {t("appointmentTime.previewRange", {
                          start: formatDate(s.occupiedStartsAt),
                          end: formatDate(s.occupiedEndsAt),
                        })}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setSlots((items) => items.filter((_, i) => i !== index))}
                      >
                        {t("booking.remove")}
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || uncertain || slots.length >= 5}
                  onClick={() => setAdding(true)}
                >
                  {t("booking.addSlot")}
                </Button>
                <Label htmlFor="booking-expiry">{t("booking.expiry")}</Label>
                <Input
                  id="booking-expiry"
                  type="datetime-local"
                  required
                  value={expires}
                  onChange={(e) => setExpires(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">{t("booking.expiryHelp")}</p>
                {(
                  [
                    "offeredConfirmed",
                    "externalCommitmentsChecked",
                    "capacityConfirmed",
                    "preparationAndTravelChecked",
                  ] as const
                ).map((name) => (
                  <label className="flex items-start gap-3 text-sm" key={name}>
                    <input type="checkbox" required disabled={pending || uncertain} />
                    <span>
                      {t(
                        name === "offeredConfirmed"
                          ? "booking.offeredConfirmed"
                          : `personalAppointment.${name}`,
                      )}
                    </span>
                  </label>
                ))}
                <p className="text-sm text-muted-foreground">{t("personalAppointment.limits")}</p>
                <Button type="submit" disabled={pending || uncertain || !slots.length}>
                  {t(pending ? "loading" : "booking.publish")}
                </Button>
              </form>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
