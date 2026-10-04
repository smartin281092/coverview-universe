import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  economyCaseInputSchema,
  economyAgreementsSchema,
} from "@coverview/contracts/partner-economy";
import { z } from "zod";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { EconomyForm, value } from "./EconomyForm";
import { EconomyPages, economyQueryPolicy, useEconomyFormat } from "./EconomyViews";
type Agreement = z.infer<typeof economyAgreementsSchema>["items"][number];
export function EconomyCaseEditor({
  agreement,
  onClose,
}: {
  agreement: Agreement;
  onClose: () => void;
}) {
  const { t } = useTranslation("economy"),
    session = usePartner(),
    f = useEconomyFormat(),
    [cursor, setCursor] = useState<string>();
  const policies = useQuery({
    queryKey: [...session.queryKey, "final-policies", agreement.leadId, cursor],
    queryFn: ({ signal }) => partnerApi.finalPolicies(agreement.leadId!, cursor, signal),
    enabled: !!agreement.leadId,
    ...economyQueryPolicy,
  });
  return (
    <>
      <EconomyForm
        title={t("newCase")}
        description={t("caseIntro")}
        enabled={session.context.administrator && !policies.isError}
        fields={[
          {
            name: "stream",
            type: "select",
            label: t("fields.stream"),
            options: [
              ...(agreement.terms.supplier.model === "fixed" ? ["lead_price"] : []),
              "contract_commission",
            ].map((v) => ({ value: v, label: t(`stream.${v}`) })),
          },
          {
            name: "finalPolicyId",
            type: "select",
            label: t("fields.finalPolicyId"),
            options: policies.isError
              ? []
              : (policies.data?.items
                  .filter(
                    (p) =>
                      p.active &&
                      p.source?.facts.companyId &&
                      agreement.terms.companies.includes(p.source.facts.companyId),
                  )
                  .map((p) => ({
                    value: p.id,
                    label: `${p.offer.company} · ${p.offer.product} · ${f.date(p.linkedAt)} · ${p.id}`,
                  })) ?? []),
            show: (v) => value(v, "stream") === "contract_commission",
          },
          {
            name: "companyId",
            type: "select",
            label: t("fields.companyId"),
            options: agreement.terms.companies.map((v) => ({ value: v, label: v })),
            show: (v) => value(v, "stream") === "contract_commission",
          },
          { name: "reference", type: "textarea", label: t("fields.reference") },
          { name: "scopeReference", type: "textarea", label: t("fields.scopeReference") },
          { name: "confirmed", type: "checkbox", label: t("caseConsent") },
        ]}
        parse={(v) =>
          economyCaseInputSchema.parse({
            agreementId: agreement.id,
            stream: value(v, "stream"),
            finalPolicyId:
              value(v, "stream") === "contract_commission" ? value(v, "finalPolicyId") : null,
            companyId: value(v, "stream") === "contract_commission" ? value(v, "companyId") : null,
            reference: value(v, "reference"),
            scopeReference: value(v, "scopeReference"),
            confirmed: v.confirmed,
          })
        }
        onSend={(v, o) => partnerApi.createEconomyCase(v, o)}
        onClose={onClose}
      >
        {policies.data && (cursor || policies.data.nextCursor) && (
          <EconomyPages
            next={policies.data.nextCursor}
            reset={() => setCursor(undefined)}
            onNext={setCursor}
          />
        )}
      </EconomyForm>
    </>
  );
}
