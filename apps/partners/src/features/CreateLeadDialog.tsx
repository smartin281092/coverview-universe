import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  leadCategorySchema,
  leadCreateInputSchema,
  type LeadDetail,
} from "@coverview/contracts/partner";
import { PartnerApiError } from "@coverview/api-client/partner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
  Label,
} from "@coverview/ui";
import { usePartner } from "./PartnerSession";
import { partnerApi } from "../api";
import { SelectOptions, zurichInstant, localDateTime } from "./Field";
import { ClientPicker } from "./ClientPicker";
const formSchema = leadCreateInputSchema.omit({ dueAt: true }).extend({ dueAt: z.string() });
export function CreateLeadDialog({
  open,
  onOpenChange,
  lead,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: LeadDetail;
}) {
  const { t } = useTranslation(),
    session = usePartner(),
    client = useQueryClient(),
    navigate = useNavigate();
  const [error, setError] = useState(""),
    [key, setKey] = useState(() => crypto.randomUUID());
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: lead
      ? {
          title: lead.title,
          category: lead.category,
          object: lead.object,
          context: lead.context ?? "",
          clientUserId: lead.clientUserId,
          clientProfileId: lead.clientProfileId,
          clientName: lead.clientName,
          email: lead.email ?? "",
          phone: lead.phone ?? "",
          language: lead.language ?? "fr",
          source: lead.source ?? "",
          transmissionAuthorized: lead.transmissionAuthorized ?? false,
          priority: lead.priority,
          draft: lead.stage === "draft",
          nextAction: lead.nextAction,
          dueAt: localDateTime(lead.dueAt),
        }
      : {
          title: "",
          category: "other",
          object: "",
          context: "",
          clientUserId: null,
          clientProfileId: null,
          clientName: "",
          email: "",
          phone: "",
          language: "fr",
          source: t("create.sourceDefault"),
          transmissionAuthorized: false,
          priority: "normal",
          draft: false,
          nextAction: "",
          dueAt: "",
        },
  });
  const field = (
    name:
      | "title"
      | "object"
      | "clientName"
      | "email"
      | "phone"
      | "language"
      | "source"
      | "nextAction"
      | "dueAt",
    type = "text",
  ) => (
    <div className="space-y-2" key={name}>
      <Label htmlFor={`create-${name}`}>{t(`field.${name}`)}</Label>
      <Input
        id={`create-${name}`}
        type={type}
        {...form.register(name)}
        aria-invalid={!!form.formState.errors[name]}
      />
    </div>
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!form.formState.isSubmitting) onOpenChange(value);
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t(lead ? "create.edit" : "create.title")}</DialogTitle>
          <DialogDescription>{t("create.description")}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("advice.afterCreate")}</p>
        <form
          className="space-y-5"
          onChange={() => setKey(crypto.randomUUID())}
          onSubmit={(event) => {
            void form.handleSubmit(async (values) => {
              setError("");
              try {
                const input = {
                    ...values,
                    dueAt: values.dueAt ? zurichInstant(values.dueAt) : null,
                  },
                  options = { csrfToken: session.identity.csrfToken, idempotencyKey: key };
                const result = lead
                  ? await partnerApi.command(
                      lead.id,
                      { action: "edit", revision: lead.revision, lead: input },
                      options,
                    )
                  : await partnerApi.create(input, options);
                await client.invalidateQueries({ queryKey: session.queryKey });
                onOpenChange(false);
                void navigate({
                  to: "/leads/$leadId",
                  params: { leadId: result.id },
                  search: { tab: "overview" },
                });
              } catch (cause) {
                setError(
                  cause instanceof PartnerApiError
                    ? t(`errors.${cause.code}`, { defaultValue: t("error") })
                    : t("error"),
                );
              }
            })(event);
          }}
        >
          {field("title")}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="create-category">{t("field.category")}</Label>
              <select
                id="create-category"
                {...form.register("category")}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <SelectOptions values={leadCategorySchema.options} prefix="category" />
              </select>
            </div>
            {field("object")}
            {field("clientName")}
            {field("email", "email")}
            {field("phone")}
            {field("language")}
          </div>
          <p className="rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
            {t("create.pending")}
          </p>
          {session.context.administrator && (
            <ClientPicker
              onSelect={(client) => {
                form.setValue("clientUserId", client.userId);
                form.setValue("clientProfileId", client.profileId);
                form.setValue("clientName", client.name);
                form.setValue("email", client.email);
                setKey(crypto.randomUUID());
              }}
            />
          )}
          {form.watch("clientUserId") && (
            <p className="text-sm text-muted-foreground">
              {t("create.linked", { name: form.watch("clientName") })}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="create-context">{t("field.context")}</Label>
            <textarea
              id="create-context"
              {...form.register("context")}
              rows={3}
              className="w-full rounded-md border border-input bg-background p-3 text-sm"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("nextAction")}
            {field("dueAt", "datetime-local")}
            {field("source")}
            <div className="space-y-2">
              <Label htmlFor="create-priority">{t("field.priority")}</Label>
              <select
                id="create-priority"
                {...form.register("priority")}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <SelectOptions values={["normal", "high", "urgent"]} prefix="priority" />
              </select>
            </div>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" {...form.register("transmissionAuthorized")} className="mt-1" />
            {t("field.consent")}
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" {...form.register("draft")} />
            {t("field.draft")}
          </label>
          {(error || Object.keys(form.formState.errors).length > 0) && (
            <p role="alert" className="text-sm text-destructive">
              {error || t("errors.PARTNER_ACTION_REQUIRED")}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={form.formState.isSubmitting}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {t("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
