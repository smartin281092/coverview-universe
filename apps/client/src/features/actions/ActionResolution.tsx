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
import { Button, Input } from "@coverview/ui";
import { api } from "../../api";
import { ActionFailure } from "./ActionFailure";
import { ActionRequirements } from "./ActionRequirements";
import { useActionLabel } from "./use-action-label";
import { numberFormat } from "@coverview/ui/number-format";

const formSchema = actionCenterResolveInputSchema
  .omit({ values: true })
  .extend({
    response: z.string().max(2000).optional(),
  })
  .transform((input): ActionCenterResolveInput => {
    const output: ActionCenterResolveInput = {
      fingerprint: input.fingerprint,
      choice: input.choice,
    };
    if (input.choice === "variant" && input.variantId) output.variantId = input.variantId;
    if (["correct", "custom"].includes(input.choice) && input.response?.trim())
      output.response = input.response.trim();
    return output;
  })
  .pipe(actionCenterResolveInputSchema)
  .refine((input) => !["correct", "custom"].includes(input.choice) || !!input.response, {
    path: ["response"],
  });

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
  const canCorrect = action.choices.some((item) => item.id === "correct" && item.enabled);
  const responseLabel = canCorrect
    ? action.topic === "address"
      ? t("question.addressValue")
      : action.topic === "birthDate"
        ? t("question.dateValue")
        : t("question.value", { field: label(action) })
    : t("question.custom");
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
    <form onSubmit={(event) => void submit(event)} className="p-4 sm:p-6" aria-busy={pending}>
      <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground">
        <MessageCircleQuestion className="size-4" aria-hidden="true" />
        <h1>{t("question.label", { name: action.profileName })}</h1>
      </div>
      <h2 className="mb-4 font-medium">
        {t(`question.${action.kind}`, { field: label(action), name: action.profileName })}
      </h2>
      {action.kind === "authorization" && (
        <ActionRequirements action={action} asOptions disabled={pending} />
      )}
      {action.kind !== "authorization" && (
        <fieldset disabled={pending || !action.canResolve || conflict} className="space-y-2">
          <legend className="sr-only">{t("question.choose")}</legend>
          {(options.length > 1 ? options : []).map((option, index) => {
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
                    if (option.id === "correct") form.setFocus("response");
                    else form.setValue("response", "");
                  }}
                />
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs text-muted-foreground"
                  aria-hidden="true"
                >
                  {numberFormat(i18n.language).format(index + 1)}
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
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
              </label>
            );
          })}
          <div
            className={`flex flex-wrap items-center gap-3 px-3 py-3 ${options.length > 1 ? "mt-3 border-t border-border" : ""}`}
          >
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full border border-border ${choice === "custom" || choice === "correct" ? "bg-muted" : ""}`}
            >
              <Pencil className="size-4 text-muted-foreground" aria-hidden="true" />
            </span>
            <Input
              className="min-h-11 min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none"
              aria-label={responseLabel}
              placeholder={responseLabel}
              autoComplete="off"
              maxLength={2000}
              value={response ?? ""}
              {...form.register("response", {
                onChange: (event: { target: { value: string } }) => {
                  form.setValue(
                    "choice",
                    event.target.value
                      ? canCorrect
                        ? "correct"
                        : "custom"
                      : (first?.id ?? "custom"),
                    { shouldDirty: true },
                  );
                },
              })}
            />
            <Button
              type="submit"
              className="min-h-11"
              disabled={pending || (["correct", "custom"].includes(choice) && !response?.trim())}
            >
              {t(
                pending
                  ? "saving"
                  : options.length === 1 && choice === "notify"
                    ? "request"
                    : options.length === 1 && choice === "keep"
                      ? "question.keep"
                      : options.length === 1 && choice === "variant"
                        ? "question.use"
                        : "question.send",
              )}
            </Button>
          </div>
        </fieldset>
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
