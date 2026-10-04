import { useEffect, useRef, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  parseZurichDateTime,
} from "@coverview/ui";
import { PartnerApiError } from "@coverview/api-client/partner";
import {
  communicationChannelSchema,
  communicationRecordInputSchema,
  recordingPurposeSchema,
  recordingRequestInputSchema,
  recordingSchema,
  transcriptInputSchema,
  transcriptActionInputSchema,
} from "@coverview/contracts/partner-communications";
import { localDateTime } from "./Field";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";

const schema = z.object({
  channel: communicationChannelSchema,
  outcome: z.enum(["reached", "attempted", "received"]),
  occurredAt: z.string(),
  summary: z.string(),
  sourceReference: z.string(),
  nextAction: z.string(),
  dueAt: z.string(),
  purposes: z.array(recordingPurposeSchema),
  notice: z.string(),
  validUntil: z.string(),
  retainUntil: z.string(),
  correctionReason: z.string(),
  segments: z.array(z.object({ speaker: z.string(), locator: z.string(), text: z.string() })),
  segmentIndex: z.coerce.number<number>().int().min(0),
  quote: z.string(),
  title: z.string(),
  confirmed: z.boolean().refine((v) => v),
});
export type CommunicationEditorState = {
  mode: "record" | "request" | "transcript" | "task";
  leadRevision: number;
  recording?: z.infer<typeof recordingSchema>;
};
export function CommunicationEditor({
  leadId,
  editor,
  enabled,
  onClose,
  onSaved,
}: {
  leadId: string;
  editor: CommunicationEditorState;
  enabled: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation("communications"),
    session = usePartner(),
    [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState("");
  const attempt = useRef<{ key: string; input: unknown } | null>(null),
    controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const { mode, recording } = editor,
    latest = recording?.transcripts[0];
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      channel: "phone",
      outcome: "reached",
      occurredAt: latest ? localDateTime(latest.input.occurredAt) : "",
      summary: "",
      sourceReference: latest?.input.sourceReference ?? "",
      nextAction: "",
      dueAt: "",
      purposes: [],
      notice: "",
      validUntil: "",
      retainUntil: "",
      correctionReason: "",
      segments: latest?.input.segments ?? [{ speaker: "", locator: "", text: "" }],
      segmentIndex: 0,
      quote: "",
      title: "",
      confirmed: false,
    },
  });
  const segments = useFieldArray({ control: form.control, name: "segments" });
  async function send() {
    if (!attempt.current || pending || blocked) return;
    setPending(true);
    setError("");
    controller.current = new AbortController();
    try {
      const a = attempt.current,
        o = {
          csrfToken: session.identity.csrfToken,
          idempotencyKey: a.key,
          signal: controller.current.signal,
        };
      if (mode === "record")
        await partnerApi.recordCommunication(
          leadId,
          communicationRecordInputSchema.parse(a.input),
          o,
        );
      if (mode === "request")
        await partnerApi.requestRecording(leadId, recordingRequestInputSchema.parse(a.input), o);
      if (mode === "transcript")
        await partnerApi.saveTranscript(recording!.id, transcriptInputSchema.parse(a.input), o);
      if (mode === "task")
        await partnerApi.createTranscriptTask(
          recording!.id,
          transcriptActionInputSchema.parse(a.input),
          o,
        );
      if (!controller.current.signal.aborted) {
        attempt.current = null;
        onSaved();
        onClose();
      }
    } catch (cause) {
      if (!controller.current.signal.aborted) {
        const definite =
          cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
        setBlocked(definite);
        setError(t(definite ? "changed" : "uncertain"));
      }
    } finally {
      if (!controller.current.signal.aborted) setPending(false);
    }
  }
  const field = (
    name:
      | "occurredAt"
      | "summary"
      | "sourceReference"
      | "nextAction"
      | "dueAt"
      | "notice"
      | "validUntil"
      | "retainUntil"
      | "correctionReason"
      | "quote"
      | "title",
    type = "text",
  ) => (
    <div>
      <Label htmlFor={`communication-${name}`}>{t(name === "title" ? "taskTitle" : name)}</Label>
      {["summary", "sourceReference", "notice", "correctionReason", "quote"].includes(name) ? (
        <textarea
          id={`communication-${name}`}
          {...form.register(name)}
          rows={4}
          className="w-full rounded-md border border-input bg-background p-3"
        />
      ) : (
        <Input
          id={`communication-${name}`}
          type={type}
          readOnly={name === "occurredAt" && !!latest}
          {...form.register(name)}
        />
      )}
    </div>
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
        closeLabel={t("close")}
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>{t(`modes.${mode}`)}</DialogTitle>
          <DialogDescription>{t(`descriptions.${mode}`)}</DialogDescription>
        </DialogHeader>
        {enabled ? (
          <form
            onSubmit={(event) => {
              void form.handleSubmit((v) => {
                try {
                  const input =
                    mode === "record"
                      ? communicationRecordInputSchema.parse({
                          expectedLeadRevision: editor.leadRevision,
                          channel: v.channel,
                          outcome: v.outcome,
                          occurredAt: parseZurichDateTime(v.occurredAt),
                          summary: v.summary,
                          sourceReference: v.sourceReference,
                          nextAction: v.nextAction,
                          dueAt: parseZurichDateTime(v.dueAt),
                          confirmed: true,
                        })
                      : mode === "request"
                        ? recordingRequestInputSchema.parse({
                            expectedLeadRevision: editor.leadRevision,
                            channel: v.channel,
                            purposes: v.purposes,
                            notice: v.notice,
                            sourceReference: v.sourceReference,
                            validUntil: parseZurichDateTime(v.validUntil),
                            retainUntil: parseZurichDateTime(v.retainUntil),
                            confirmed: true,
                          })
                        : mode === "transcript"
                          ? transcriptInputSchema.parse({
                              expectedRevision: latest?.revision ?? 0,
                              occurredAt:
                                latest?.input.occurredAt ?? parseZurichDateTime(v.occurredAt),
                              sourceReference: v.sourceReference,
                              correctionReason: v.correctionReason,
                              segments: v.segments,
                              allParticipantsAgreed: true,
                              sourceReviewed: true,
                            })
                          : transcriptActionInputSchema.parse({
                              versionId: latest!.id,
                              segmentIndex: v.segmentIndex,
                              quote: v.quote,
                              title: v.title,
                              dueAt: parseZurichDateTime(v.dueAt),
                              verified: true,
                            });
                  attempt.current ??= { key: crypto.randomUUID(), input };
                  void send();
                } catch {
                  setError(t("invalid"));
                }
              })(event);
            }}
          >
            <fieldset
              disabled={pending || blocked || !!attempt.current || !enabled}
              className="space-y-4"
            >
              {(mode === "record" || mode === "request") && (
                <div>
                  <Label htmlFor="communication-channel">{t("channel")}</Label>
                  <select
                    id="communication-channel"
                    {...form.register("channel")}
                    className="min-h-11 w-full rounded-md border border-input bg-background px-3"
                  >
                    {(mode === "request"
                      ? ["phone", "video", "office"]
                      : communicationChannelSchema.options
                    ).map((v) => (
                      <option key={v} value={v}>
                        {t(`channels.${v}`)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {mode === "record" && (
                <>
                  <div>
                    <Label htmlFor="communication-outcome">{t("outcome")}</Label>
                    <select
                      id="communication-outcome"
                      {...form.register("outcome")}
                      className="min-h-11 w-full rounded-md border border-input bg-background px-3"
                    >
                      {["reached", "attempted", "received"].map((v) => (
                        <option key={v} value={v}>
                          {t(`outcomes.${v}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {field("occurredAt", "datetime-local")}
                  {field("summary")}
                  {field("sourceReference")}
                  {field("nextAction")}
                  {field("dueAt", "datetime-local")}
                </>
              )}
              {mode === "request" && (
                <>
                  <fieldset>
                    <legend className="font-medium">{t("purposesLabel")}</legend>
                    {recordingPurposeSchema.options.map((v) => (
                      <label key={v} className="flex min-h-11 items-center gap-3">
                        <input type="checkbox" value={v} {...form.register("purposes")} />
                        {t(`purposes.${v}`)}
                      </label>
                    ))}
                  </fieldset>
                  {field("notice")}
                  {field("sourceReference")}
                  {field("validUntil", "datetime-local")}
                  {field("retainUntil", "datetime-local")}
                </>
              )}
              {mode === "transcript" && (
                <>
                  {field("occurredAt", "datetime-local")}
                  {field("sourceReference")}
                  {latest && field("correctionReason")}
                  <p>{t("segmentsDescription")}</p>
                  {segments.fields.map((segment, index) => (
                    <fieldset key={segment.id} className="space-y-3 border-t border-border py-4">
                      <legend>{t("segment", { count: index + 1 })}</legend>
                      {(["speaker", "locator", "text"] as const).map((name) => (
                        <div key={name}>
                          <Label htmlFor={`segment-${index}-${name}`}>{t(name)}</Label>
                          {name === "text" ? (
                            <textarea
                              id={`segment-${index}-${name}`}
                              {...form.register(`segments.${index}.${name}`)}
                              rows={5}
                              className="w-full rounded-md border border-input bg-background p-3"
                            />
                          ) : (
                            <Input
                              id={`segment-${index}-${name}`}
                              {...form.register(`segments.${index}.${name}`)}
                            />
                          )}
                        </div>
                      ))}
                      {segments.fields.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => segments.remove(index)}
                        >
                          {t("removeSegment")}
                        </Button>
                      )}
                    </fieldset>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={segments.fields.length >= 100}
                    onClick={() => segments.append({ speaker: "", locator: "", text: "" })}
                  >
                    {t("addSegment")}
                  </Button>
                </>
              )}
              {mode === "task" && latest && (
                <>
                  <Label htmlFor="communication-segment">{t("sourceSegment")}</Label>
                  <select
                    id="communication-segment"
                    {...form.register("segmentIndex")}
                    className="min-h-11 w-full rounded-md border border-input bg-background px-3"
                  >
                    {latest.input.segments.map((s, index) => (
                      <option key={index} value={index}>
                        {s.speaker}
                        {t("separator")}
                        {s.locator}
                      </option>
                    ))}
                  </select>
                  <blockquote className="whitespace-pre-wrap border-l-2 border-border pl-3">
                    {latest.input.segments[form.watch("segmentIndex")]?.text}
                  </blockquote>
                  {field("quote")}
                  {field("title")}
                  {field("dueAt", "datetime-local")}
                </>
              )}
              <label className="flex min-h-11 items-start gap-3">
                <input type="checkbox" {...form.register("confirmed")} className="mt-1" />
                {t(`confirmations.${mode}`)}
              </label>
              {Object.keys(form.formState.errors).length > 0 && <p role="alert">{t("invalid")}</p>}
              <Button type="submit">{t("save")}</Button>
            </fieldset>
          </form>
        ) : (
          <p role="alert">{t("changed")}</p>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {attempt.current && !blocked && (
          <Button disabled={pending} onClick={() => void send()}>
            {t(pending ? "saving" : "retryExact")}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
