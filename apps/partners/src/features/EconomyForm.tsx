import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { PartnerApiError, type PartnerMutation } from "@coverview/api-client/partner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
  Label,
  parseZurichDateTime,
} from "@coverview/ui";
import { useQueryClient } from "@tanstack/react-query";
import { usePartner } from "./PartnerSession";

export type EconomyValues = Record<string, string | boolean | string[]>;
export type EconomyField = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "select" | "multi" | "checkbox" | "datetime-local";
  options?: { value: string; label: string }[];
  show?: (v: EconomyValues) => boolean;
  optional?: boolean;
};
export const value = (v: EconomyValues, name: string) =>
  typeof v[name] === "string" ? v[name] : "";
export const values = (v: EconomyValues, name: string) => (Array.isArray(v[name]) ? v[name] : []);
export const instant = (v: EconomyValues, name: string) => parseZurichDateTime(value(v, name));
// Decimal input conversion only; all shares, entitlement and balances are calculated by the API.
export function decimal(v: EconomyValues, name: string) {
  const s = value(v, name).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/u.test(s)) throw new Error(name);
  const [whole, fraction = ""] = s.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function EconomyForm<T>({
  title,
  description,
  fields,
  initial = {},
  parse,
  onSend,
  onClose,
  onSaved,
  enabled = true,
  children,
}: {
  title: string;
  description: string;
  fields: EconomyField[];
  initial?: EconomyValues;
  parse: (v: EconomyValues) => T;
  onSend: (v: T, options: PartnerMutation) => Promise<unknown>;
  onClose: () => void;
  onSaved?: () => void;
  enabled?: boolean;
  children?: ReactNode;
}) {
  const { t } = useTranslation("economy"),
    session = usePartner(),
    client = useQueryClient(),
    prefix = useId();
  const [review, setReview] = useState<{ input: T; values: EconomyValues } | null>(null),
    [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState("");
  const attempt = useRef<{ input: T; key: string } | null>(null),
    controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const schema = z
    .record(z.string(), z.union([z.string(), z.boolean(), z.array(z.string())]))
    .superRefine((v, ctx) => {
      try {
        parse(v);
      } catch {
        ctx.addIssue({ code: "custom", message: "invalid" });
      }
    });
  const form = useForm<EconomyValues>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(
      fields.map((f) => [
        f.name,
        initial[f.name] ?? (f.type === "checkbox" ? false : f.type === "multi" ? [] : ""),
      ]),
    ),
  });
  const watched = form.watch();
  async function send() {
    if (pending || blocked || !review || (!enabled && !attempt.current)) return;
    attempt.current ??= { input: review.input, key: crypto.randomUUID() };
    setPending(true);
    setError("");
    controller.current = new AbortController();
    try {
      await onSend(attempt.current.input, {
        csrfToken: session.identity.csrfToken,
        idempotencyKey: attempt.current.key,
        signal: controller.current.signal,
      });
      void client.invalidateQueries({ queryKey: session.queryKey });
      onSaved?.();
      onClose();
    } catch (cause) {
      if (controller.current.signal.aborted) return;
      const definitive =
        cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
      setBlocked(definitive);
      setError(t(definitive ? "changed" : "uncertain"));
      if (definitive) void client.invalidateQueries({ queryKey: session.queryKey });
    } finally {
      setPending(false);
    }
  }
  const control = "w-full rounded-md border border-input bg-background p-3 text-sm";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-3xl"
        closeLabel={t("close")}
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {(!enabled || blocked) && <p role="alert">{t("changed")}</p>}
        {children && <div hidden={!enabled || blocked}>{children}</div>}
        {review ? (
          <div className="space-y-5">
            <p className="font-medium">{t("review")}</p>
            <dl className="space-y-3" hidden={!enabled || blocked}>
              {fields
                .filter((f) => !f.show || f.show(review.values))
                .map((f) => {
                  const raw = review.values[f.name],
                    list = Array.isArray(raw) ? raw : [String(raw ?? "")];
                  return (
                    <div key={f.name}>
                      <dt className="text-sm text-muted-foreground">{f.label}</dt>
                      <dd className="whitespace-pre-wrap break-words">
                        {typeof raw === "boolean"
                          ? t(raw ? "yes" : "no")
                          : list
                              .map((v) => f.options?.find((o) => o.value === v)?.label ?? v)
                              .join(", ") || t("none")}
                      </dd>
                    </div>
                  );
                })}
            </dl>
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                variant="outline"
                disabled={pending || !!attempt.current}
                onClick={() => setReview(null)}
              >
                {t("back")}
              </Button>
              <Button
                disabled={pending || blocked || (!enabled && !attempt.current)}
                onClick={() => void send()}
              >
                {t(pending ? "saving" : attempt.current ? "retrySame" : "confirm")}
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-5"
            onSubmit={(e) =>
              void form.handleSubmit((v) => {
                setReview({ values: v, input: parse(v) });
                setError("");
              })(e)
            }
          >
            <fieldset
              disabled={pending || !enabled || blocked}
              hidden={!enabled || blocked}
              className="space-y-5"
            >
              {fields
                .filter((f) => !f.show || f.show(watched))
                .map((f) => (
                  <div key={f.name} className="space-y-2">
                    <Label htmlFor={`${prefix}-${f.name}`}>
                      {f.label}
                      {f.optional ? ` · ${t("optional")}` : ""}
                    </Label>
                    {f.type === "checkbox" ? (
                      <input
                        id={`${prefix}-${f.name}`}
                        type="checkbox"
                        {...form.register(f.name)}
                        required={!f.optional}
                      />
                    ) : f.type === "multi" ? (
                      <fieldset
                        id={`${prefix}-${f.name}`}
                        className="grid gap-2 sm:grid-cols-2"
                        aria-label={f.label}
                      >
                        {f.options?.map((o) => (
                          <label key={o.value} className="flex items-start gap-2 text-sm">
                            <input type="checkbox" value={o.value} {...form.register(f.name)} />
                            {o.label}
                          </label>
                        ))}
                      </fieldset>
                    ) : f.type === "select" ? (
                      <select
                        id={`${prefix}-${f.name}`}
                        className={control}
                        required={!f.optional}
                        {...form.register(f.name)}
                      >
                        <option value="">{t("choose")}</option>
                        {f.options?.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : f.type === "textarea" ? (
                      <textarea
                        id={`${prefix}-${f.name}`}
                        className={control}
                        rows={3}
                        maxLength={2000}
                        required={!f.optional}
                        {...form.register(f.name)}
                      />
                    ) : (
                      <Input
                        id={`${prefix}-${f.name}`}
                        type={f.type ?? "text"}
                        required={!f.optional}
                        {...form.register(f.name)}
                      />
                    )}
                  </div>
                ))}
            </fieldset>
            {Object.keys(form.formState.errors).length > 0 && (
              <p role="alert" className="text-destructive">
                {t("invalid")}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={!enabled}>
                {t("review")}
              </Button>
            </div>
          </form>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
