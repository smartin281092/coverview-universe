import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  collaborationTermsSchema,
  type CollaborationTerms,
  type LeadDetail,
} from "@coverview/contracts/partner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Label,
} from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { useLeadCommand } from "./use-lead-command";

export function CollaborationDialog({ lead, onClose }: { lead: LeadDetail; onClose: () => void }) {
  const { t } = useTranslation(),
    session = usePartner(),
    command = useLeadCommand(lead.id),
    prefix = useId();
  const form = useForm<CollaborationTerms>({
    resolver: zodResolver(collaborationTermsSchema),
    defaultValues: { mode: "co_advice", access: "read", communication: "referent_only" },
  });
  const mode = form.watch("mode");
  const directory = useQuery({
    queryKey: [...session.queryKey, "directory"],
    queryFn: ({ signal }) => partnerApi.directory(signal),
    gcTime: 0,
  });
  const control = "w-full rounded-md border border-input bg-background p-3 text-sm";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !command.isPending) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
        closeLabel={t("close")}
        showCloseButton={!command.isPending}
      >
        <DialogHeader>
          <DialogTitle>{t("collaboration.propose")}</DialogTitle>
          <DialogDescription>{t("collaboration.intro")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(event) =>
            void form.handleSubmit(async (terms) => {
              try {
                await command.mutateAsync({
                  action: "collaboration_propose",
                  terms,
                  revision: lead.revision,
                });
                onClose();
              } catch {
                /* Error is rendered below. */
              }
            })(event)
          }
        >
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-mode`}>{t("collaboration.modeLabel")}</Label>
            <select
              id={`${prefix}-mode`}
              className={control}
              {...form.register("mode", {
                onChange: (e: { target: { value: string } }) => {
                  if (e.target.value !== "co_advice") {
                    form.setValue("access", "contribute");
                    form.setValue("communication", "client_direct");
                  }
                },
              })}
            >
              {["co_advice", "one_off", "transfer"].map((value) => (
                <option key={value} value={value}>
                  {t(`collaboration.mode.${value}`)}
                </option>
              ))}
            </select>
            <p className="text-sm text-muted-foreground">{t(`collaboration.help.${mode}`)}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-target`}>{t("collaboration.recipient")}</Label>
            <select
              id={`${prefix}-target`}
              className={control}
              {...form.register("targetId")}
              required
              disabled={!directory.data}
            >
              <option value="">{t("collaboration.choose")}</option>
              {directory.data?.items
                .filter(
                  (p) =>
                    p.id !== lead.responsibleId &&
                    p.id !== session.identity.user.id &&
                    p.categories.includes(lead.category),
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {" · "}
                    {p.organization}
                  </option>
                ))}
            </select>
            {directory.isPending && <p role="status">{t("loading")}</p>}
            {directory.isError && (
              <Button type="button" variant="outline" onClick={() => void directory.refetch()}>
                {t("retry")}
              </Button>
            )}
          </div>
          {mode === "co_advice" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${prefix}-access`}>{t("collaboration.accessLabel")}</Label>
                <select id={`${prefix}-access`} className={control} {...form.register("access")}>
                  {["read", "contribute"].map((v) => (
                    <option key={v} value={v}>
                      {t(`collaboration.access.${v}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${prefix}-communication`}>
                  {t("collaboration.communicationLabel")}
                </Label>
                <select
                  id={`${prefix}-communication`}
                  className={control}
                  {...form.register("communication")}
                >
                  {["referent_only", "client_direct"].map((v) => (
                    <option key={v} value={v}>
                      {t(`collaboration.communication.${v}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <p className="text-sm text-muted-foreground">{t("collaboration.accessNotice")}</p>
          {(["scope", "responsibilities", "reason", "economicNote"] as const).map((name) => (
            <div key={name} className="space-y-2">
              <Label htmlFor={`${prefix}-${name}`}>{t(`collaboration.${name}`)}</Label>
              <textarea
                id={`${prefix}-${name}`}
                className={control}
                rows={3}
                maxLength={2000}
                required
                {...form.register(name)}
              />
            </div>
          ))}
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              {...form.register("transmissionConfirmed")}
              required
            />
            {t("collaboration.consent")}
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              {...form.register("existingRightsPreserved")}
              required
            />
            {t("collaboration.economicsNotice")}
          </label>
          {(Object.keys(form.formState.errors).length > 0 || command.isError) && (
            <p role="alert" className="text-sm text-destructive">
              {t("collaboration.error")}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" disabled={command.isPending} onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={command.isPending || !directory.data}>
              {t("collaboration.send")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
