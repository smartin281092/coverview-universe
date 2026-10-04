import { useRef, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { coordinatedBookingInputSchema } from "@coverview/contracts/partner";
import type { IdentityMe } from "@coverview/api-client";
import { PartnerApiError } from "@coverview/api-client/partner";
import type {
  BookingProposals,
  CoordinatedBookingInput,
  CoordinatedBookingReceipt,
  LeadSummary,
} from "@coverview/contracts/partner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@coverview/ui";
import { partnerApi } from "../../partner-api";

type Selection = { lead: LeadSummary; proposalId: string; slot: number; basis: string };
const policy = { gcTime: 0, staleTime: 0, retry: false, refetchInterval: 10000 } as const;
const confirmationSchema = z
  .object({ confirmed: z.boolean() })
  .pipe(z.object({ confirmed: coordinatedBookingInputSchema.shape.confirmed }));

export function CoordinatedBookingsDialog({
  identity,
  scope,
  onClose,
}: {
  identity: IdentityMe;
  scope: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("offers"),
    client = useQueryClient();
  const root = ["private", identity.user.id, identity.session.id, "wallet-leads"];
  const [cursor, setCursor] = useState<string>(),
    [inspect, setInspect] = useState<LeadSummary | null>(null);
  const [selection, setSelection] = useState<Selection[]>([]),
    [review, setReview] = useState(false);
  const [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState("");
  const [receipt, setReceipt] = useState<CoordinatedBookingReceipt | null>(null);
  const attempt = useRef<{ input: CoordinatedBookingInput; key: string } | null>(null);
  const form = useForm<
    z.input<typeof confirmationSchema>,
    unknown,
    z.output<typeof confirmationSchema>
  >({ resolver: zodResolver(confirmationSchema), defaultValues: { confirmed: false } });
  const uncertain = !!attempt.current && !blocked && !receipt;
  const list = useQuery({
    queryKey: [...root, "coordination-list", scope, cursor],
    queryFn: ({ signal }) =>
      partnerApi.list(
        {
          view: "all",
          ...(scope === "all" ? {} : { clientProfileId: scope }),
          ...(cursor ? { cursor } : {}),
        },
        signal,
        true,
      ),
    ...policy,
  });
  const queried = useQueries({
    queries: [
      ...new Set([...selection.map((s) => s.lead.id), ...(inspect ? [inspect.id] : [])]),
    ].map((id) => ({
      queryKey: [...root, "booking-proposals", id],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        partnerApi.bookingProposals(id, true, signal),
      ...policy,
    })),
  });
  const ids = [...new Set([...selection.map((s) => s.lead.id), ...(inspect ? [inspect.id] : [])])];
  const data = (id: string): BookingProposals | undefined => {
    const query = queried[ids.indexOf(id)];
    return !blocked && !query?.isError ? query?.data : undefined;
  };
  const current = (s: Selection) => data(s.lead.id)?.proposals.find((p) => p.id === s.proposalId);
  const changed = selection.some((s) => {
    const p = current(s),
      slot = p?.slots[s.slot];
    return p?.state !== "offered" || !slot?.canBook || slot.basis !== s.basis;
  });
  const date = (v: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Zurich",
    }).format(new Date(v));
  function terms(slot: BookingProposals["proposals"][number]["slots"][number]) {
    return (
      <>
        <p className="font-medium">{date(slot.appointment.startsAt)}</p>
        <p>
          {t("booking.terms", {
            duration: slot.appointment.durationMinutes,
            mode: t(`appointmentLinks.mode.${slot.appointment.mode}`),
          })}
        </p>
        <p className="break-words">{slot.appointment.location}</p>
      </>
    );
  }
  async function send() {
    if (pending || blocked || !attempt.current) return;
    setPending(true);
    setError("");
    try {
      const value = await partnerApi.reserveCoordinatedBookings(attempt.current.input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: attempt.current.key,
      });
      await client.cancelQueries({ queryKey: root });
      setReceipt(value);
      attempt.current = null;
      void client.invalidateQueries({ queryKey: root });
    } catch (cause) {
      const definitive =
        cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
      setBlocked(definitive);
      setError(t(definitive ? "coordination.conflict" : "booking.uncertain"));
      for (const id of ids) client.removeQueries({ queryKey: [...root, "booking-proposals", id] });
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !pending && !uncertain) onClose();
      }}
    >
      <DialogContent
        closeLabel={t("close")}
        showCloseButton={!pending && !uncertain}
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>{t("coordination.title")}</DialogTitle>
          <DialogDescription>{t("coordination.description")}</DialogDescription>
        </DialogHeader>
        {error && <p role="alert">{error}</p>}
        {receipt && queried.some((q) => q.isError) ? (
          <>
            <p role="alert">{t("booking.failed")}</p>
            <Button
              onClick={() => {
                for (const q of queried) void q.refetch();
              }}
            >
              {t("retry")}
            </Button>
          </>
        ) : receipt ? (
          <div className="space-y-4">
            <p role="status">{t("coordination.success")}</p>
            <p className="break-all text-sm">{t("coordination.receipt", { id: receipt.id })}</p>
            <ul className="space-y-4">
              {receipt.items.map((item) => (
                <li key={item.leadId} className="rounded-lg border p-4">
                  <p>{selection.find((s) => s.lead.id === item.leadId)?.lead.title}</p>
                  <p>{t("booking.advisor", { name: item.proposal.advisorName })}</p>
                  {item.proposal.selectedSlot !== null &&
                    item.proposal.slots[item.proposal.selectedSlot] &&
                    terms(item.proposal.slots[item.proposal.selectedSlot]!)}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            {uncertain && (
              <Button disabled={pending} onClick={() => void send()}>
                {t(pending ? "booking.sending" : "booking.retryExact")}
              </Button>
            )}
            {blocked && (
              <Button
                onClick={() => {
                  attempt.current = null;
                  setBlocked(false);
                  setError("");
                  setSelection([]);
                  setReview(false);
                  setInspect(null);
                  void list.refetch();
                }}
              >
                {t("retry")}
              </Button>
            )}
            {!uncertain && !blocked && (
              <>
                {!!selection.length && (
                  <section className="space-y-3" aria-labelledby="coordination-selected">
                    <h3 id="coordination-selected" className="font-medium">
                      {t("coordination.selected", { count: selection.length })}
                    </h3>
                    <ul className="space-y-3">
                      {selection.map((s) => {
                        const p = current(s),
                          slot = p?.slots[s.slot];
                        return (
                          <li key={s.lead.id} className="space-y-2 rounded-lg border p-4">
                            {p && slot ? (
                              <>
                                <p>{s.lead.title}</p>
                                <p>{t("booking.advisor", { name: p.advisorName })}</p>
                                {terms(slot)}
                                <p>{t("booking.expires", { date: date(p.expiresAt) })}</p>
                              </>
                            ) : (
                              <p role="alert">{t("booking.failed")}</p>
                            )}
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelection(selection.filter((v) => v.lead.id !== s.lead.id));
                                setReview(false);
                              }}
                            >
                              {t("coordination.remove")}
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
                {changed && <p role="alert">{t("coordination.changed")}</p>}
                {review ? (
                  <form
                    key={selection.map((s) => s.basis).join(":")}
                    className="space-y-4"
                    onSubmit={(e) =>
                      void form.handleSubmit(() => {
                        if (changed || pending || selection.length < 2 || attempt.current) return;
                        attempt.current = {
                          key: crypto.randomUUID(),
                          input: {
                            choices: selection.map((s) => ({
                              leadId: s.lead.id,
                              proposalId: s.proposalId,
                              slot: s.slot,
                              basis: s.basis,
                              confirmed: true,
                            })),
                            confirmed: true,
                          },
                        };
                        void send();
                      })(e)
                    }
                  >
                    <p>{t("coordination.confirmHelp")}</p>
                    <label className="flex items-start gap-3">
                      <input type="checkbox" disabled={changed} {...form.register("confirmed")} />
                      <span>{t("coordination.confirm")}</span>
                    </label>
                    {form.formState.errors.confirmed && (
                      <p role="alert">{t("coordination.confirmRequired")}</p>
                    )}
                    <div className="flex flex-wrap gap-3">
                      <Button type="submit" disabled={changed || pending}>
                        {t("coordination.reserve")}
                      </Button>
                      <Button variant="outline" onClick={() => setReview(false)}>
                        {t("coordination.edit")}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    {inspect ? (
                      <section className="space-y-3">
                        {data(inspect.id) && <h3 className="font-medium">{inspect.title}</h3>}
                        {data(inspect.id)
                          ?.proposals.filter((p) => p.state === "offered")
                          .map((p) => (
                            <div key={p.id} className="space-y-3">
                              <p>{t("booking.advisor", { name: p.advisorName })}</p>
                              {p.slots.map((slot, index) => (
                                <div key={index} className="space-y-2 rounded-lg border p-4">
                                  {terms(slot)}
                                  {!slot.canBook && <p>{t("booking.unavailable")}</p>}
                                  <Button
                                    disabled={!slot.canBook}
                                    onClick={() => {
                                      setSelection([
                                        ...selection.filter((s) => s.lead.id !== inspect.id),
                                        {
                                          lead: inspect,
                                          proposalId: p.id,
                                          slot: index,
                                          basis: slot.basis,
                                        },
                                      ]);
                                      setInspect(null);
                                    }}
                                  >
                                    {t("coordination.add")}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ))}
                        {!data(inspect.id) ? (
                          queried[ids.indexOf(inspect.id)]?.isPending ? (
                            <p role="status">{t("loading")}</p>
                          ) : (
                            <>
                              <p role="alert">{t("booking.failed")}</p>
                              <Button
                                onClick={() => void queried[ids.indexOf(inspect.id)]?.refetch()}
                              >
                                {t("retry")}
                              </Button>
                            </>
                          )
                        ) : (
                          !data(inspect.id)?.proposals.some((p) => p.state === "offered") && (
                            <p>{t("booking.empty")}</p>
                          )
                        )}
                        <Button variant="outline" onClick={() => setInspect(null)}>
                          {t("appointments.back")}
                        </Button>
                      </section>
                    ) : (
                      <section className="space-y-3">
                        <h3 className="font-medium">{t("coordination.choose")}</h3>
                        {list.isPending ? (
                          <p role="status">{t("loading")}</p>
                        ) : list.isError ? (
                          <>
                            <p role="alert">{t("error")}</p>
                            <Button onClick={() => void list.refetch()}>{t("retry")}</Button>
                          </>
                        ) : (
                          <>
                            {!list.data.items.length && <p>{t("empty")}</p>}
                            <ul className="space-y-2">
                              {list.data.items
                                .filter((l) => !["draft", "completed"].includes(l.stage))
                                .map((l) => (
                                  <li key={l.id}>
                                    <Button
                                      variant="outline"
                                      className="h-auto w-full justify-start whitespace-normal text-left"
                                      disabled={
                                        selection.length >= 5 ||
                                        selection.some((s) => s.lead.id === l.id) ||
                                        (!!selection.length &&
                                          l.clientProfileId !== selection[0]!.lead.clientProfileId)
                                      }
                                      onClick={() => setInspect(l)}
                                    >
                                      {t("coordination.request", {
                                        client: l.clientName,
                                        title: l.title,
                                      })}
                                    </Button>
                                  </li>
                                ))}
                            </ul>
                            <div className="flex gap-3">
                              {cursor && (
                                <Button variant="outline" onClick={() => setCursor(undefined)}>
                                  {t("coordination.first")}
                                </Button>
                              )}
                              {list.data.nextCursor && (
                                <Button
                                  variant="outline"
                                  onClick={() => setCursor(list.data.nextCursor ?? undefined)}
                                >
                                  {t("coordination.next")}
                                </Button>
                              )}
                            </div>
                          </>
                        )}
                      </section>
                    )}
                    <Button
                      disabled={selection.length < 2 || changed || !!inspect}
                      onClick={() => {
                        form.reset({ confirmed: false });
                        setReview(true);
                      }}
                    >
                      {t("coordination.review")}
                    </Button>
                  </>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
