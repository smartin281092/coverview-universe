import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { IdentityMe } from "@coverview/api-client";
import {
  profileFieldSchema,
  type DocumentRecord,
  type DocumentExtraction,
  type Profile,
  type DocumentReviewInput,
} from "@coverview/contracts";
import { Button, Input, Label } from "@coverview/ui";
import { api } from "../../api";
import { DocumentFailure } from "./DocumentFailure";

const formSchema = z
  .object({
    choice: z.enum(["keep", "use", "correct"]),
    value: z.string().trim().min(1).max(240),
    concernsMe: z.boolean(),
  })
  .refine((value) => value.choice === "keep" || value.concernsMe);
export function DocumentReview({
  identity,
  document,
  field,
  profile,
  onDone,
  onPendingChange,
}: {
  identity: IdentityMe;
  document: DocumentRecord;
  field: DocumentExtraction;
  profile: Profile;
  onDone: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const { t } = useTranslation("documents");
  const client = useQueryClient();
  const command = useRef<{ payload: string; key: string } | null>(null);
  const controller = useRef(new AbortController());
  useEffect(() => {
    const active = new AbortController();
    controller.current = active;
    return () => active.abort();
  }, []);
  const profileKey = profileFieldSchema.safeParse(field.field);
  const current = profileKey.success ? profile.fields[profileKey.data] : undefined;
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { choice: "keep" as const, value: field.value, concernsMe: false },
  });
  const mutation = useMutation({
    mutationKey: ["private", identity.user.id, identity.session.id, "document-review"],
    gcTime: 0,
    mutationFn: async (input: DocumentReviewInput) => {
      const payload = JSON.stringify(input);
      if (command.current?.payload !== payload)
        command.current = { payload, key: crypto.randomUUID() };
      return api.reviewDocument(document.id, input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: command.current.key,
        signal: controller.current.signal,
      });
    },
    onSuccess: async () => {
      if (controller.current.signal.aborted) return;
      await client.invalidateQueries({
        queryKey: ["private", identity.user.id, identity.session.id],
      });
      if (!controller.current.signal.aborted) onDone();
    },
    retry: false,
  });
  useEffect(() => {
    onPendingChange(mutation.isPending);
    return () => onPendingChange(false);
  }, [mutation.isPending, onPendingChange]);
  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        void form.handleSubmit((values) =>
          mutation.mutate({
            revision: document.revision,
            profileRevision: profile.revision,
            concernsMe: values.concernsMe,
            decisions: [
              {
                extractionId: field.id,
                choice: values.choice,
                ...(values.choice === "correct" ? { value: values.value } : {}),
              },
            ],
          }),
        )(event);
      }}
    >
      <dl className="space-y-4 text-sm">
        <div>
          <dt className="text-muted-foreground">{t("current")}</dt>
          <dd className="mt-1 break-words font-medium">
            {current?.value ??
              document.reviewedValues.find((value) => value.field === field.field)?.value ??
              t("unknown")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("proposed")}</dt>
          <dd className="mt-1 break-words font-medium">{field.value}</dd>
        </div>
      </dl>
      {current?.confirmedAt && current.value !== field.value && (
        <p className="rounded-lg bg-muted p-4 text-sm">{t("divergence")}</p>
      )}
      <div className="space-y-2 text-sm">
        <p className="font-medium">{t("sourcePage", { page: field.source.page })}</p>
        <blockquote className="break-words border-l-2 border-border pl-4 text-muted-foreground">
          {field.source.text}
        </blockquote>
        <p className="break-words text-xs text-muted-foreground">
          {t("sourceMethod", { version: field.source.version })}
        </p>
        <p className="text-xs text-muted-foreground">{t("confidenceUnknown")}</p>
      </div>
      <fieldset className="space-y-3" disabled={mutation.isPending}>
        <legend className="mb-3 text-sm font-medium">{t("yourDecision")}</legend>
        {(["keep", "use", "correct"] as const).map((choice) => (
          <label key={choice} className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="radio"
              value={choice}
              className="size-4 accent-primary"
              {...form.register("choice")}
            />
            {t(`choice.${choice}`)}
          </label>
        ))}
      </fieldset>
      {form.watch("choice") === "correct" && (
        <div className="space-y-2">
          <Label htmlFor="document-correction">{t("correction")}</Label>
          <Input
            id="document-correction"
            type={["birthDate", "expiresOn"].includes(field.field) ? "date" : "text"}
            {...form.register("value")}
            disabled={mutation.isPending}
          />
        </div>
      )}
      <label className="flex items-start gap-3 text-sm">
        <input
          className="mt-1 size-4 shrink-0 accent-primary"
          type="checkbox"
          {...form.register("concernsMe")}
          disabled={mutation.isPending}
        />
        <span>{t("concernsMe")}</span>
      </label>
      {Object.keys(form.formState.errors).length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {t("reviewInvalid")}
        </p>
      )}
      {mutation.isError && (
        <DocumentFailure
          error={mutation.error}
          onRetry={() => {
            if (mutation.variables) mutation.mutate(mutation.variables);
          }}
        />
      )}
      <Button type="submit" className="min-h-11 w-full" disabled={mutation.isPending}>
        {t(mutation.isPending ? "saving" : "confirmDecision")}
      </Button>
      <p className="text-xs text-muted-foreground">
        {t(profileKey.success ? "profileImpact" : "documentImpact")}
      </p>
    </form>
  );
}
