import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  parseZurichDateTime,
} from "@coverview/ui";
import {
  leadCommandSchema,
  leadReasonSchema,
  leadResultSchema,
  leadStageSchema,
  type LeadDetail,
  type LeadStage,
} from "@coverview/contracts/partner";
import { PartnerApiError } from "@coverview/api-client/partner";
import { usePartner } from "./PartnerSession";
import { useLeadCommand } from "./use-lead-command";
import { Field, SelectOptions, readText, readDate, localDateTime } from "./Field";
import { partnerApi } from "../api";
import { PersonalAppointmentDialog } from "./PersonalAppointmentDialog";
import { MatchingAssignment } from "./MatchingAssignment";
export type LeadAction =
  | "next_action"
  | "contact"
  | "note"
  | "task"
  | "appointment"
  | "personal_appointment"
  | "assign"
  | "wait"
  | "close"
  | "reopen"
  | "transition"
  | "appointment_state";
const labels: Record<LeadAction, string> = {
  next_action: "nextAction",
  contact: "contact",
  note: "note",
  task: "task",
  appointment: "appointment",
  personal_appointment: "appointment",
  assign: "assign",
  wait: "wait",
  close: "close",
  reopen: "reopen",
  transition: "changeStage",
  appointment_state: "appointment",
};
export function LeadActionDialog({
  lead,
  action,
  onClose,
  stage,
  appointmentId,
}: {
  lead: LeadDetail;
  action: LeadAction | null;
  onClose: () => void;
  stage?: LeadStage;
  appointmentId?: string;
}) {
  const { t } = useTranslation(),
    session = usePartner(),
    command = useLeadCommand(lead.id),
    [error, setError] = useState("");
  const directory = useQuery({
    queryKey: [...session.queryKey, "directory"],
    queryFn: ({ signal }) => partnerApi.directory(signal),
    enabled: action === "assign",
    gcTime: 0,
  });
  if (!action) return null;
  if (action === "personal_appointment")
    return (
      <PersonalAppointmentDialog
        key={[...session.queryKey, lead.id].join(":")}
        lead={lead}
        onClose={onClose}
      />
    );
  const nextFields = (
    <>
      <Field
        name="nextAction"
        label={t("field.nextAction")}
        defaultValue={lead.nextAction}
        required
      />
      <Field
        name="dueAt"
        label={t("field.dueAt")}
        type="datetime-local"
        defaultValue={localDateTime(lead.dueAt)}
        required
      />
    </>
  );
  const note = <Field name="note" label={t("field.note")} type="textarea" required />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (command.isPending) return;
    setError("");
    const data = new FormData(event.currentTarget);
    let payload: unknown;
    try {
      switch (action) {
        case "reopen":
          payload = {
            action,
            reason: readText(data, "note"),
            nextAction: readText(data, "nextAction"),
            dueAt: parseZurichDateTime(readText(data, "dueAt")),
          };
          break;
        case "next_action":
          payload = { action, title: readText(data, "nextAction"), dueAt: readDate(data, "dueAt") };
          break;
        case "contact":
          payload = {
            action,
            outcome: readText(data, "outcome"),
            note: readText(data, "note"),
            nextAction: readText(data, "nextAction"),
            dueAt: readDate(data, "dueAt"),
          };
          break;
        case "note":
          payload = { action, text: readText(data, "note"), audience: readText(data, "audience") };
          break;
        case "task":
          payload = {
            action,
            task: {
              title: readText(data, "title"),
              description: readText(data, "description"),
              responsibleId:
                readText(data, "participantId") || lead.responsibleId || session.identity.user.id,
              dueAt: readDate(data, "dueAt"),
              priority: readText(data, "priority"),
              reminderAt: readDate(data, "reminderAt"),
            },
          };
          break;
        case "appointment":
          payload = {
            action,
            appointment: {
              advisorId:
                readText(data, "participantId") || lead.responsibleId || session.identity.user.id,
              startsAt: readDate(data, "startsAt"),
              durationMinutes: Number(readText(data, "duration")),
              mode: readText(data, "mode"),
              location: readText(data, "location"),
              timezone: "Europe/Zurich",
            },
          };
          break;
        case "appointment_state":
          payload = {
            action,
            appointmentId,
            state: readText(data, "state"),
            note: readText(data, "note"),
          };
          break;
        case "assign":
          payload = {
            action,
            responsibleId: readText(data, "responsibleId"),
            reason: readText(data, "note"),
            ...(readText(data, "matchingBasis")
              ? { matchingBasis: readText(data, "matchingBasis") }
              : {}),
          };
          break;
        case "wait":
          payload = {
            action,
            waiting: { reason: readText(data, "note"), until: readDate(data, "until") },
          };
          break;
        case "close":
          payload = {
            action,
            result: readText(data, "result"),
            reason: readText(data, "reason"),
            comment: readText(data, "note"),
          };
          break;
        case "transition":
          payload = {
            action,
            stage: readText(data, "stage"),
            ...(readText(data, "appointmentId")
              ? { appointmentId: readText(data, "appointmentId") }
              : {}),
            ...(readText(data, "offerId") ? { offerId: readText(data, "offerId") } : {}),
          };
          break;
      }
      const parsed = leadCommandSchema.safeParse({
        ...(payload as object),
        revision: lead.revision,
      });
      if (!parsed.success) {
        setError(t("errors.PARTNER_ACTION_REQUIRED"));
        return;
      }
      await command.mutateAsync(parsed.data);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof PartnerApiError
          ? t(`errors.${cause.code}`, { defaultValue: t("error") })
          : t("error"),
      );
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !command.isPending) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(`detail.${labels[action]}`)}</DialogTitle>
          <DialogDescription>
            {lead.title}
            {" · "}
            {lead.clientName}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={(event) => void submit(event)}>
          {(action === "task" || action === "appointment") && (
            <Field
              name="participantId"
              label={t("field.responsible")}
              defaultValue={lead.responsibleId ?? ""}
              required
            >
              {lead.participants
                .filter((p) => p.canWork && (action !== "appointment" || p.canContact))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </Field>
          )}
          {action === "next_action" && nextFields}
          {action === "reopen" && (
            <>
              <p className="text-sm text-muted-foreground">{t("detail.reopenNotice")}</p>
              {note}
              {nextFields}
            </>
          )}
          {action === "contact" && (
            <>
              <p className="text-sm text-muted-foreground">{t("contact.description")}</p>
              <Field name="outcome" label={t("field.result")} defaultValue="reached">
                <SelectOptions values={["reached", "attempted"]} prefix="contact" />
              </Field>
              {note}
              {nextFields}
            </>
          )}
          {action === "note" && (
            <>
              {note}
              <Field name="audience" label={t("field.audience")} defaultValue="private">
                <SelectOptions
                  values={
                    session.context.administrator
                      ? ["private", "assigned", "client", "coverview"]
                      : lead.allowedActions?.includes("contact")
                        ? ["private", "assigned", "client"]
                        : ["private", "assigned"]
                  }
                  prefix="audience"
                />
              </Field>
            </>
          )}
          {action === "task" && (
            <>
              <Field name="title" label={t("field.title")} required />
              <Field name="description" label={t("field.description")} type="textarea" />
              <Field name="dueAt" label={t("field.dueAt")} type="datetime-local" required />
              <Field name="priority" label={t("field.priority")} defaultValue="normal">
                <SelectOptions values={["normal", "high", "urgent"]} prefix="priority" />
              </Field>
              <Field name="reminderAt" label={t("field.reminder")} type="datetime-local" />
            </>
          )}
          {action === "appointment" && (
            <>
              <Field name="startsAt" label={t("field.date")} type="datetime-local" required />
              <Field
                name="duration"
                label={t("field.duration")}
                type="number"
                defaultValue="60"
                required
              />
              <Field name="mode" label={t("field.mode")} defaultValue="phone">
                <SelectOptions values={["phone", "video", "office", "home"]} prefix="appointment" />
              </Field>
              <Field name="location" label={t("field.location")} required />
              <p className="text-xs text-muted-foreground">{t("appointment.timezone")}</p>
            </>
          )}
          {action === "appointment_state" && (
            <>
              <Field name="state" label={t("field.result")} defaultValue="completed">
                <SelectOptions
                  values={["completed", "cancelled", "client_absent", "advisor_absent"]}
                  prefix="appointment"
                />
              </Field>
              {note}
            </>
          )}
          {action === "assign" && (
            <>
              <p className="text-sm text-muted-foreground">{t("detail.assignNotice")}</p>
              <MatchingAssignment lead={lead} directory={directory.data?.items ?? []} />
            </>
          )}
          {action === "wait" && (
            <>
              {note}
              <Field name="until" label={t("field.dueAt")} type="datetime-local" required />
            </>
          )}
          {action === "close" && (
            <>
              <p className="text-sm text-muted-foreground">{t("detail.closeNotice")}</p>
              <Field
                name="result"
                label={t("field.result")}
                defaultValue="resolved_without_contract"
              >
                <SelectOptions
                  values={leadResultSchema.options.filter(
                    (value) => value !== "contract" || lead.stage === "contract_issued",
                  )}
                  prefix="result"
                />
              </Field>
              <Field name="reason" label={t("field.reason")} defaultValue="current_suitable">
                <SelectOptions values={leadReasonSchema.options} prefix="reason" />
              </Field>
              {note}
            </>
          )}
          {action === "transition" && (
            <>
              <Field
                name="stage"
                label={t("detail.changeStage")}
                defaultValue={stage ?? lead.stage}
              >
                <SelectOptions
                  values={leadStageSchema.options.filter(
                    (value) =>
                      ![
                        "draft",
                        "signing",
                        "signed",
                        "awaiting_insurer",
                        "contract_issued",
                        "completed",
                      ].includes(value),
                  )}
                  prefix="stage"
                />
              </Field>
              {lead.appointments.length > 0 && (
                <Field name="appointmentId" label={t("tabs.appointments")}>
                  <option value="">{"—"}</option>
                  {lead.appointments.map((appt) => (
                    <option key={appt.id} value={appt.id}>
                      {new Intl.DateTimeFormat("fr-CH", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(appt.startsAt))}
                      {" · "}
                      {t(`appointment.${appt.state}`)}
                    </option>
                  ))}
                </Field>
              )}
              {lead.offers.length > 0 && (
                <Field name="offerId" label={t("tabs.offers")}>
                  <option value="">{"—"}</option>
                  {lead.offers
                    .filter((offer) => offer.active)
                    .map((offer) => (
                      <option key={offer.id} value={offer.id}>
                        {offer.company}
                        {" · "}
                        {offer.product}
                      </option>
                    ))}
                </Field>
              )}
            </>
          )}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" disabled={command.isPending} onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={command.isPending}>
              {t("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
