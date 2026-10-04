import { useTranslation } from "react-i18next";
import { economyRecordSchema, type EconomyCase } from "@coverview/contracts/partner-economy";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { EconomyForm, value, instant, decimal, type EconomyField } from "./EconomyForm";
export function EconomyEntryEditor({
  item,
  enabled,
  onClose,
}: {
  item: EconomyCase;
  enabled: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("economy"),
    session = usePartner();
  const available = session.context.administrator
    ? [
        "estimate",
        "confirm",
        "receive",
        ...(item.stream === "lead_price" ? ["refund"] : ["reserve", "release", "pay"]),
        "clawback",
        "recover",
        "dispute",
        "resolve_dispute",
        "reconcile",
        "reverse",
      ]
    : ["receive", ...(item.stream === "lead_price" ? ["refund"] : ["pay"]), "recover", "reconcile"];
  const show = (kinds: string[]) => (v: Record<string, unknown>) => kinds.includes(String(v.kind));
  const field = (
    name: string,
    type: EconomyField["type"] = "textarea",
    kinds?: string[],
  ): EconomyField => ({
    name,
    type,
    label: t(`fields.${name}`),
    ...(kinds ? { show: show(kinds) } : {}),
  });
  const fields: EconomyField[] = [
    {
      ...field("kind", "select"),
      options: available.map((value) => ({ value, label: t(`kind.${value}`) })),
    },
    field("minimumMinor", "text", ["estimate"]),
    field("maximumMinor", "text", ["estimate"]),
    { ...field("probabilityBps", "text", ["estimate"]), optional: true },
    field("assumptions", "textarea", ["estimate"]),
    field("grossMinor", "text", ["confirm", "receive"]),
    ...(item.terms?.deductions.map((d) => ({
      ...field(`deduction_${d.code}`, "text", ["confirm", "receive"]),
      label: `${t("fields.deduction")} · ${d.code} · ${d.description}`,
      optional: true,
    })) ?? []),
    field("triggerReference", "textarea", ["confirm"]),
    field("statementReference", "textarea", ["receive", "reconcile"]),
    field("settlementReference", "textarea", ["receive", "reconcile"]),
    {
      ...field("beneficiary", "select", [
        "reserve",
        "release",
        "pay",
        "clawback",
        "recover",
        "dispute",
        "resolve_dispute",
        "refund",
      ]),
      options: item.balances.map((b) => ({ value: b.beneficiary, label: b.name })),
    },
    field("amountMinor", "text", [
      "reserve",
      "release",
      "pay",
      "clawback",
      "recover",
      "dispute",
      "resolve_dispute",
      "refund",
    ]),
    field("expectedMinor", "text", ["reconcile"]),
    field("observedMinor", "text", ["reconcile"]),
    field("explanation", "textarea", ["reconcile"]),
    {
      ...field("entryId", "select", ["reverse"]),
      options: item.history
        .filter((h) => !h.reversed && h.entry.kind !== "reverse")
        .map((h) => ({ value: h.id, label: `${h.revision} · ${t(`kind.${h.entry.kind}`)}` })),
    },
    field("reason", "textarea", ["reverse"]),
    field("proofReference"),
    field("occurredAt", "datetime-local"),
    { name: "evidenceChecked", type: "checkbox", label: t("entryConsent") },
  ];
  return (
    <EconomyForm
      title={t("newEntry")}
      description={t("entryIntro")}
      fields={fields}
      enabled={enabled}
      parse={(v) => {
        const kind = value(v, "kind"),
          proof = { reference: value(v, "proofReference"), occurredAt: instant(v, "occurredAt") };
        let entry: unknown;
        if (kind === "estimate")
          entry = {
            kind,
            minimumMinor: decimal(v, "minimumMinor"),
            maximumMinor: decimal(v, "maximumMinor"),
            probabilityBps: value(v, "probabilityBps") ? decimal(v, "probabilityBps") : null,
            assumptions: value(v, "assumptions"),
            proof,
          };
        else if (kind === "confirm" || kind === "receive")
          entry = {
            kind,
            grossMinor: decimal(v, "grossMinor"),
            deductions:
              item.terms?.deductions
                .filter((d) => value(v, `deduction_${d.code}`))
                .map((d) => ({ code: d.code, amountMinor: decimal(v, `deduction_${d.code}`) })) ??
              [],
            ...(kind === "confirm"
              ? { triggerReference: value(v, "triggerReference") }
              : {
                  statementReference: value(v, "statementReference"),
                  settlementReference: value(v, "settlementReference"),
                }),
            proof,
          };
        else if (kind === "reverse")
          entry = { kind, entryId: value(v, "entryId"), reason: value(v, "reason"), proof };
        else if (kind === "reconcile")
          entry = {
            kind,
            expectedMinor: decimal(v, "expectedMinor"),
            observedMinor: decimal(v, "observedMinor"),
            statementReference: value(v, "statementReference"),
            settlementReference: value(v, "settlementReference"),
            explanation: value(v, "explanation"),
            proof,
          };
        else
          entry = {
            kind,
            beneficiary: value(v, "beneficiary"),
            amountMinor: decimal(v, "amountMinor"),
            proof,
          };
        return economyRecordSchema.parse({
          revision: item.revision,
          entry,
          evidenceChecked: v.evidenceChecked,
        });
      }}
      onSend={(v, o) => partnerApi.recordEconomy(item.id, v, o)}
      onClose={onClose}
    />
  );
}
