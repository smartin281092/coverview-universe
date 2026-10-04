import { useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  professionalAvailabilityInputSchema,
  leadAppointmentModeSchema,
  type ProfessionalAvailabilityInput,
  type ProfessionalAvailabilityDossier,
} from "@coverview/contracts/partner";
import { PartnerApiError } from "@coverview/api-client/partner";
import { Button, Input, Label } from "@coverview/ui";
import { usePartner } from "./PartnerSession";
import { partnerApi } from "../api";
import { localDateTime, zurichInstant } from "./Field";

// This form requires an unambiguous wall time. The common appointment helper
// rejects nonexistent times; detect both occurrences of the Swiss autumn hour too.
function instant(value: string) {
  const result = zurichInstant(value);
  const time = Date.parse(result);
  if (
    [-3600000, 3600000].some(
      (delta) => localDateTime(new Date(time + delta).toISOString()) === value,
    )
  )
    throw new Error("Ambiguous local time");
  return result;
}
const formSchema = z
  .object({
    modes: z.array(leadAppointmentModeSchema),
    periods: z.array(
      z.object({ kind: z.enum(["available", "absent"]), startsAt: z.string(), endsAt: z.string() }),
    ),
    confirmed: z.boolean(),
  })
  .superRefine((values, context) => {
    try {
      const parsed = professionalAvailabilityInputSchema.safeParse({
        ...values,
        revision: 0,
        professionalRevision: 1,
        timezone: "Europe/Zurich",
        periods: values.periods.map((period) => ({
          ...period,
          startsAt: instant(period.startsAt),
          endsAt: instant(period.endsAt),
        })),
      });
      if (!parsed.success) context.addIssue({ code: "custom", message: "PARTNER_ACTION_REQUIRED" });
    } catch {
      context.addIssue({ code: "custom", message: "PARTNER_ACTION_REQUIRED" });
    }
  });

export function AvailabilityForm({
  initial,
  current,
  onSaved,
  onBack,
  onBusy,
}: {
  initial: ProfessionalAvailabilityDossier;
  current: ProfessionalAvailabilityDossier;
  onSaved: (result: ProfessionalAvailabilityDossier) => void;
  onBack: () => void;
  onBusy: (value: boolean) => void;
}) {
  const { t } = useTranslation(),
    { identity } = usePartner();
  const [error, setError] = useState(""),
    [blocked, setBlocked] = useState(false),
    [frozen, setFrozen] = useState(false);
  const attempt = useRef<{ input: ProfessionalAvailabilityInput; key: string } | null>(null);
  const applicable = initial.current?.professionalScope === "current" ? initial.current : null;
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      modes: applicable?.modes ?? [],
      periods: (applicable?.periods ?? []).map((period) => ({
        ...period,
        startsAt: localDateTime(period.startsAt),
        endsAt: localDateTime(period.endsAt),
      })),
      confirmed: false,
    },
  });
  const fields = useFieldArray({ control: form.control, name: "periods" });
  const modes = form.watch("modes");
  const changed =
    current.professionalRevision !== initial.professionalRevision ||
    (current.current?.revision ?? 0) !== (initial.current?.revision ?? 0) ||
    !current.canDeclare;
  const pending = form.formState.isSubmitting;
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || blocked || (changed && !attempt.current)) return;
        void form.handleSubmit(async (values) => {
          attempt.current ??= {
            input: professionalAvailabilityInputSchema.parse({
              ...values,
              revision: initial.current?.revision ?? 0,
              professionalRevision: initial.professionalRevision,
              timezone: "Europe/Zurich",
              periods: values.periods.map((period) => ({
                ...period,
                startsAt: instant(period.startsAt),
                endsAt: instant(period.endsAt),
              })),
            }),
            key: crypto.randomUUID(),
          };
          setFrozen(true);
          setError("");
          onBusy(true);
          try {
            onSaved(
              await partnerApi.declareAvailability(initial.userId, attempt.current.input, {
                csrfToken: identity.csrfToken,
                idempotencyKey: attempt.current.key,
              }),
            );
          } catch (cause) {
            const conflict =
              cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
            setBlocked(conflict);
            setError(t(`availability.${conflict ? "conflict" : "retryExact"}`));
          } finally {
            onBusy(false);
          }
        })();
      }}
    >
      <p className="text-sm">
        {t("availability.subject", { name: initial.name, organization: initial.organization })}
      </p>
      {changed && (
        <p role="alert" className="text-sm text-destructive">
          {t("availability.conflict")}
        </p>
      )}
      <fieldset disabled={pending || frozen || changed} className="space-y-5">
        <legend className="sr-only">{t("availability.edit")}</legend>
        <fieldset className="space-y-3">
          <legend className="font-medium">{t("availability.modes")}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {leadAppointmentModeSchema.options.map((mode) => (
              <label key={mode} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={modes.includes(mode)}
                  onChange={(event) =>
                    form.setValue(
                      "modes",
                      event.target.checked
                        ? [...modes, mode]
                        : modes.filter((value) => value !== mode),
                      { shouldValidate: true },
                    )
                  }
                />
                {t(`appointment.${mode}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <section className="space-y-3">
          <h3 className="font-medium">{t("availability.periods")}</h3>
          <p className="text-sm text-muted-foreground">{t("availability.periodHelp")}</p>
          <p className="text-xs text-muted-foreground">{t("availability.timezone")}</p>
          {fields.fields.map((field, index) => (
            <fieldset key={field.id} className="space-y-3 rounded-lg border border-border p-3">
              <legend className="px-2 text-sm">
                {t("availability.periodNumber", { number: index + 1 })}
              </legend>
              <div className="space-y-2">
                <Label htmlFor={`availability-kind-${field.id}`}>{t("availability.kind")}</Label>
                <select
                  id={`availability-kind-${field.id}`}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  {...form.register(`periods.${index}.kind`)}
                >
                  <option value="available">{t("availability.available")}</option>
                  <option value="absent">{t("availability.absent")}</option>
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["startsAt", "endsAt"] as const).map((edge) => (
                  <div key={edge} className="space-y-2">
                    <Label htmlFor={`availability-${edge}-${field.id}`}>
                      {t(`availability.${edge}`)}
                    </Label>
                    <Input
                      id={`availability-${edge}-${field.id}`}
                      type="datetime-local"
                      required
                      {...form.register(`periods.${index}.${edge}`)}
                    />
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" onClick={() => fields.remove(index)}>
                {t("availability.removePeriod", { number: index + 1 })}
              </Button>
            </fieldset>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={fields.fields.length >= 60}
            onClick={() => fields.append({ kind: "available", startsAt: "", endsAt: "" })}
          >
            {t("availability.addPeriod")}
          </Button>
        </section>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" {...form.register("confirmed")} />
          {t("availability.confirm")}
        </label>
      </fieldset>
      {Object.keys(form.formState.errors).length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {t("availability.invalid")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" disabled={pending} onClick={onBack}>
          {t("availability.back")}
        </Button>
        <Button type="submit" disabled={pending || blocked || (changed && !attempt.current)}>
          {t(pending ? "loading" : frozen ? "retry" : "availability.save")}
        </Button>
      </div>
    </form>
  );
}
