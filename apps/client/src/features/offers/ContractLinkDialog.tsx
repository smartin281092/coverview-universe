import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { IdentityMe } from "@coverview/api-client";
import { type LeadDetail, leadCommandSchema } from "@coverview/contracts/partner";
import {
  Button,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  LoadingState,
  EmptyState,
  ErrorState,
  SelectField,
} from "@coverview/ui";
import { partnerApi } from "../../partner-api";
const schema = z.object({
  documentId: z.string().min(1),
  sameObjectConfirmed: z.boolean().refine(Boolean),
  sharingConfirmed: z.boolean().refine(Boolean),
});
export function ContractLinkDialog({
  lead,
  identity,
  onClose,
  onSaved,
}: {
  lead: LeadDetail;
  identity: IdentityMe;
  onClose: () => void;
  onSaved: (lead: LeadDetail) => void;
}) {
  const { t } = useTranslation("offers");
  const tr = (key: string, values: Record<string, unknown> = {}) => t(`contract.${key}`, values);
  const [error, setError] = useState("");
  const [revision] = useState(lead.revision);
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { documentId: "", sameObjectConfirmed: false, sharingConfirmed: false },
  });
  const query = useQuery({
    queryKey: [
      "private",
      identity.user.id,
      identity.session.id,
      "contract-candidates",
      lead.id,
      lead.revision,
    ],
    queryFn: ({ signal }) => partnerApi.contractCandidates(lead.id, signal),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  const selected = query.data?.items.find((item) => item.documentId === form.watch("documentId"));
  // A single exact match on the request's reference is proposed, never confirmed for the owner.
  const proposal = query.data?.proposal ?? null;
  useEffect(() => {
    if (proposal && !form.getValues("documentId")) form.setValue("documentId", proposal.documentId);
  }, [proposal, form]);
  const option = (item: NonNullable<typeof query.data>["items"][number]) => ({
    value: item.documentId,
    label: tr("candidate", {
      company: item.facts.companyId,
      policy: item.contract.policyNumber ?? tr("missing"),
      object: item.contract.insuredSubject ?? item.contract.title,
    }),
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
        className="max-h-[90svh] overflow-y-auto"
        closeLabel={tr("close")}
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>{tr("link")}</DialogTitle>
          <DialogDescription>
            {tr("linkHelp", { client: lead.clientName, object: lead.object })}
          </DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <LoadingState label={t("loading")} />
        ) : query.isError ? (
          <ErrorState
            title={t("error")}
            description={t("error")}
            retryLabel={t("retry")}
            pendingLabel={t("loading")}
            onRetry={() => void query.refetch()}
          />
        ) : !query.data.items.length ? (
          <EmptyState title={tr("empty")} description={tr("emptyHelp")} />
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit(async (values) => {
                if (!selected) return;
                const input = leadCommandSchema.parse({
                  action: "contract_link",
                  revision,
                  ...values,
                  fingerprint: selected.fingerprint,
                });
                const payload = JSON.stringify(input);
                if (attempt.current?.payload !== payload)
                  attempt.current = { payload, key: crypto.randomUUID() };
                setError("");
                try {
                  const result = await partnerApi.command(
                    lead.id,
                    input,
                    { csrfToken: identity.csrfToken, idempotencyKey: attempt.current.key },
                    true,
                  );
                  onSaved(result);
                  onClose();
                } catch {
                  setError(tr("conflict"));
                }
              })(event);
            }}
          >
            <Label htmlFor="current-contract">{tr("choose")}</Label>
            <SelectField
              id="current-contract"
              value={form.watch("documentId")}
              placeholder={tr("choose")}
              onValueChange={(value) => {
                form.setValue("documentId", value);
                form.setValue("sameObjectConfirmed", false);
                form.setValue("sharingConfirmed", false);
              }}
              options={[
                ...(query.data.compatible.length > 0
                  ? [
                      {
                        label: tr("compatibleGroup"),
                        options: query.data.items
                          .filter((item) => query.data.compatible.includes(item.documentId))
                          .map(option),
                      },
                    ]
                  : []),
                {
                  label: tr(query.data.compatible.length ? "otherGroup" : "allGroup"),
                  options: query.data.items
                    .filter((item) => !query.data.compatible.includes(item.documentId))
                    .map(option),
                },
              ]}
            />
            {selected && (
              <div className="space-y-3 text-sm">
                {proposal?.documentId === selected.documentId && (
                  <p className="rounded-lg bg-muted p-3">{tr(`proposal.${proposal.reason}`)}</p>
                )}
                <p>
                  {tr("documentDates", {
                    start: selected.contract.startsOn ?? tr("missing"),
                    end: selected.contract.endsOn ?? tr("missing"),
                  })}
                </p>
                <Button variant="outline" asChild>
                  <Link
                    to="/documents/$documentId"
                    params={{ documentId: selected.documentId }}
                    search={{ profile: lead.clientProfileId ?? "self" }}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {tr("inspect")}
                  </Link>
                </Button>
              </div>
            )}
            <label className="flex gap-3 text-sm">
              <input type="checkbox" {...form.register("sameObjectConfirmed")} />
              {tr("sameObject", { client: lead.clientName, object: lead.object })}
            </label>
            <label className="flex gap-3 text-sm">
              <input type="checkbox" {...form.register("sharingConfirmed")} />
              {tr("share")}
            </label>
            {(error || Object.keys(form.formState.errors).length > 0) && (
              <p role="alert" className="text-sm text-destructive">
                {error || tr("required")}
              </p>
            )}
            {query.data.truncated && <p className="text-sm">{tr("truncated")}</p>}
            <Button type="submit" disabled={pending || !selected}>
              {tr("confirm")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
