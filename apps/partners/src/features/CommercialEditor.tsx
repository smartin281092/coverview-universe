import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { insuranceCompanyIdSchema } from "@coverview/contracts";
import { leadCategorySchema } from "@coverview/contracts/partner";
import { commercialInputSchema } from "@coverview/contracts/partner-economy";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { EconomyForm, value, values, decimal, instant, type EconomyField } from "./EconomyForm";
import { economyQueryPolicy } from "./EconomyViews";
export function CommercialEditor({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("economy"),
    session = usePartner();
  const directory = useQuery({
    queryKey: [...session.queryKey, "directory"],
    queryFn: ({ signal }) => partnerApi.directory(signal),
    ...economyQueryPolicy,
  });
  const options = (items: string[], prefix: string) =>
    items.map((v) => ({ value: v, label: t(`${prefix}.${v}`) }));
  const field = (name: string, type: EconomyField["type"] = "textarea"): EconomyField => ({
    name,
    type,
    label: t(`fields.${name}`),
  });
  const fields: EconomyField[] = [
    {
      ...field("categories", "multi"),
      options: options(leadCategorySchema.options, "partner:category"),
    },
    {
      ...field("companies", "multi"),
      options: insuranceCompanyIdSchema.options.map((value) => ({ value, label: value })),
    },
    field("validFrom", "datetime-local"),
    field("validUntil", "datetime-local"),
    { ...field("model", "select"), options: options(["fixed", "success"], "model") },
    { ...field("fixedAmount", "text"), show: (v) => value(v, "model") === "fixed" },
    { ...field("successRate", "text"), show: (v) => value(v, "model") === "success" },
    {
      ...field("fixedTrigger", "select"),
      options: options(["authorized_handover", "documented_qualification"], "trigger"),
      show: (v) => value(v, "model") === "fixed",
    },
    field("basis"),
    field("coverviewRate", "text"),
    { ...field("collector", "select"), options: options(["coverview", "receiver"], "collector") },
    field("sourceReference"),
    ...(
      [
        "reserveTerms",
        "clawbackTerms",
        "paymentTerms",
        "validityCriteria",
        "replacementRefundTerms",
        "branchRules",
        "caps",
        "taxTreatment",
        "bonusTerms",
      ] as const
    ).map((n) => field(n)),
    field("disputeDays", "text"),
    {
      ...field("deductionCount", "select"),
      options: Array.from({ length: 11 }, (_, i) => ({ value: String(i), label: String(i) })),
    },
  ];
  for (let i = 0; i < 10; i++)
    for (const part of ["code", "description"])
      fields.push({
        name: `d${i}_${part}`,
        label: t(`fields.deduction_${part}`, { n: i + 1 }),
        type: part === "code" ? "text" : "textarea",
        show: (v) => Number(value(v, "deductionCount")) > i,
      });
  fields.push({
    ...field("contributorCount", "select"),
    options: Array.from({ length: 9 }, (_, i) => ({ value: String(i), label: String(i) })),
  });
  for (let i = 0; i < 8; i++)
    for (const part of ["userId", "rate", "basisReference"])
      fields.push({
        name: `c${i}_${part}`,
        label: t(`fields.contributor_${part}`, { n: i + 1 }),
        type: part === "userId" ? "select" : part === "rate" ? "text" : "textarea",
        ...(part === "userId"
          ? {
              options: directory.isError
                ? []
                : (directory.data?.items
                    .filter((p) => p.id !== session.identity.user.id)
                    .map((p) => ({ value: p.id, label: `${p.name} · ${p.organization}` })) ?? []),
            }
          : {}),
        show: (v) => Number(value(v, "contributorCount")) > i,
      });
  fields.push({ name: "confirmed", type: "checkbox", label: t("commercialConsent") });
  return (
    <EconomyForm
      title={t("newTerms")}
      description={t("termsIntro")}
      fields={fields}
      initial={{ deductionCount: "0", contributorCount: "0" }}
      enabled={!directory.isError && !directory.isPending}
      parse={(v) =>
        commercialInputSchema.parse({
          confirmed: v.confirmed,
          terms: {
            categories: values(v, "categories"),
            companies: values(v, "companies"),
            validFrom: instant(v, "validFrom"),
            validUntil: instant(v, "validUntil"),
            supplier:
              value(v, "model") === "fixed"
                ? {
                    model: "fixed",
                    amountMinor: decimal(v, "fixedAmount"),
                    payer: "receiver",
                    trigger: value(v, "fixedTrigger"),
                  }
                : {
                    model: "success",
                    rateBps: decimal(v, "successRate"),
                    trigger: "commission_received",
                  },
            currency: "CHF",
            basis: value(v, "basis"),
            coverviewRateBps: decimal(v, "coverviewRate"),
            collector: value(v, "collector"),
            disputeDays: Number(value(v, "disputeDays")),
            deductions: Array.from({ length: Number(value(v, "deductionCount")) }, (_, i) => ({
              code: value(v, `d${i}_code`),
              description: value(v, `d${i}_description`),
            })),
            contributors: Array.from({ length: Number(value(v, "contributorCount")) }, (_, i) => ({
              userId: value(v, `c${i}_userId`),
              rateBps: decimal(v, `c${i}_rate`),
              basisReference: value(v, `c${i}_basisReference`),
            })),
            ...Object.fromEntries(
              [
                "sourceReference",
                "reserveTerms",
                "clawbackTerms",
                "paymentTerms",
                "validityCriteria",
                "replacementRefundTerms",
                "branchRules",
                "caps",
                "taxTreatment",
                "bonusTerms",
              ].map((n) => [n, value(v, n)]),
            ),
          },
        })
      }
      onSend={(v, o) => partnerApi.createCommercialCondition(v, o)}
      onClose={onClose}
    />
  );
}
