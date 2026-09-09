import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { ArrowRight, MessageCircleQuestion, Pencil } from "lucide-react";
import { z } from "zod";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import {
  actionCenterResolveInputSchema,
  type ActionCenterItem,
  type ActionCenterResolveInput,
  type ActionCenterResolveResult,
  type ActionCenterVariant,
} from "@coverview/contracts";
import { Button, Input, Label } from "@coverview/ui";
import { api } from "../../api";
import { ActionFailure } from "./ActionFailure";
import { useActionLabel } from "./use-action-label";

const formSchema = actionCenterResolveInputSchema
  .extend({
    values: z.record(z.string(), z.string()).optional(),
    response: z.string().max(2000).optional(),
  })
  .transform((input): ActionCenterResolveInput => {
    const output: ActionCenterResolveInput = {
      fingerprint: input.fingerprint,
      choice: input.choice,
    };
    if (input.choice === "variant" && input.variantId) output.variantId = input.variantId;
    if (input.choice === "correct")
      output.values = Object.fromEntries(
        Object.entries(input.values ?? {})
          .filter(([, value]) => value.trim())
          .map(([key, value]) => [key, value.trim()]),
      );
    if (input.response?.trim()) output.response = input.response.trim();
    return output;
  })
  .pipe(actionCenterResolveInputSchema)
  .refine((input) => input.choice !== "custom" || !!input.response, { path: ["response"] });

export function ActionResolution({
  action,
  identity,
  onDone,
  onStateChange,
  onRefresh,
}: {
  action: ActionCenterItem;
  identity: IdentityMe;
  onDone: (result: ActionCenterResolveResult) => void;
  onStateChange: (state: { pending: boolean; dirty: boolean }) => void;
  onRefresh: () => void;
}) {
  const { t, i18n } = useTranslation("actions");
  const { t: fields } = useTranslation("profile");
  const label = useActionLabel();
  const client = useQueryClient();
  const first =
    action.choices.find(
      (choice) =>
        choice.enabled &&
        choice.recommended &&
        choice.id !== "custom" &&
        (choice.id !== "variant" || action.variants.length === 1),
    ) ?? action.choices.find((choice) => choice.enabled && ["keep", "correct"].includes(choice.id));
  const form = useForm<z.input<typeof formSchema>, unknown, z.output<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fingerprint: action.fingerprint,
      choice: first?.id ?? "custom",
      values: action.currentValues,
      response: "",
      ...(first?.id === "variant" && action.variants[0]
        ? { variantId: action.variants[0].id }
        : {}),
    },
  });
  const choice = form.watch("choice");
  const variantId = form.watch("variantId");
  const response = form.watch("response");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const command = useRef<{ signature: string; key: string } | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const dirty = form.formState.isDirty;
  useEffect(() => {
    onStateChange({ pending, dirty });
    return () => onStateChange({ pending: false, dirty: false });
  }, [pending, dirty, onStateChange]);
  const conflict = failure instanceof ApiError && failure.status === 409;
  const options: (ActionCenterItem["choices"][number] & { variant: ActionCenterVariant | null })[] =
    [];
  for (const item of action.choices) {
    if (item.id === "custom") continue;
    if (item.id === "variant")
      for (const variant of action.variants) options.push({ ...item, variant });
    else options.push({ ...item, variant: null });
  }
  const editableFields = [
    ...new Set([
      ...action.requiredFields,
      ...Object.keys(action.currentValues),
      ...action.variants.flatMap((variant) => Object.keys(variant.values)),
    ]),
  ];
  const submit = form.handleSubmit(async (input) => {
    if (busy.current || !action.canResolve || conflict) return;
    busy.current = true;
    setPending(true);
    setFailure(null);
    const active = new AbortController();
    controller.current = active;
    const signature = JSON.stringify(input);
    if (command.current?.signature !== signature)
      command.current = { signature, key: crypto.randomUUID() };
    try {
      const result = await api.resolveActionCenter(action.id, input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: command.current.key,
        signal: active.signal,
      });
      if (active.signal.aborted) return;
      form.reset(form.getValues());
      await client.invalidateQueries({
        queryKey: ["private", identity.user.id, identity.session.id],
      });
      if (!active.signal.aborted) onDone(result);
    } catch (error) {
      if (!active.signal.aborted) setFailure(error);
    } finally {
      if (!active.signal.aborted) {
        busy.current = false;
        setPending(false);
      }
    }
  });
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="rounded-2xl border border-border bg-background p-4 sm:p-6"
      aria-busy={pending}
    >
      <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground">
        <MessageCircleQuestion className="size-4" aria-hidden="true" />
        {t("question.label")}
      </div>
      <h2 className="mb-4 font-medium">
        {t(`question.${action.kind}`, { field: label(action), name: action.profileName })}
      </h2>
      <fieldset disabled={pending || !action.canResolve || conflict} className="space-y-2">
        <legend className="sr-only">{t("question.choose")}</legend>
        {options.map((option, index) => {
          const selected =
            choice === option.id && (!option.variant || variantId === option.variant.id);
          return (
            <label
              key={`${option.id}:${option.variant?.id ?? ""}`}
              className={`relative flex min-h-12 cursor-pointer items-center gap-3 rounded-xl p-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${selected ? "bg-muted" : "hover:bg-muted/50"} ${!option.enabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <input
                type="radio"
                name="action-resolution"
                className="sr-only"
                checked={selected}
                disabled={!option.enabled}
                onChange={() => {
                  form.setValue("choice", option.id, { shouldDirty: true });
                  form.setValue("variantId", option.variant?.id);
                }}
              />
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs text-muted-foreground"
                aria-hidden="true"
              >
                {new Intl.NumberFormat(i18n.language).format(index + 1)}
              </span>
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block font-medium">
                  {t(option.labelKey, { defaultValue: t(`choices.${option.id}`) })}
                </span>
                {(option.variant || option.id === "keep" || option.id === "notify") && (
                  <span className="block whitespace-pre-line break-words text-muted-foreground">
                    {Object.values(option.variant?.values ?? action.currentValues).join("\n")}
                  </span>
                )}
              </span>
              {selected && (
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
            </label>
          );
        })}
        {choice === "correct" && (
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            {editableFields.map((field) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={`action-${field}`}>
                  {fields(`fields.${field}`, {
                    defaultValue: t(`groups.${field}`, { defaultValue: field }),
                  })}
                </Label>
                <Input
                  id={`action-${field}`}
                  className="min-h-11"
                  type={
                    field === "birthDate"
                      ? "date"
                      : field === "contactEmail"
                        ? "email"
                        : field === "phone"
                          ? "tel"
                          : "text"
                  }
                  autoComplete="off"
                  maxLength={240}
                  {...form.register(`values.${field}`)}
                />
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-full border border-border ${choice === "custom" ? "bg-muted" : ""}`}
          >
            <Pencil className="size-4 text-muted-foreground" aria-hidden="true" />
          </span>
          <Input
            className="min-h-11 min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none"
            aria-label={t("question.custom")}
            placeholder={t("question.custom")}
            maxLength={2000}
            {...form.register("response", {
              onChange: (event: { target: { value: string } }) => {
                if (event.target.value) form.setValue("choice", "custom", { shouldDirty: true });
              },
            })}
          />
          <Button
            type="submit"
            className="min-h-11"
            disabled={pending || (choice === "custom" && !response?.trim())}
          >
            {t(pending ? "saving" : "question.send")}
          </Button>
        </div>
      </fieldset>
      {choice === "custom" && response?.trim() && (
        <p className="mt-3 text-xs text-muted-foreground">{t("question.customHelp")}</p>
      )}
      {Object.keys(form.formState.errors).length > 0 && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {t("question.invalid")}
        </p>
      )}
      {failure ? (
        <div className="mt-5">
          <ActionFailure
            error={failure}
            onRetry={() => {
              if (conflict) onRefresh();
              else void submit();
            }}
          />
        </div>
      ) : null}
    </form>
  );
}
