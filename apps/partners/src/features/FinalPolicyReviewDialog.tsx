import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  finalPolicyFields,
  finalPolicyCheckSchema,
  finalPolicyReviewSchema,
  type FinalPolicy,
  type LeadCommand,
} from "@coverview/contracts/partner";
import { PartnerApiError } from "@coverview/api-client/partner";
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
import { usePartner } from "./PartnerSession";
import { partnerApi } from "../api";

const formSchema = z.object({
  field: z.enum(finalPolicyFields),
  result: z.enum(["same", "difference", "to_verify"]),
  note: z.string().trim().min(2).max(1000),
  offerPage: z.string(),
  offerQuote: z.string().trim().max(1000),
  policyPage: z.string(),
  policyQuote: z.string().trim().max(1000),
});
export function FinalPolicyReviewDialog({
  leadId,
  policy,
  revision,
  onClose,
  onSaved,
}: {
  leadId: string;
  policy: FinalPolicy;
  revision: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation(),
    session = usePartner();
  const tr = (key: string, values: Record<string, unknown> = {}) => t(`policy.${key}`, values);
  const [capturedRevision] = useState(revision),
    [error, setError] = useState(""),
    [frozen, setFrozen] = useState(false),
    [blocked, setBlocked] = useState(false);
  const attempt = useRef<{ input: LeadCommand; key: string } | null>(null);
  const initialCheck = policy.review?.checks.find((item) => item.field === "premium");
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      field: "premium" as (typeof finalPolicyFields)[number],
      result: initialCheck?.result ?? "to_verify",
      note: initialCheck?.note ?? "",
      offerPage: initialCheck?.offerSource?.page.toString() ?? "",
      offerQuote: initialCheck?.offerSource?.quote ?? "",
      policyPage: initialCheck?.policySource?.page.toString() ?? "",
      policyQuote: initialCheck?.policySource?.quote ?? "",
    },
  });
  const pending = form.formState.isSubmitting;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
        closeLabel={tr("close")}
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>{tr("review")}</DialogTitle>
          <DialogDescription>{tr("reviewHelp")}</DialogDescription>
        </DialogHeader>
        <p className="text-sm font-medium">{tr("offer", policy.offer)}</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <a href={partnerApi.sourceUrl(leadId, policy.offer.id)}>{tr("offerSource")}</a>
          </Button>
          <Button variant="outline" asChild>
            <a href={partnerApi.finalPolicySourceUrl(leadId, policy.id)}>{tr("policySource")}</a>
          </Button>
        </div>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit(async (values) => {
              if (!attempt.current) {
                const citation = (page: string, quote: string) =>
                  quote ? { page: Number(page), quote } : null;
                const parsed = finalPolicyCheckSchema.safeParse({
                  field: values.field,
                  result: values.result,
                  note: values.note,
                  offerSource: citation(values.offerPage, values.offerQuote),
                  policySource: citation(values.policyPage, values.policyQuote),
                });
                if (!parsed.success) {
                  setError(tr("requiredSources"));
                  return;
                }
                const review = finalPolicyReviewSchema.parse({
                  policyId: policy.id,
                  checks: [
                    ...(policy.review?.checks ?? []).filter(
                      (check) => check.field !== values.field,
                    ),
                    parsed.data,
                  ],
                });
                attempt.current = {
                  input: { action: "final_policy_review", revision: capturedRevision, review },
                  key: crypto.randomUUID(),
                };
              }
              setFrozen(true);
              setError("");
              try {
                await partnerApi.command(leadId, attempt.current.input, {
                  csrfToken: session.identity.csrfToken,
                  idempotencyKey: attempt.current.key,
                });
                onSaved();
                onClose();
              } catch (cause) {
                const block =
                  cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
                setBlocked(block);
                setError(tr(block ? "conflict" : "retryExact"));
              }
            })(event);
          }}
        >
          <fieldset disabled={frozen || pending} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="policy-check-field">{tr("checkField")}</Label>
              <select
                id="policy-check-field"
                className="w-full rounded-md border border-input bg-background p-3 text-sm"
                {...form.register("field")}
                onChange={(event) => {
                  const field = z.enum(finalPolicyFields).parse(event.target.value),
                    check = policy.review?.checks.find((item) => item.field === field);
                  form.reset({
                    field,
                    result: check?.result ?? "to_verify",
                    note: check?.note ?? "",
                    offerPage: check?.offerSource?.page.toString() ?? "",
                    offerQuote: check?.offerSource?.quote ?? "",
                    policyPage: check?.policySource?.page.toString() ?? "",
                    policyQuote: check?.policySource?.quote ?? "",
                  });
                }}
              >
                {finalPolicyFields.map((field) => (
                  <option key={field} value={field}>
                    {tr(`fields.${field}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-check-result">{tr("checkResult")}</Label>
              <select
                id="policy-check-result"
                className="w-full rounded-md border border-input bg-background p-3 text-sm"
                {...form.register("result")}
              >
                {(["to_verify", "difference", "same"] as const).map((result) => (
                  <option key={result} value={result}>
                    {tr(`results.${result}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-check-note">{tr("note")}</Label>
              <textarea
                id="policy-check-note"
                rows={3}
                maxLength={1000}
                className="w-full rounded-md border border-input bg-background p-3 text-sm"
                {...form.register("note")}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(["offer", "policy"] as const).map((side) => (
                <div key={side} className="space-y-2">
                  <Label htmlFor={`${side}-page`}>
                    {tr("pageLabel", { source: tr(`${side}Source`) })}
                  </Label>
                  <Input
                    id={`${side}-page`}
                    type="number"
                    min={1}
                    max={200}
                    {...form.register(`${side}Page`)}
                  />
                  <Label htmlFor={`${side}-quote`}>
                    {tr("quoteLabel", { source: tr(`${side}Source`) })}
                  </Label>
                  <textarea
                    id={`${side}-quote`}
                    rows={4}
                    maxLength={1000}
                    className="w-full rounded-md border border-input bg-background p-3 text-sm"
                    {...form.register(`${side}Quote`)}
                  />
                </div>
              ))}
            </div>
          </fieldset>
          {(error || Object.keys(form.formState.errors).length > 0) && (
            <p role="alert" className="text-sm text-destructive">
              {error || tr("requiredSources")}
            </p>
          )}
          <Button type="submit" disabled={pending || blocked}>
            {tr(pending ? "saving" : frozen ? "retry" : "saveReview")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
