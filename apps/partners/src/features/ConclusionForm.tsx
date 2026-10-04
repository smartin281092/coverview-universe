import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import type { LeadDetail } from "@coverview/contracts/partner";
import {
  conclusionActionSchema,
  conclusionPrepareSchema,
  type Conclusion,
} from "@coverview/contracts/partner-conclusion";
import { Button, Input, Label, parseZurichDateTime } from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
type Editor =
  | { kind: "prepare"; revision: number }
  | { kind: "correct"; item: Conclusion; targetActionId: string }
  | { kind: Conclusion["availableActions"][number]; item: Conclusion };
const fields = z.object({
  offerId: z.string(),
  validUntil: z.string(),
  page: z.string(),
  quote: z.string().max(2000),
  reason: z.string().max(2000),
  occurredAt: z.string(),
  reference: z.string().max(1000),
  policyId: z.string(),
  sourceKind: z.enum(["policy", "correspondence"]),
  fingerprint: z.string(),
  confirmed: z.boolean(),
});
export function ConclusionForm({
  lead,
  editor,
  enabled,
  onSaved,
  onBack,
}: {
  lead: LeadDetail;
  editor: Editor;
  enabled: boolean;
  onSaved: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation("conclusion"),
    session = usePartner(),
    [error, setError] = useState("");
  const [policyPages, setPolicyPages] = useState<(string | undefined)[]>([undefined]);
  const evidence = !["prepare", "withdraw", "transmitted", "correct"].includes(editor.kind);
  const correspondences = useQuery({
    queryKey: [...session.queryKey, "conclusion-correspondences", lead.id, policyPages.at(-1)],
    queryFn: ({ signal }) =>
      partnerApi.conclusionCorrespondences(lead.id, false, policyPages.at(-1), signal),
    enabled: evidence && editor.kind !== "issued",
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 10000,
  });
  const policies = useQuery({
    queryKey: [...session.queryKey, "conclusion-policies", lead.id, policyPages.at(-1)],
    queryFn: ({ signal }) => partnerApi.finalPolicies(lead.id, policyPages.at(-1), signal),
    enabled: evidence,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 10000,
  });
  const form = useForm({
    resolver: zodResolver(fields),
    defaultValues: {
      offerId: "",
      validUntil: "",
      page: "",
      quote: "",
      reason: "",
      occurredAt: "",
      reference: "",
      policyId: "",
      sourceKind: "policy" as const,
      fingerprint: "",
      confirmed: false,
    },
  });
  const attempt = useRef<{ payload: string; key: string } | null>(null),
    abort = useRef(new AbortController());
  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    return () => controller.abort();
  }, []);
  const mutation = useMutation({
    mutationKey: [...session.queryKey, "conclusion-action"],
    gcTime: 0,
    retry: false,
    mutationFn: (values: z.infer<typeof fields>) => {
      const instant = (value: string) => {
        try {
          return value ? parseZurichDateTime(value) : "";
        } catch (error) {
          setError(t("invalidProfessional"));
          throw error;
        }
      };
      const citation = { page: Number(values.page), quote: values.quote };
      const parsed =
        editor.kind === "prepare"
          ? conclusionPrepareSchema.safeParse({
              leadRevision: editor.revision,
              offerId: values.offerId,
              sourceFingerprint: lead.offers.find((o) => o.id === values.offerId)
                ?.sourceFingerprint,
              validUntil: instant(values.validUntil),
              procedure: citation,
              explanation: values.reason,
              reviewedApplicability: values.confirmed,
            })
          : conclusionActionSchema.safeParse({
              action: editor.kind,
              revision: editor.item.revision,
              reason: values.reason,
              ...(editor.kind !== "withdraw"
                ? {
                    ...(editor.kind === "correct"
                      ? { targetActionId: editor.targetActionId }
                      : { occurredAt: instant(values.occurredAt) }),
                    verified: values.confirmed,
                  }
                : {}),
              ...(editor.kind === "transmitted"
                ? { reference: values.reference }
                : evidence
                  ? {
                      [values.sourceKind === "policy" ? "policyId" : "correspondenceId"]:
                        values.policyId,
                      fingerprint: values.fingerprint,
                      source: citation,
                    }
                  : {}),
            });
      if (!parsed.success) {
        setError(t("invalidProfessional"));
        throw new Error("Invalid conclusion input");
      }
      const payload = JSON.stringify(parsed.data);
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      const options = {
        csrfToken: session.identity.csrfToken,
        idempotencyKey: attempt.current.key,
        signal: abort.current.signal,
      };
      return editor.kind === "prepare"
        ? partnerApi.prepareConclusion(lead.id, conclusionPrepareSchema.parse(parsed.data), options)
        : partnerApi.actConclusion(
            editor.item.id,
            conclusionActionSchema.parse(parsed.data),
            options,
          );
    },
    onSuccess: () => {
      if (!abort.current.signal.aborted) onSaved();
    },
  });
  const selectedPolicy = policies.data?.items.find((p) => p.id === form.watch("policyId"));
  const sourceKind = form.watch("sourceKind"),
    selectedCorrespondence = correspondences.data?.items.find(
      (p) => p.id === form.watch("policyId"),
    );
  const sourceQuery = sourceKind === "policy" ? policies : correspondences;
  const changed = editor.kind === "prepare" ? editor.revision !== lead.revision : false;
  const disabled =
    !enabled ||
    changed ||
    mutation.isPending ||
    (evidence && (sourceQuery.isError || sourceQuery.isPending));
  const selectedOffer = editor.kind === "prepare" ? form.watch("offerId") : editor.item.offerId;
  return (
    <form
      className="space-y-4"
      onSubmit={(event) =>
        void form.handleSubmit((values) => {
          setError("");
          mutation.mutate(values);
        })(event)
      }
    >
      <Button type="button" variant="outline" onClick={onBack} disabled={mutation.isPending}>
        {t("back")}
      </Button>
      <h3 className="font-semibold">
        {t(editor.kind === "prepare" ? "prepare" : `actions.${editor.kind}`)}
      </h3>
      <p className="text-sm text-muted-foreground">
        {t(
          editor.kind === "prepare"
            ? "prepareHelp"
            : editor.kind === "correct"
              ? "correctionHelp"
              : evidence
                ? "evidenceHelp"
                : "transmissionHelp",
        )}
      </p>
      <fieldset className="space-y-4" disabled={disabled}>
        {editor.kind === "prepare" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="conclusion-offer">{t("selectOffer")}</Label>
              <select
                id="conclusion-offer"
                className="w-full rounded-md border border-input bg-background p-3"
                {...form.register("offerId")}
              >
                <option value="">{t("choose")}</option>
                {lead.offers
                  .filter((o) => o.state === "selected" && o.canChoose)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {t("offer", o)}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="conclusion-validity">{t("validUntil")}</Label>
              <Input
                id="conclusion-validity"
                type="datetime-local"
                {...form.register("validUntil")}
              />
            </div>
          </>
        )}
        {selectedOffer && (
          <Button type="button" asChild variant="outline">
            <a href={partnerApi.sourceUrl(lead.id, selectedOffer)}>{t("original")}</a>
          </Button>
        )}
        {evidence && (
          <>
            {editor.kind !== "issued" && (
              <div className="space-y-2">
                <Label htmlFor="conclusion-source-kind">{t("sourceKind")}</Label>
                <select
                  id="conclusion-source-kind"
                  className="w-full rounded-md border border-input bg-background p-3"
                  {...form.register("sourceKind")}
                  onChange={(event) => {
                    form.setValue(
                      "sourceKind",
                      event.target.value === "correspondence" ? "correspondence" : "policy",
                    );
                    form.setValue("policyId", "");
                    form.setValue("fingerprint", "");
                    setPolicyPages([undefined]);
                  }}
                >
                  <option value="policy">{t("selectPolicy")}</option>
                  <option value="correspondence">{t("correspondences")}</option>
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="conclusion-policy">
                {t(sourceKind === "policy" ? "selectPolicy" : "correspondences")}
              </Label>
              <select
                id="conclusion-policy"
                className="w-full rounded-md border border-input bg-background p-3"
                {...form.register("policyId")}
                onChange={(event) => {
                  form.setValue("policyId", event.target.value);
                  form.setValue(
                    "fingerprint",
                    (sourceKind === "policy"
                      ? policies.data?.items.find((p) => p.id === event.target.value)?.source
                          ?.fingerprint
                      : correspondences.data?.items.find((p) => p.id === event.target.value)
                          ?.fingerprint) ?? "",
                  );
                }}
              >
                <option value="">{t("choose")}</option>
                {sourceKind === "policy"
                  ? policies.data?.items
                      .filter((p) => p.offer.id === selectedOffer && p.status === "available")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.source?.contract.policyNumber ?? p.source?.contract.title ?? p.id}
                        </option>
                      ))
                  : correspondences.data?.items
                      .filter((p) => p.current)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
              </select>
            </div>
            {sourceKind === "policy" && selectedPolicy && (
              <Button asChild variant="outline">
                <a href={partnerApi.finalPolicySourceUrl(lead.id, selectedPolicy.id)}>
                  {t("policyOriginal")}
                </a>
              </Button>
            )}
            {sourceKind === "correspondence" && selectedCorrespondence?.canDownload && (
              <Button asChild variant="outline">
                <a
                  href={partnerApi.conclusionCorrespondenceSourceUrl(
                    lead.id,
                    selectedCorrespondence.id,
                  )}
                >
                  {t("correspondenceOriginal")}
                </a>
              </Button>
            )}
            <div className="flex flex-wrap gap-3">
              {policyPages.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    form.setValue("policyId", "");
                    form.setValue("fingerprint", "");
                    setPolicyPages(policyPages.slice(0, -1));
                  }}
                >
                  {t("previous")}
                </Button>
              )}
              {sourceQuery.data?.nextCursor && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    form.setValue("policyId", "");
                    form.setValue("fingerprint", "");
                    setPolicyPages([...policyPages, sourceQuery.data.nextCursor!]);
                  }}
                >
                  {t("next")}
                </Button>
              )}
            </div>
          </>
        )}
        {(editor.kind === "prepare" || evidence) && (
          <>
            <div className="space-y-2">
              <Label htmlFor="conclusion-page">{t("page")}</Label>
              <Input
                id="conclusion-page"
                type="number"
                min="1"
                max="200"
                {...form.register("page")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conclusion-quote">{t("quote")}</Label>
              <textarea
                id="conclusion-quote"
                className="min-h-24 w-full rounded-md border border-input bg-background p-3"
                {...form.register("quote")}
              />
            </div>
          </>
        )}
        {editor.kind !== "prepare" && editor.kind !== "withdraw" && editor.kind !== "correct" && (
          <div className="space-y-2">
            <Label htmlFor="conclusion-occurred">{t("occurredAt")}</Label>
            <Input
              id="conclusion-occurred"
              type="datetime-local"
              step="1"
              {...form.register("occurredAt")}
            />
          </div>
        )}
        {editor.kind === "transmitted" && (
          <div className="space-y-2">
            <Label htmlFor="conclusion-reference">{t("reference")}</Label>
            <Input id="conclusion-reference" {...form.register("reference")} />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="conclusion-reason">
            {t(editor.kind === "prepare" ? "explanation" : "reason")}
          </Label>
          <textarea
            id="conclusion-reason"
            className="min-h-24 w-full rounded-md border border-input bg-background p-3"
            {...form.register("reason")}
          />
        </div>
        {editor.kind !== "withdraw" && (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" {...form.register("confirmed")} />
            {t(editor.kind === "prepare" ? "reviewedApplicability" : "verified")}
          </label>
        )}
      </fieldset>
      {(changed ||
        mutation.isError ||
        (evidence && sourceQuery.isError) ||
        !!Object.keys(form.formState.errors).length) && <p role="alert">{error || t("error")}</p>}
      <Button type="submit" disabled={disabled}>
        {t(mutation.isPending ? "saving" : "save")}
      </Button>
    </form>
  );
}
