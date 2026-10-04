import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
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
  qualityCreateSchema,
  qualityActionInputSchema,
  qualityClientReplySchema,
  qualitySettingsInputSchema,
  type QualityCase,
} from "@coverview/contracts/partner-quality";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
const schema = z.object({
  note: z.string().trim().min(10).max(2000),
  kind: z.enum(["complaint", "callback", "verification", "corrective_action"]),
  priority: z.enum(["normal", "high", "urgent"]),
  action: z.enum(["take_charge", "follow_up", "request_explanation", "verify", "close", "reopen"]),
  nextAction: z.string().max(500),
  dueAt: z.string(),
  shared: z.boolean(),
  sharedAuthor: z.boolean(),
  verified: z.boolean(),
  url: z.string(),
  confirmed: z.boolean().refine((v) => v),
});
export function QualityEditor({
  leadId,
  item,
  settingsRevision,
  enabled,
  onClose,
  onSaved,
}: {
  leadId?: string;
  item?: QualityCase;
  settingsRevision?: number;
  enabled: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation("quality"),
    session = usePartner(),
    [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState("");
  const attempt = useRef<{ key: string; input: unknown } | null>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      note: "",
      kind: "complaint",
      priority: "normal",
      action: item?.state === "closed" ? "reopen" : "take_charge",
      nextAction: "",
      dueAt: "",
      shared: false,
      sharedAuthor: false,
      verified: false,
      url: "",
      confirmed: false,
    },
  });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const isSettings = settingsRevision !== undefined,
    managing = !!item?.canManage,
    action = form.watch("action");
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
      if (isSettings)
        await partnerApi.updateQualitySettings(qualitySettingsInputSchema.parse(a.input), o);
      else if (item) {
        if (managing)
          await partnerApi.actQualityCase(item.id, qualityActionInputSchema.parse(a.input), o);
        else await partnerApi.replyQualityCase(item.id, qualityClientReplySchema.parse(a.input), o);
      } else await partnerApi.createQualityCase(leadId!, qualityCreateSchema.parse(a.input), o);
      if (!controller.current.signal.aborted) {
        attempt.current = null;
        onSaved();
        onClose();
      }
    } catch (cause) {
      if (controller.current.signal.aborted) return;
      const definite =
        cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
      setBlocked(definite);
      setError(t(definite ? "changed" : "uncertain"));
    } finally {
      if (!controller.current.signal.aborted) setPending(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90svh] overflow-y-auto"
        closeLabel={t("close")}
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>
            {t(isSettings ? "googleSettings" : item ? "process" : "create")}
          </DialogTitle>
          <DialogDescription>
            {t(isSettings ? "googleSettingsDescription" : "processDescription")}
          </DialogDescription>
        </DialogHeader>
        {enabled ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              void form.handleSubmit((v) => {
                try {
                  const input = isSettings
                    ? qualitySettingsInputSchema.parse({
                        expectedRevision: settingsRevision,
                        googleReviewUrl: v.url || null,
                        sourceReference: v.note,
                        reviewed: true,
                      })
                    : item
                      ? managing
                        ? qualityActionInputSchema.parse({
                            expectedRevision: item.revision,
                            action: v.action,
                            note: v.note,
                            nextAction: v.action === "close" ? "" : v.nextAction,
                            dueAt: v.action === "close" ? null : parseZurichDateTime(v.dueAt),
                            sharedWithClient: v.shared,
                            sharedWithAuthor: v.sharedAuthor,
                            verified: v.verified,
                          })
                        : qualityClientReplySchema.parse({
                            expectedRevision: item.revision,
                            note: v.note,
                          })
                      : qualityCreateSchema.parse({
                          kind: v.kind,
                          summary: v.note,
                          priority: v.priority,
                          sharedWithClient: v.shared,
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
              disabled={pending || blocked || !!attempt.current || !enabled}
              className="space-y-4"
            >
              {isSettings ? (
                <>
                  <Label htmlFor="quality-url">{t("googleUrl")}</Label>
                  <Input id="quality-url" {...form.register("url")} type="url" />
                </>
              ) : !item ? (
                <>
                  {(["kind", "priority"] as const).map((field) => (
                    <div key={field}>
                      <Label htmlFor={`quality-${field}`}>{t(field)}</Label>
                      <select
                        id={`quality-${field}`}
                        {...form.register(field)}
                        className="min-h-11 w-full rounded-md border border-input bg-background px-3"
                      >
                        {(field === "kind"
                          ? ["complaint", "callback", "verification", "corrective_action"]
                          : ["normal", "high", "urgent"]
                        ).map((v) => (
                          <option key={v} value={v}>
                            {t(`${field === "kind" ? "kinds" : "priorities"}.${v}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </>
              ) : managing ? (
                <>
                  <Label htmlFor="quality-action">{t("action")}</Label>
                  <select
                    id="quality-action"
                    {...form.register("action")}
                    className="min-h-11 w-full rounded-md border border-input bg-background px-3"
                  >
                    {(item.state === "closed"
                      ? ["reopen"]
                      : ["take_charge", "follow_up", "request_explanation", "verify", "close"]
                    ).map((v) => (
                      <option key={v} value={v}>
                        {t(`actions.${v}`)}
                      </option>
                    ))}
                  </select>
                  {action !== "close" && (
                    <>
                      <Label htmlFor="quality-next">{t("nextAction")}</Label>
                      <Input id="quality-next" {...form.register("nextAction")} />
                      <Label htmlFor="quality-due">{t("dueLabel")}</Label>
                      <Input id="quality-due" type="datetime-local" {...form.register("dueAt")} />
                    </>
                  )}
                  {action === "close" && (
                    <label className="flex min-h-11 items-center gap-3">
                      <input type="checkbox" {...form.register("verified")} />
                      {t("verified")}
                    </label>
                  )}
                </>
              ) : null}
              <Label htmlFor="quality-note">{t(isSettings ? "source" : "message")}</Label>
              <textarea
                id="quality-note"
                {...form.register("note")}
                rows={5}
                className="w-full rounded-md border border-input bg-background p-3"
              />
              {!isSettings && (!item || (managing && item.canShareWithClient)) && (
                <label className="flex min-h-11 items-center gap-3">
                  <input type="checkbox" {...form.register("shared")} />
                  {t("shared")}
                </label>
              )}
              {managing && item?.canShareWithAuthor && (
                <label className="flex min-h-11 items-center gap-3">
                  <input type="checkbox" {...form.register("sharedAuthor")} />
                  {t("sharedAuthor")}
                </label>
              )}
              <label className="flex min-h-11 items-center gap-3">
                <input type="checkbox" {...form.register("confirmed")} />
                {t(isSettings ? "urlConfirmed" : "confirmAction")}
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
