import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { PartnerApiError } from "@coverview/api-client/partner";
import {
  walletAppointmentCancellationSchema,
  type WalletAppointment,
  type WalletAppointmentCancellation,
} from "@coverview/contracts/partner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Badge,
  Label,
} from "@coverview/ui";
import { partnerApi } from "../../partner-api";

const confirmation = walletAppointmentCancellationSchema.omit({ basis: true });
const formSchema = confirmation.extend({ confirmed: z.boolean() }).pipe(confirmation);
const privateKey = (identity: IdentityMe) => [
  "private",
  identity.user.id,
  identity.session.id,
  "wallet-leads",
];
const queryPolicy = { gcTime: 0, staleTime: 0, retry: false, refetchInterval: 10000 } as const;

function AppointmentScreen({
  identity,
  leadId,
  appointmentId,
  onBack,
  onBusy,
}: {
  identity: IdentityMe;
  leadId: string;
  appointmentId: string;
  onBack: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const { t, i18n } = useTranslation("offers");
  const client = useQueryClient();
  const queryKey = [...privateKey(identity), "appointment", leadId, appointmentId];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => partnerApi.walletAppointment(leadId, appointmentId, signal),
    ...queryPolicy,
  });
  const [review, setReview] = useState<WalletAppointment | null>(null);
  const [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  // Keep the first command even when a background GET fails or the commitment changes.
  const attempt = useRef<{ input: WalletAppointmentCancellation; key: string } | null>(null);
  const form = useForm<z.input<typeof formSchema>, unknown, z.output<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { reason: "", confirmed: false },
  });
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Zurich",
    }).format(new Date(value));
  const [denied, setDenied] = useState(false);
  const current = query.isError || denied ? undefined : query.data;
  const changed = !!review && (!current?.canCancel || current.basis !== review.basis);
  async function send(input: WalletAppointmentCancellation) {
    if (pending || blocked) return;
    attempt.current ??= { input, key: crypto.randomUUID() };
    setPending(true);
    onBusy(true);
    setError("");
    try {
      const value = await partnerApi.cancelWalletAppointment(
        leadId,
        appointmentId,
        attempt.current.input,
        {
          csrfToken: identity.csrfToken,
          idempotencyKey: attempt.current.key,
        },
      );
      await client.cancelQueries({ queryKey });
      client.setQueryData(queryKey, value);
      setSaved(true);
      void client.invalidateQueries({ queryKey: privateKey(identity) });
    } catch (cause) {
      const definitive =
        cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
      setBlocked(definitive);
      setDenied(cause instanceof PartnerApiError && [401, 403, 404].includes(cause.status));
      setError(t(definitive ? "appointments.conflict" : "appointments.uncertain"));
    } finally {
      setPending(false);
      onBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      {query.isPending ? (
        <p role="status">{t("loading")}</p>
      ) : query.isError || denied ? (
        <div className="space-y-3">
          <p role="alert">{t("appointments.failed")}</p>
          <Button variant="outline" disabled={pending} onClick={() => void query.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : (
        current && (
          <>
            <Badge variant="outline">{t(`appointmentLinks.outcome.${current.state}`)}</Badge>
            <p className="font-medium">{date(current.appointment.startsAt)}</p>
            <p className="break-words">
              {t("appointmentLinks.place", {
                mode: t(`appointmentLinks.mode.${current.appointment.mode}`),
                location: current.appointment.location,
              })}
            </p>
            <p>{t("appointmentLinks.duration", { count: current.appointment.durationMinutes })}</p>
            <p>{t("appointments.advisor", { name: current.advisorName ?? t("coverviewQueue") })}</p>
            {saved ? (
              <p role="status">{t("appointments.success")}</p>
            ) : review ? (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (pending || blocked || changed || attempt.current) return;
                  void form.handleSubmit((values) => send({ ...values, basis: review.basis }))(
                    event,
                  );
                }}
              >
                <p>{t("appointments.consequences")}</p>
                {changed && !attempt.current && <p role="alert">{t("appointments.conflict")}</p>}
                <fieldset disabled={pending || !!attempt.current || changed} className="space-y-4">
                  <legend className="sr-only">{t("appointments.cancel")}</legend>
                  <div className="space-y-2">
                    <Label htmlFor="appointment-cancel-reason">{t("appointments.reason")}</Label>
                    <textarea
                      className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm"
                      id="appointment-cancel-reason"
                      maxLength={1000}
                      aria-invalid={!!form.formState.errors.reason}
                      aria-describedby="appointment-cancel-reason-help"
                      {...form.register("reason")}
                    />
                    <p
                      id="appointment-cancel-reason-help"
                      className="text-sm text-muted-foreground"
                    >
                      {t("appointments.reasonHelp")}
                    </p>
                    {form.formState.errors.reason && (
                      <p role="alert">{t("appointments.invalidReason")}</p>
                    )}
                  </div>
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 size-5 shrink-0"
                      aria-invalid={!!form.formState.errors.confirmed}
                      {...form.register("confirmed")}
                    />
                    <span>{t("appointments.confirm")}</span>
                  </label>
                  {form.formState.errors.confirmed && (
                    <p role="alert">{t("appointments.invalidConfirmation")}</p>
                  )}
                </fieldset>
                {!attempt.current && (
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={pending || blocked || changed}
                  >
                    {t("appointments.confirmButton")}
                  </Button>
                )}
              </form>
            ) : current.canCancel ? (
              <Button variant="outline" onClick={() => setReview(current)}>
                {t("appointments.cancel")}
              </Button>
            ) : (
              <p>{t("appointments.unavailable")}</p>
            )}
          </>
        )
      )}
      {error && <p role="alert">{error}</p>}
      {!!attempt.current && !saved && !blocked && (
        <Button disabled={pending} onClick={() => void send(attempt.current!.input)}>
          {t(pending ? "appointments.sending" : "appointments.retryExact")}
        </Button>
      )}
      <Button
        variant="outline"
        disabled={pending || (!!attempt.current && !saved && !blocked)}
        onClick={onBack}
      >
        {t("appointments.back")}
      </Button>
    </div>
  );
}

export function WalletAppointmentsDialog({
  leadId,
  identity,
  onClose,
}: {
  leadId: string;
  identity: IdentityMe;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("offers");
  const [appointmentId, setAppointmentId] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const list = useQuery({
    queryKey: [...privateKey(identity), "appointments", leadId],
    queryFn: ({ signal }) => partnerApi.lead(leadId, signal, true),
    ...queryPolicy,
  });
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Zurich",
    }).format(new Date(value));
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        closeLabel={t("close")}
        showCloseButton={!busy}
        className="max-h-[90svh] overflow-y-auto sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>{t("appointments.title")}</DialogTitle>
          <DialogDescription>{t("appointments.description")}</DialogDescription>
        </DialogHeader>
        {appointmentId ? (
          <AppointmentScreen
            key={appointmentId}
            identity={identity}
            leadId={leadId}
            appointmentId={appointmentId}
            onBack={() => setAppointmentId(null)}
            onBusy={setBusy}
          />
        ) : list.isPending ? (
          <p role="status">{t("loading")}</p>
        ) : list.isError ? (
          <div className="space-y-3">
            <p role="alert">{t("appointments.failed")}</p>
            <Button onClick={() => void list.refetch()}>{t("retry")}</Button>
          </div>
        ) : (
          <>
            <p className="font-medium">{list.data.title}</p>
            {!list.data.appointments.length && <p>{t("appointments.empty")}</p>}
            <ul className="space-y-3">
              {list.data.appointments.map((appointment) => (
                <li key={appointment.id} className="space-y-3 rounded-lg border border-border p-4">
                  <Badge variant="outline">
                    {t(`appointmentLinks.outcome.${appointment.state}`)}
                  </Badge>
                  <p>{date(appointment.startsAt)}</p>
                  <Button variant="outline" onClick={() => setAppointmentId(appointment.id)}>
                    {t("appointments.details")}
                  </Button>
                </li>
              ))}
            </ul>
            {list.data.appointments.length === 100 && <p>{t("appointments.limit")}</p>}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
