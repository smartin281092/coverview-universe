import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { PartnerApiError } from "@coverview/api-client/partner";
import {
  communicationChannelSchema,
  communicationPreferencesInputSchema,
  communicationPreferencesSchema,
  recordingSchema,
  recordingDecisionInputSchema,
} from "@coverview/contracts/partner-communications";
import { Button, Label } from "@coverview/ui";
import { partnerApi } from "../../partner-api";
const schema = z.object({
  channels: z.array(communicationChannelSchema),
  note: z.string().trim().max(500),
  decision: z.enum(["", "allow", "decline", "withdraw"]),
  confirmed: z.boolean().refine((v) => v),
});
export type WalletCommunicationEditor =
  | { preferences: z.infer<typeof communicationPreferencesSchema> }
  | { recording: z.infer<typeof recordingSchema> };
export function CommunicationForm({
  identity,
  leadId,
  editor,
  enabled,
  onBack,
  onSaved,
}: {
  identity: IdentityMe;
  leadId: string;
  editor: WalletCommunicationEditor;
  enabled: boolean;
  onBack: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation("communications"),
    [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState("");
  const attempt = useRef<{ key: string; input: unknown } | null>(null),
    controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const preferences = "preferences" in editor ? editor.preferences : null,
    recording = "recording" in editor ? editor.recording : null;
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      channels: preferences?.channels ?? [],
      note: preferences?.note ?? "",
      decision: "",
      confirmed: false,
    },
  });
  async function send() {
    if (!attempt.current || pending || blocked) return;
    setPending(true);
    setError("");
    controller.current = new AbortController();
    try {
      const a = attempt.current,
        o = {
          csrfToken: identity.csrfToken,
          idempotencyKey: a.key,
          signal: controller.current.signal,
        };
      if (preferences)
        await partnerApi.updateCommunicationPreferences(
          leadId,
          communicationPreferencesInputSchema.parse(a.input),
          o,
        );
      else
        await partnerApi.decideRecording(
          recording!.id,
          recordingDecisionInputSchema.parse(a.input),
          o,
        );
      if (!controller.current.signal.aborted) {
        attempt.current = null;
        onSaved();
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
  return (
    <>
      <h3 className="font-semibold">{t(preferences ? "preferences" : "yourDecision")}</h3>
      <p>{t(preferences ? "preferencesDescription" : "decisionDescription")}</p>
      <form
        onSubmit={(event) => {
          void form.handleSubmit((v) => {
            try {
              const input = preferences
                ? communicationPreferencesInputSchema.parse({
                    expectedRevision: preferences.revision,
                    channels: v.channels,
                    note: v.note,
                    confirmed: true,
                  })
                : recordingDecisionInputSchema.parse({
                    expectedRevision: recording!.revision,
                    decision: v.decision,
                    confirmed: true,
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
          disabled={pending || blocked || !enabled || !!attempt.current}
          className="space-y-4"
        >
          {preferences ? (
            <>
              <fieldset>
                <legend>{t("preferredChannels")}</legend>
                {communicationChannelSchema.options.map((v) => (
                  <label key={v} className="flex min-h-11 items-center gap-3">
                    <input type="checkbox" value={v} {...form.register("channels")} />
                    {t(`channels.${v}`)}
                  </label>
                ))}
              </fieldset>
              <Label htmlFor="communication-note">{t("preferenceNote")}</Label>
              <textarea
                id="communication-note"
                {...form.register("note")}
                rows={3}
                className="w-full rounded-md border border-input bg-background p-3"
              />
            </>
          ) : (
            <fieldset>
              <legend>{t("yourDecision")}</legend>
              {(recording?.state === "allowed" ? ["withdraw"] : ["allow", "decline"]).map((v) => (
                <label key={v} className="flex min-h-11 items-center gap-3">
                  <input type="radio" value={v} {...form.register("decision")} />
                  {t(`decisions.${v}`)}
                </label>
              ))}
            </fieldset>
          )}
          <label className="flex min-h-11 items-start gap-3">
            <input type="checkbox" {...form.register("confirmed")} className="mt-1" />
            {t(preferences ? "confirmPreferences" : "confirmDecision")}
          </label>
          {Object.keys(form.formState.errors).length > 0 && <p role="alert">{t("invalid")}</p>}
          <Button type="submit">{t("save")}</Button>
        </fieldset>
      </form>
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
      <Button variant="outline" disabled={pending} onClick={onBack}>
        {t("back")}
      </Button>
    </>
  );
}
