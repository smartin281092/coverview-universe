import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import {
  appointmentTimeInputSchema,
  type AppointmentAssessment,
  type AppointmentTimeInput,
} from "@coverview/contracts/partner";
import { PartnerApiError } from "@coverview/api-client/partner";
import { Button, Input, Label } from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { formatDate } from "./Field";

const schema = appointmentTimeInputSchema
  .omit({ basis: true })
  .extend({ confirmed: z.boolean().refine((value) => value) });
export function AppointmentTimeForm({
  initial,
  current,
  onSaved,
  onBack,
  onBusy,
}: {
  initial: AppointmentAssessment;
  current: AppointmentAssessment;
  onSaved: (result: AppointmentAssessment) => void;
  onBack: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const { t } = useTranslation(),
    { identity } = usePartner();
  const [error, setError] = useState(""),
    [blocked, setBlocked] = useState(false),
    [frozen, setFrozen] = useState(false);
  const attempt = useRef<{ input: AppointmentTimeInput; key: string } | null>(null);
  const saved = initial.timeProtection?.current;
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...(saved
        ? {
            preparationMinutes: saved.preparationMinutes,
            travelBeforeMinutes: saved.travelBeforeMinutes,
            travelAfterMinutes: saved.travelAfterMinutes,
          }
        : {}),
      confirmed: false,
    },
  });
  const values = form.watch();
  const pending = form.formState.isSubmitting;
  const changed =
    initial.timeProtection?.basis !== current.timeProtection?.basis ||
    !current.timeProtection?.canConfirm;
  const ready = [
    values.preparationMinutes,
    values.travelBeforeMinutes,
    values.travelAfterMinutes,
  ].every((n) => Number.isFinite(n) && n >= 0 && n <= 240);
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || blocked || (changed && !attempt.current)) return;
        void form.handleSubmit(async (value) => {
          attempt.current ??= {
            input: appointmentTimeInputSchema.parse({
              ...value,
              basis: initial.timeProtection!.basis,
            }),
            key: crypto.randomUUID(),
          };
          setFrozen(true);
          setError("");
          onBusy(true);
          try {
            onSaved(
              await partnerApi.protectAppointmentTime(
                initial.leadId,
                initial.appointmentId,
                attempt.current.input,
                { csrfToken: identity.csrfToken, idempotencyKey: attempt.current.key },
              ),
            );
          } catch (cause) {
            const definitive =
              cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
            setBlocked(definitive);
            setError(t(definitive ? "appointmentTime.conflict" : "availability.retryExact"));
          } finally {
            onBusy(false);
          }
        })();
      }}
    >
      <h3 className="font-medium">{t("appointmentTime.title")}</h3>
      <p className="text-sm text-muted-foreground">{t("appointmentTime.help")}</p>
      <p className="text-sm">
        {t("appointmentAssessment.range", {
          start: formatDate(initial.startsAt),
          end: formatDate(initial.endsAt),
          mode: t(`appointment.${initial.mode}`),
        })}
      </p>
      {changed && (
        <p role="alert" className="text-sm text-destructive">
          {t("appointmentTime.changed")}
        </p>
      )}
      <fieldset disabled={pending || frozen || changed} className="space-y-3">
        <legend className="sr-only">{t("appointmentTime.title")}</legend>
        {(["preparationMinutes", "travelBeforeMinutes", "travelAfterMinutes"] as const).map(
          (field) => (
            <div key={field} className="space-y-1">
              <Label htmlFor={`time-${field}`}>{t(`appointmentTime.${field}`)}</Label>
              <Input
                id={`time-${field}`}
                type="number"
                min={0}
                max={240}
                step={1}
                required
                {...form.register(field, { valueAsNumber: true })}
                aria-invalid={!!form.formState.errors[field]}
              />
            </div>
          ),
        )}
        {ready && (
          <p className="text-sm" role="status">
            {t("appointmentTime.previewRange", {
              start: formatDate(
                new Date(
                  Date.parse(initial.startsAt) -
                    (values.preparationMinutes + values.travelBeforeMinutes) * 60000,
                ).toISOString(),
              ),
              end: formatDate(
                new Date(
                  Date.parse(initial.endsAt) + values.travelAfterMinutes * 60000,
                ).toISOString(),
              ),
            })}
          </p>
        )}
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" {...form.register("confirmed")} />
          {t("appointmentTime.confirm")}
        </label>
      </fieldset>
      {Object.keys(form.formState.errors).length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {t("appointmentTime.invalid")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" disabled={pending} onClick={onBack}>
          {t("appointmentTime.back")}
        </Button>
        <Button type="submit" disabled={pending || blocked || (changed && !attempt.current)}>
          {t(pending ? "loading" : frozen ? "retry" : "appointmentTime.save")}
        </Button>
      </div>
    </form>
  );
}
