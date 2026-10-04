import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  personalAppointmentProposalSchema,
  personalAppointmentConfirmSchema,
  leadAppointmentModeSchema,
  type LeadDetail,
  type PersonalAppointmentPreview,
  type PersonalAppointmentConfirm,
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
} from "@coverview/ui";
import { usePartner } from "./PartnerSession";
import { partnerApi } from "../api";
import { formatDate, localDateTime, zurichInstant } from "./Field";

function instant(value: string) {
  const result = zurichInstant(value);
  if (
    [-3600000, 3600000].some(
      (delta) => localDateTime(new Date(Date.parse(result) + delta).toISOString()) === value,
    )
  )
    throw new Error("Ambiguous local time");
  return result;
}
const fields = personalAppointmentProposalSchema
  .extend({
    appointment: personalAppointmentProposalSchema.shape.appointment.extend({
      startsAt: z.string().min(1),
    }),
  })
  .superRefine((value, ctx) => {
    try {
      instant(value.appointment.startsAt);
    } catch {
      ctx.addIssue({
        code: "custom",
        path: ["appointment", "startsAt"],
        message: "Invalid local time",
      });
    }
  });
const attestationNames = [
  "clientAgreementConfirmed",
  "externalCommitmentsChecked",
  "capacityConfirmed",
  "preparationAndTravelChecked",
] as const;
const confirmationFields = personalAppointmentConfirmSchema
  .pick({
    clientAgreementConfirmed: true,
    externalCommitmentsChecked: true,
    capacityConfirmed: true,
    preparationAndTravelChecked: true,
  })
  .extend({
    clientAgreementConfirmed: z.boolean().refine((value) => value),
    externalCommitmentsChecked: z.boolean().refine((value) => value),
    capacityConfirmed: z.boolean().refine((value) => value),
    preparationAndTravelChecked: z.boolean().refine((value) => value),
  });

export function PersonalAppointmentDialog({
  lead,
  onClose,
  appointment,
}: {
  lead: LeadDetail;
  onClose: () => void;
  appointment?: LeadDetail["appointments"][number];
}) {
  const { t } = useTranslation(),
    session = usePartner(),
    client = useQueryClient();
  const [preview, setPreview] = useState<PersonalAppointmentPreview | null>(null);
  const [error, setError] = useState(""),
    [uncertain, setUncertain] = useState(false),
    [denied, setDenied] = useState(false);
  const attempt = useRef<{ input: PersonalAppointmentConfirm; key: string } | null>(null);
  const form = useForm<z.infer<typeof fields>>({
    resolver: zodResolver(fields),
    defaultValues: {
      appointment: appointment
        ? {
            startsAt: localDateTime(appointment.startsAt),
            durationMinutes: appointment.durationMinutes,
            mode: appointment.mode,
            location: appointment.location,
            timezone: appointment.timezone,
          }
        : { startsAt: "", timezone: "Europe/Zurich", location: "" },
    },
  });
  const confirmation = useForm<z.infer<typeof confirmationFields>>({
    resolver: zodResolver(confirmationFields),
    defaultValues: {
      clientAgreementConfirmed: false,
      externalCommitmentsChecked: false,
      capacityConfirmed: false,
      preparationAndTravelChecked: false,
    },
  });
  const pending = form.formState.isSubmitting || confirmation.formState.isSubmitting;
  async function confirm(values: z.infer<typeof confirmationFields>) {
    if (!attempt.current && preview)
      attempt.current = {
        input: personalAppointmentConfirmSchema.parse({
          ...preview.proposal,
          basis: preview.basis,
          ...values,
        }),
        key: crypto.randomUUID(),
      };
    if (!attempt.current) return;
    setError("");
    try {
      const options = {
        csrfToken: session.identity.csrfToken,
        idempotencyKey: attempt.current.key,
      };
      const result = appointment
        ? await partnerApi.confirmPersonalRescheduling(
            lead.id,
            appointment.id,
            attempt.current.input,
            options,
          )
        : await partnerApi.confirmPersonalAppointment(lead.id, attempt.current.input, options);
      attempt.current = null;
      client.setQueryData([...session.queryKey, "lead", lead.id], result);
      void client.invalidateQueries({ queryKey: session.queryKey });
      onClose();
    } catch (cause) {
      const definitive =
        cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
      setPreview(null); // Never keep private source information visible after an access/error response.
      setUncertain(!definitive);
      setDenied(definitive);
      if (definitive) attempt.current = null;
      setError(t(definitive ? "personalAppointment.failed" : "personalAppointment.uncertain"));
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending && !attempt.current) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {t(appointment ? "personalRescheduling.title" : "personalAppointment.title")}
          </DialogTitle>
          <DialogDescription>
            {t(
              appointment ? "personalRescheduling.description" : "personalAppointment.description",
              { client: lead.clientName, lead: lead.title },
            )}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {uncertain ? (
          <form
            onSubmit={(event) => {
              void confirmation.handleSubmit(confirm)(event);
            }}
          >
            <Button type="submit" disabled={pending}>
              {t(pending ? "loading" : "retry")}
            </Button>
          </form>
        ) : denied ? (
          <Button
            variant="outline"
            onClick={() => {
              setDenied(false);
              setError("");
            }}
          >
            {t("personalAppointment.edit")}
          </Button>
        ) : !preview ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              void form.handleSubmit(async (values) => {
                setError("");
                confirmation.reset();
                try {
                  const proposal = personalAppointmentProposalSchema.parse({
                    ...values,
                    appointment: {
                      ...values.appointment,
                      startsAt: instant(values.appointment.startsAt),
                    },
                  });
                  const options = {
                    csrfToken: session.identity.csrfToken,
                    idempotencyKey: crypto.randomUUID(),
                  };
                  setPreview(
                    appointment
                      ? await partnerApi.previewPersonalRescheduling(
                          lead.id,
                          appointment.id,
                          proposal,
                          options,
                        )
                      : await partnerApi.previewPersonalAppointment(lead.id, proposal, options),
                  );
                } catch {
                  setError(t("personalAppointment.previewError"));
                }
              })(event);
            }}
          >
            <fieldset disabled={pending} className="space-y-3">
              <legend className="sr-only">{t("personalAppointment.title")}</legend>
              <div className="space-y-1">
                <Label htmlFor="personal-start">{t("personalAppointment.startsAt")}</Label>
                <Input
                  id="personal-start"
                  type="datetime-local"
                  required
                  {...form.register("appointment.startsAt")}
                  aria-invalid={!!form.formState.errors.appointment?.startsAt}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="personal-duration">{t("personalAppointment.duration")}</Label>
                <Input
                  id="personal-duration"
                  type="number"
                  min={15}
                  max={240}
                  step={1}
                  required
                  {...form.register("appointment.durationMinutes", { valueAsNumber: true })}
                  aria-invalid={!!form.formState.errors.appointment?.durationMinutes}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="personal-mode">{t("advice.mode")}</Label>
                <select
                  id="personal-mode"
                  required
                  {...form.register("appointment.mode")}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>
                    {t("personalAppointment.chooseMode")}
                  </option>
                  {leadAppointmentModeSchema.options.map((mode) => (
                    <option key={mode} value={mode}>
                      {t(`appointment.${mode}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="personal-location">{t("personalAppointment.location")}</Label>
                <Input
                  id="personal-location"
                  required
                  minLength={3}
                  maxLength={1000}
                  {...form.register("appointment.location")}
                  aria-invalid={!!form.formState.errors.appointment?.location}
                />
              </div>
              <p className="text-sm text-muted-foreground">{t("appointmentTime.help")}</p>
              {(["preparationMinutes", "travelBeforeMinutes", "travelAfterMinutes"] as const).map(
                (name) => (
                  <div key={name} className="space-y-1">
                    <Label htmlFor={`personal-${name}`}>{t(`appointmentTime.${name}`)}</Label>
                    <Input
                      id={`personal-${name}`}
                      type="number"
                      min={0}
                      max={240}
                      step={1}
                      required
                      {...form.register(`time.${name}`, { valueAsNumber: true })}
                      aria-invalid={!!form.formState.errors.time?.[name]}
                    />
                  </div>
                ),
              )}
            </fieldset>
            {Object.keys(form.formState.errors).length > 0 && (
              <p role="alert" className="text-sm text-destructive">
                {t("personalAppointment.invalid")}
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {t(pending ? "loading" : "personalAppointment.check")}
            </Button>
          </form>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              void confirmation.handleSubmit(confirm)(event);
            }}
          >
            <section className="space-y-2 text-sm" aria-live="polite">
              {preview.previous && (
                <div className="space-y-1 rounded-lg border border-border p-3">
                  <h3 className="font-medium">{t("personalRescheduling.previous")}</h3>
                  <p>
                    {t("personalRescheduling.terms", {
                      date: formatDate(preview.previous.startsAt),
                      duration: preview.previous.durationMinutes,
                      mode: t(`appointment.${preview.previous.mode}`),
                    })}
                  </p>
                  <p>{preview.previous.location}</p>
                </div>
              )}
              {appointment && <h3 className="font-medium">{t("personalRescheduling.next")}</h3>}
              <p className="font-medium">
                {t("appointmentAssessment.range", {
                  start: formatDate(preview.assessment.startsAt),
                  end: formatDate(preview.assessment.endsAt),
                  mode: t(`appointment.${preview.assessment.mode}`),
                })}
              </p>
              <p>{preview.proposal.appointment.location}</p>
              <p>
                {t("appointmentTime.previewRange", {
                  start: formatDate(preview.occupiedStartsAt),
                  end: formatDate(preview.occupiedEndsAt),
                })}
              </p>
              <p>
                {t("appointmentTime.minutes", {
                  preparation: preview.proposal.time.preparationMinutes,
                  before: preview.proposal.time.travelBeforeMinutes,
                  after: preview.proposal.time.travelAfterMinutes,
                })}
              </p>
              <p className="text-muted-foreground">
                {t("appointmentAssessment.checked", {
                  date: formatDate(preview.assessment.checkedAt),
                  timezone: preview.assessment.timezone,
                })}
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>{t(`appointmentAssessment.scope.${preview.assessment.declaration.scope}`)}</li>
                <li>{t(`appointmentAssessment.mode.${preview.assessment.declaration.mode}`)}</li>
                <li>
                  {t(`appointmentAssessment.coverage.${preview.assessment.declaration.period}`)}
                </li>
                <li>{t(`appointmentAssessment.preference.${preview.assessment.client.mode}`)}</li>
                <li>
                  {t(
                    preview.assessment.overlappingCommitment
                      ? "appointmentAssessment.overlap"
                      : "appointmentAssessment.noOverlap",
                  )}
                </li>
                {preview.assessment.client.changeRequested && (
                  <li>{t("appointmentAssessment.changeRequested")}</li>
                )}
              </ul>
              <p className="text-muted-foreground">{t("personalAppointment.limits")}</p>
            </section>
            {!preview.canConfirm && (
              <p role="alert" className="text-sm text-destructive">
                {t(appointment ? "personalRescheduling.notReady" : "personalAppointment.notReady")}
              </p>
            )}
            <fieldset disabled={pending || !preview.canConfirm} className="space-y-3">
              <legend className="sr-only">{t("personalAppointment.confirm")}</legend>
              {attestationNames.map((name) => (
                <label key={name} className="flex items-start gap-3 text-sm">
                  <input type="checkbox" required {...confirmation.register(name)} />
                  {t(`personalAppointment.${name}`)}
                </label>
              ))}
            </fieldset>
            {Object.keys(confirmation.formState.errors).length > 0 && (
              <p role="alert" className="text-sm text-destructive">
                {t("personalAppointment.confirmAll")}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setPreview(null)}
              >
                {t("personalAppointment.edit")}
              </Button>
              <Button type="submit" disabled={pending || !preview.canConfirm}>
                {t(
                  pending
                    ? "loading"
                    : appointment
                      ? "personalRescheduling.confirm"
                      : "personalAppointment.confirm",
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
