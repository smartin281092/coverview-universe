import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { IdentityMe } from "@coverview/api-client";
import {
  documentFieldReviewInputSchema,
  type DocumentRecord,
  type DocumentReviewGroup,
} from "@coverview/contracts";
import { Button, Input, Label } from "@coverview/ui";
import { api } from "../../api";
import { DocumentFailure } from "./DocumentFailure";
import { DocumentCompanyStatus } from "./DocumentCompanyStatus";

const formSchema = z.object({ values: documentFieldReviewInputSchema.shape.values });
const comparable = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("fr");

export function DocumentReview({
  identity,
  document,
  group,
  onDone,
  onPendingChange,
}: {
  identity: IdentityMe;
  document: DocumentRecord;
  group: DocumentReviewGroup;
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
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      values: group.fields.map((field) => ({
        extractionId: field.extractionId,
        value: field.value,
      })),
    },
  });
  const company = useQuery({
    queryKey: [
      "private",
      identity.user.id,
      identity.session.id,
      "company-actions",
      document.id,
      document.revision,
    ],
    queryFn: ({ signal }) => api.companyActions({ documentId: document.id }, { signal }),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  const mutation = useMutation({
    mutationKey: ["private", identity.user.id, identity.session.id, "document-fields"],
    gcTime: 0,
    mutationFn: (input: z.infer<typeof documentFieldReviewInputSchema>) => {
      const payload = JSON.stringify(input);
      if (command.current?.payload !== payload)
        command.current = { payload, key: crypto.randomUUID() };
      return api.updateDocumentFields(document.id, input, {
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
  const values = form.watch("values");
  const differs = group.fields.some(
    (field, index) =>
      comparable(values[index]?.value ?? "") !== comparable(field.currentValue ?? ""),
  );
  const save = (intent: "save" | "sync") =>
    form.handleSubmit((input) =>
      mutation.mutate({
        revision: document.revision,
        profileRevision: group.profileRevision,
        intent,
        values: input.values,
      }),
    );
  return (
    <form className="space-y-6" onSubmit={(event) => void save("save")(event)}>
      <fieldset disabled={mutation.isPending} className="space-y-4">
        <legend className="mb-3 text-sm font-medium">{t("proposed")}</legend>
        {group.fields.map((field, index) => (
          <div key={field.extractionId} className="space-y-2">
            <Label htmlFor={`document-value-${field.extractionId}`}>
              {t(`field.${field.field}`)}
            </Label>
            <Input
              id={`document-value-${field.extractionId}`}
              type={
                ["birthDate", "expiresOn"].includes(field.field)
                  ? "date"
                  : field.field === "contactEmail"
                    ? "email"
                    : field.field === "phone"
                      ? "tel"
                      : "text"
              }
              autoComplete="off"
              {...form.register(`values.${index}.value`)}
              className="min-h-11"
            />
          </div>
        ))}
      </fieldset>
      {group.fields.some((field) => field.currentValue !== null) && (
        <div className="space-y-2 rounded-lg bg-muted p-4 text-sm">
          <p className="text-muted-foreground">{t("current")}</p>
          <p className="whitespace-pre-line break-words font-medium">
            {group.fields
              .map((field) => field.currentValue)
              .filter(Boolean)
              .join("\n")}
          </p>
        </div>
      )}
      {company.isError ? (
        <DocumentFailure error={company.error} onRetry={() => void company.refetch()} />
      ) : (
        !company.isPending && (
          <DocumentCompanyStatus
            action={company.data?.actions.find((action) => action.groupId === group.id)}
            different={group.canSync && group.different}
          />
        )
      )}
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
      <div className="flex flex-col gap-3">
        <Button
          type="submit"
          variant={group.canSync && differs ? "outline" : "default"}
          disabled={mutation.isPending || !form.formState.isDirty}
        >
          {t(mutation.isPending ? "saving" : "reviewEdit.save")}
        </Button>
        {group.canSync && differs && (
          <Button type="button" disabled={mutation.isPending} onClick={() => void save("sync")()}>
            {t("reviewEdit.useProfile")}
          </Button>
        )}
      </div>
    </form>
  );
}
