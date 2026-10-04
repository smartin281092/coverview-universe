import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { contractReviewInputSchema, type LeadDetail } from "@coverview/contracts/partner";
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@coverview/ui";
import { partnerApi } from "../api";
import { useLeadCommand } from "./use-lead-command";
import { BenefitFields } from "./BenefitFields";
import { benefitCategoryOf } from "@coverview/contracts/partner-benefits";
export function ContractReviewDialog({ lead, onClose }: { lead: LeadDetail; onClose: () => void }) {
  const { t } = useTranslation();
  const tr = (key: string) => t(`contract.${key}`);
  const [revision] = useState(lead.revision);
  const current = lead.currentContract!;
  const command = useLeadCommand(lead.id);
  const form = useForm({
    resolver: zodResolver(contractReviewInputSchema),
    defaultValues: {
      referenceId: current.referenceId,
      premiumVerified: current.premiumVerified,
      features: current.features,
    },
  });
  const features = useFieldArray({ control: form.control, name: "features" });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !command.isPending) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-3xl"
        closeLabel={tr("close")}
        showCloseButton={!command.isPending}
      >
        <DialogHeader>
          <DialogTitle>{tr("review")}</DialogTitle>
          <DialogDescription>{tr("reviewHelp")}</DialogDescription>
        </DialogHeader>
        <Button variant="outline" asChild>
          <a href={partnerApi.contractSourceUrl(lead.id)}>{tr("original")}</a>
        </Button>
        {current.source?.facts.premium && (
          <blockquote className="text-sm">{current.source.facts.premium.source.text}</blockquote>
        )}
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit(async (review) => {
              try {
                await command.mutateAsync({ action: "contract_review", revision, review });
                onClose();
              } catch {
                /* Displayed by mutation state. */
              }
            })(event);
          }}
        >
          <label className="flex gap-3 text-sm">
            <input
              type="checkbox"
              {...form.register("premiumVerified")}
              disabled={!current.source?.facts.premium}
            />
            {tr("verifyPremium")}
          </label>
          {features.fields.map((field, index) => (
            <fieldset
              key={field.id}
              className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2"
            >
              <BenefitFields
                id={`contract-benefit-${index}`}
                need={lead.category}
                label={form.watch(`features.${index}.label`)}
                category={form.watch(`features.${index}.category`) ?? benefitCategoryOf(field)}
                limit={form.watch(`features.${index}.limit`) ?? null}
                onCategory={(category) => {
                  form.setValue(`features.${index}.category`, category, { shouldDirty: true });
                  form.setValue(`features.${index}.key`, category, { shouldDirty: true });
                }}
                onLimit={(limit) =>
                  form.setValue(`features.${index}.limit`, limit, { shouldDirty: true })
                }
              />
              {(["label", "value", "conditions", "exclusions", "quote"] as const).map((name) => (
                <div key={name} className="space-y-2">
                  <Label htmlFor={`contract-${name}-${index}`}>{tr(name)}</Label>
                  <Input
                    id={`contract-${name}-${index}`}
                    {...form.register(`features.${index}.${name}`)}
                  />
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor={`contract-page-${index}`}>{tr("sourcePage")}</Label>
                <Input
                  id={`contract-page-${index}`}
                  type="number"
                  min={1}
                  max={200}
                  {...form.register(`features.${index}.page`, {
                    setValueAs: (value: string) => (value ? Number(value) : null),
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`contract-coverage-${index}`}>{tr("coverageLabel")}</Label>
                <select
                  id={`contract-coverage-${index}`}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  {...form.register(`features.${index}.coverage`)}
                >
                  {["unknown", "included", "excluded"].map((value) => (
                    <option key={value} value={value}>
                      {tr(`coverage.${value}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`contract-verification-${index}`}>{tr("verificationLabel")}</Label>
                <select
                  id={`contract-verification-${index}`}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  {...form.register(`features.${index}.verification`)}
                >
                  {["to_verify", "verified", "missing"].map((value) => (
                    <option key={value} value={value}>
                      {tr(`verification.${value}`)}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="button" variant="ghost" onClick={() => features.remove(index)}>
                {tr("remove")}
              </Button>
            </fieldset>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={features.fields.length >= 80}
            onClick={() =>
              features.append({
                key: "other",
                label: "",
                value: "",
                conditions: "",
                exclusions: "",
                coverage: "unknown",
                verification: "to_verify",
                page: null,
                quote: "",
              })
            }
          >
            {tr("add")}
          </Button>
          {(command.isError || Object.keys(form.formState.errors).length > 0) && (
            <p role="alert" className="text-sm text-destructive">
              {tr("reviewError")}
            </p>
          )}
          <Button className="ml-3" type="submit" disabled={command.isPending}>
            {tr("saveReview")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
