import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  leadOfferInputSchema,
  type LeadDetail,
  type LeadOffer,
  type OfferImport,
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
import { api, partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { useLeadCommand } from "./use-lead-command";
import { localDateTime, formatMoney, zurichInstant } from "./Field";
const schema = leadOfferInputSchema
  .omit({ annualPremiumMinor: true, validUntil: true })
  .extend({ premium: z.string().regex(/^(?:\d{1,8}(?:[.,]\d{1,2})?)?$/u), validUntil: z.string() });
function minor(value: string) {
  if (!value) return null;
  const [units, cents = ""] = value.replace(",", ".").split(".");
  return Number(BigInt(units!) * 100n + BigInt(cents.padEnd(2, "0")));
}
export function OfferDialog({
  lead,
  previous,
  imported,
  onClose,
}: {
  lead: LeadDetail;
  previous?: LeadOffer;
  imported?: OfferImport;
  onClose: () => void;
}) {
  const { t } = useTranslation(),
    session = usePartner(),
    command = useLeadCommand(lead.id),
    [revision] = useState(lead.revision),
    [error, setError] = useState(""),
    [uploading, setUploading] = useState(false);
  const operation = useRef<{ key: string; id?: string; file?: File }>({ key: crypto.randomUUID() });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      company: previous?.company ?? "",
      product: previous?.product ?? "",
      documentId: imported?.documentId ?? previous?.documentId ?? "",
      replacesId: previous?.id ?? null,
      reference: previous?.reference ?? "",
      premium:
        previous?.annualPremiumMinor == null ? "" : String(previous.annualPremiumMinor / 100),
      currency: "CHF",
      validUntil: localDateTime(previous?.validUntil ?? null),
      effectiveDate: previous?.effectiveDate ?? null,
      features: previous?.features ?? [],
      summary: previous?.summary ?? "",
      limitations: previous?.limitations ?? "",
    },
  });
  const features = useFieldArray({ control: form.control, name: "features" }),
    documentId = form.watch("documentId");
  const [sourceFingerprint, setSourceFingerprint] = useState<string | null>(null);
  const extraction = useQuery({
    queryKey: [...session.queryKey, "extraction", lead.id, documentId],
    queryFn: ({ signal }) => partnerApi.extraction(lead.id, documentId, signal),
    enabled: !!documentId,
    gcTime: 0,
    refetchInterval: 5000,
    retry: false,
  });
  async function upload(file: File) {
    if (!file.size || file.size > 20 * 1024 * 1024) {
      setError(t("errors.PARTNER_INVALID_DOCUMENT"));
      return;
    }
    setUploading(true);
    setError("");
    if (operation.current.file !== file) operation.current = { key: crypto.randomUUID(), file };
    const options = {
      csrfToken: session.identity.csrfToken,
      idempotencyKey: operation.current.key,
    };
    try {
      if (!operation.current.id) {
        const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
        const checksum = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join("");
        const document = await api.createDocument(
          {
            name: file.name,
            mime: file.type || "application/octet-stream",
            size: file.size,
            checksum,
            analysisRequested: true,
            purpose: "lead_offer",
            detectProfile: false,
          },
          options,
        );
        operation.current.id = document.id;
      }
      const document = await api.uploadDocument(operation.current.id, file, options);
      form.setValue("documentId", document.id, { shouldValidate: true });
      setSourceFingerprint(null);
    } catch {
      setError(t("error"));
    } finally {
      setUploading(false);
    }
  }
  const input = (
    name: "company" | "product" | "reference" | "premium" | "validUntil" | "effectiveDate",
    type = "text",
  ) => (
    <div className="space-y-2" key={name}>
      <Label htmlFor={`offer-${name}`}>{t(`field.${name}`)}</Label>
      <Input
        id={`offer-${name}`}
        type={type}
        {...form.register(name, {
          ...(name === "effectiveDate" ? { setValueAs: (value: unknown) => value || null } : {}),
        })}
        aria-invalid={!!form.formState.errors[name]}
      />
    </div>
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !uploading && !command.isPending) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t(previous ? "offer.newVersion" : "detail.offer")}</DialogTitle>
          <DialogDescription>
            {t(previous ? "offer.replaceHelp" : "offer.sourceHelp")}
          </DialogDescription>
        </DialogHeader>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("offer.extractionNotice")}
        </p>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            void form.handleSubmit(async (values) => {
              setError("");
              try {
                const { premium, validUntil, ...offer } = values;
                await command.mutateAsync({
                  action: "offer",
                  revision,
                  offer: {
                    ...offer,
                    sourceFingerprint: sourceFingerprint!,
                    annualPremiumMinor: minor(premium),
                    validUntil: validUntil ? zurichInstant(validUntil) : null,
                  },
                });
                onClose();
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
          <div className="rounded-xl border border-dashed border-input p-5">
            {imported ? (
              <p className="break-words font-medium">{imported.name}</p>
            ) : (
              <>
                <Label htmlFor="offer-file">{t("offer.upload")}</Label>
                <Input
                  id="offer-file"
                  type="file"
                  className="mt-3"
                  disabled={uploading || command.isPending}
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void upload(file);
                  }}
                />
              </>
            )}
            {uploading && (
              <p role="status" className="mt-3 text-sm">
                {t("offer.uploading")}
              </p>
            )}
            {documentId && !extraction.data && !extraction.isError && (
              <p className="mt-3 text-xs text-muted-foreground">{t("offer.processing")}</p>
            )}
            {extraction.data && (
              <div className="mt-3 space-y-2 text-sm" role="status">
                <p>{t(`imports.state.${extraction.data.state}`)}</p>
                <p className="text-muted-foreground">
                  {t(`imports.analysis.${extraction.data.analysisStatus ?? "absent"}`)}
                </p>
                {extraction.data.failure && (
                  <p>
                    {t(`imports.failure.${extraction.data.failure}`, {
                      defaultValue: t("imports.failure.other"),
                    })}
                  </p>
                )}
              </div>
            )}
            {extraction.data?.annualPremiumMinor != null && (
              <div className="mt-4 space-y-2">
                <p className="text-sm">
                  {t("offer.extractedPremium", {
                    amount: formatMoney(extraction.data.annualPremiumMinor),
                  })}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const value = extraction.data!;
                    if (value.company && !form.getValues("company"))
                      form.setValue("company", value.company);
                    if (value.product && !form.getValues("product"))
                      form.setValue("product", value.product);
                    if (value.annualPremiumMinor !== null)
                      form.setValue("premium", String(value.annualPremiumMinor / 100));
                    if (value.reference) form.setValue("reference", value.reference);
                    if (value.effectiveDate) form.setValue("effectiveDate", value.effectiveDate);
                  }}
                >
                  {t("offer.useExtraction")}
                </Button>
              </div>
            )}
          </div>
          {extraction.data?.sourceFingerprint && (
            <div className="space-y-2">
              {imported ? (
                <Button type="button" variant="outline" asChild>
                  <a href={partnerApi.importSourceUrl(lead.id, imported.id)}>{t("offer.source")}</a>
                </Button>
              ) : previous?.documentId === documentId ? (
                <Button type="button" variant="outline" asChild>
                  <a href={partnerApi.sourceUrl(lead.id, previous.id)}>{t("offer.source")}</a>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void api
                      .downloadDocument(documentId)
                      .then((blob) => {
                        const url = URL.createObjectURL(blob),
                          anchor = document.createElement("a");
                        anchor.href = url;
                        anchor.download = operation.current.file?.name ?? "document";
                        anchor.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      })
                      .catch(() => setError(t("error")));
                  }}
                >
                  {t("offer.source")}
                </Button>
              )}
              <p className="text-sm text-muted-foreground">{t("offer.bindHelp")}</p>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={sourceFingerprint === extraction.data.sourceFingerprint}
                  onChange={(event) =>
                    setSourceFingerprint(
                      event.target.checked ? (extraction.data?.sourceFingerprint ?? null) : null,
                    )
                  }
                />
                {t("offer.bindSource")}
              </label>
            </div>
          )}
          {extraction.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t("error")}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {input("company")}
            {input("product")}
            {input("reference")}
            {input("premium")}
            {input("validUntil", "datetime-local")}
            {input("effectiveDate", "date")}
          </div>
          <div className="space-y-3">
            <h3 className="font-medium">{t("field.features")}</h3>
            {features.fields.map((field, index) => (
              <fieldset
                key={field.id}
                className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2"
              >
                <div className="space-y-2">
                  <Label htmlFor={`key-${index}`}>{t("field.featureLabel")}</Label>
                  <select
                    id={`key-${index}`}
                    {...form.register(`features.${index}.key`)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {[
                      "deductible",
                      "collision",
                      "parking",
                      "assistance",
                      "replacement_vehicle",
                      "hospitalization",
                      "dental",
                      "death",
                      "disability",
                      "fees",
                      "exclusions",
                      "other",
                    ].map((key) => (
                      <option key={key} value={key}>
                        {t(`benefit.${key}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`label-${index}`}>{t("field.featureLabel")}</Label>
                  <Input id={`label-${index}`} {...form.register(`features.${index}.label`)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`value-${index}`}>{t("field.featureValue")}</Label>
                  <Input id={`value-${index}`} {...form.register(`features.${index}.value`)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`source-${index}`}>{t("field.featureSource")}</Label>
                  <Input id={`source-${index}`} {...form.register(`features.${index}.source`)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`conditions-${index}`}>{t("field.featureConditions")}</Label>
                  <Input
                    id={`conditions-${index}`}
                    {...form.register(`features.${index}.conditions`)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`verified-${index}`}>{t("field.verification")}</Label>
                  <select
                    id={`verified-${index}`}
                    {...form.register(`features.${index}.verification`)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="to_verify">{t("offer.toVerify")}</option>
                    <option value="verified">{t("offer.verified")}</option>
                    <option value="missing">{t("offer.missing")}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`coverage-${index}`}>{t("contract.coverageLabel")}</Label>
                  <select
                    id={`coverage-${index}`}
                    {...form.register(`features.${index}.coverage`)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {["unknown", "included", "excluded"].map((value) => (
                      <option key={value} value={value}>
                        {t(`contract.coverage.${value}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`exclusions-${index}`}>{t("contract.exclusions")}</Label>
                  <Input
                    id={`exclusions-${index}`}
                    {...form.register(`features.${index}.exclusions`)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`source-page-${index}`}>{t("contract.sourcePage")}</Label>
                  <Input
                    id={`source-page-${index}`}
                    type="number"
                    min={1}
                    max={20}
                    {...form.register(`features.${index}.sourcePage`, {
                      setValueAs: (value: string) => (value ? Number(value) : null),
                    })}
                  />
                </div>
                <Button type="button" variant="ghost" onClick={() => features.remove(index)}>
                  {t("offer.removeFeature")}
                </Button>
              </fieldset>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                features.append({
                  key: "other",
                  label: "",
                  value: "",
                  conditions: "",
                  source: "",
                  origin: "manual",
                  verification: "to_verify",
                })
              }
            >
              {t("offer.addFeature")}
            </Button>
          </div>
          {(["summary", "limitations"] as const).map((name) => (
            <div className="space-y-2" key={name}>
              <Label htmlFor={`offer-${name}`}>{t(`field.${name}`)}</Label>
              <textarea
                id={`offer-${name}`}
                {...form.register(name)}
                rows={3}
                className="w-full rounded-md border border-input bg-background p-3 text-sm"
              />
            </div>
          ))}
          {(error || Object.keys(form.formState.errors).length > 0) && (
            <p role="alert" className="text-sm text-destructive">
              {error || t("errors.PARTNER_ACTION_REQUIRED")}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={uploading || command.isPending}
              onClick={onClose}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={
                !documentId ||
                !sourceFingerprint ||
                sourceFingerprint !== extraction.data?.sourceFingerprint ||
                extraction.isError ||
                uploading ||
                command.isPending
              }
            >
              {t("offer.add")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
