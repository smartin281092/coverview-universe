import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  marketReservationInputSchema,
  type MarketDetail,
} from "@coverview/contracts/partner-economy";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { EconomyForm, instant, value, type EconomyField } from "./EconomyForm";
import { economyQueryPolicy, TermsView } from "./EconomyViews";
export function MarketReservationDialog({
  market,
  onClose,
  enabled,
}: {
  market: MarketDetail;
  onClose: () => void;
  enabled: boolean;
}) {
  const { t } = useTranslation("economy"),
    session = usePartner();
  const directory = useQuery({
    queryKey: [...session.queryKey, "directory"],
    queryFn: ({ signal }) => partnerApi.directory(signal),
    ...economyQueryPolicy,
  });
  const field = (name: string, type: EconomyField["type"] = "textarea"): EconomyField => ({
    name,
    type,
    label: t(`fields.${name}`),
  });
  return (
    <EconomyForm
      title={t("reserve")}
      description={t("reserveIntro")}
      enabled={enabled && !directory.isError && !!directory.data}
      fields={[
        {
          ...field("targetId", "select"),
          options:
            directory.data?.items
              .filter(
                (p) =>
                  p.id !== session.identity.user.id &&
                  p.categories.includes(market.publication.category),
              )
              .map((p) => ({ value: p.id, label: `${p.name} · ${p.organization}` })) ?? [],
        },
        ...(["mode", "access", "communication"] as const).map((name) => ({
          ...field(name, "select"),
          options: (name === "mode"
            ? ["co_advice", "one_off", "transfer"]
            : name === "access"
              ? ["read", "contribute"]
              : ["referent_only", "client_direct"]
          ).map((v) => ({ value: v, label: t(`partner:collaboration.${name}.${v}`) })),
          ...(name !== "mode"
            ? { show: (v: Record<string, unknown>) => v.mode === "co_advice" }
            : {}),
        })),
        field("scope"),
        field("responsibilities"),
        field("powers"),
        field("limitations"),
        field("reason"),
        field("expiresAt", "datetime-local"),
        field("missionUntil", "datetime-local"),
        { name: "termsAccepted", type: "checkbox", label: t("termsConsent") },
        { name: "suitabilityReviewed", type: "checkbox", label: t("suitabilityConsent") },
      ]}
      parse={(v) =>
        marketReservationInputSchema.parse({
          targetId: value(v, "targetId"),
          conditionId: market.condition?.id,
          mission: {
            mode: value(v, "mode"),
            access: value(v, "mode") === "co_advice" ? value(v, "access") : "contribute",
            communication:
              value(v, "mode") === "co_advice" ? value(v, "communication") : "client_direct",
            scope: value(v, "scope"),
            responsibilities: value(v, "responsibilities"),
            powers: value(v, "powers"),
            limitations: value(v, "limitations"),
            validUntil: instant(v, "missionUntil"),
          },
          expiresAt: instant(v, "expiresAt"),
          reason: value(v, "reason"),
          termsAccepted: v.termsAccepted,
          suitabilityReviewed: v.suitabilityReviewed,
        })
      }
      onSend={(v, o) => partnerApi.reserveMarket(market.publication.id, v, o)}
      onClose={onClose}
    >
      {market.condition && (
        <details open className="rounded-xl border border-border p-4">
          <summary className="cursor-pointer font-semibold">{t("exactTerms")}</summary>
          <div className="mt-4">
            <TermsView terms={market.condition.terms} />
          </div>
        </details>
      )}
    </EconomyForm>
  );
}
