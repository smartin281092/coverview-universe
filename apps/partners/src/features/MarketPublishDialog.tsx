import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  professionalLanguageSchema,
  swissCantonSchema,
  type LeadDetail,
} from "@coverview/contracts/partner";
import { marketPublicationSchema } from "@coverview/contracts/partner-economy";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { EconomyForm, instant, value, values, type EconomyField } from "./EconomyForm";
import { economyQueryPolicy, useEconomyFormat, EconomyPages } from "./EconomyViews";
export function MarketPublishDialog({
  lead,
  onClose,
  enabled,
}: {
  lead: LeadDetail;
  onClose: () => void;
  enabled: boolean;
}) {
  const { t } = useTranslation("economy"),
    session = usePartner(),
    f = useEconomyFormat(),
    [cursor, setCursor] = useState<string>();
  const terms = useQuery({
    queryKey: [...session.queryKey, "commercial", cursor],
    queryFn: ({ signal }) => partnerApi.commercialConditions(cursor, signal),
    ...economyQueryPolicy,
  });
  const field = (
    name: string,
    type: NonNullable<EconomyField["type"]>,
    options?: string[],
  ): EconomyField => ({
    name,
    type,
    label: t(`fields.${name}`),
    ...(options
      ? { options: options.map((value) => ({ value, label: t(`${name}.${value}`) })) }
      : {}),
  });
  return (
    <EconomyForm
      title={t("publish")}
      description={t("publishIntro")}
      enabled={enabled && !terms.isError && !!terms.data}
      fields={[
        {
          ...field("conditionId", "select"),
          options:
            terms.data?.items
              .filter(
                (c) =>
                  c.state === "approved" &&
                  c.ownerId === lead.responsibleId &&
                  c.terms.categories.includes(lead.category),
              )
              .map((c) => ({
                value: c.id,
                label: `${t(`model.${c.terms.supplier.model}`)} · ${f.date(c.createdAt)} · ${c.id}`,
              })) ?? [],
        },
        {
          ...field("language", "select"),
          options: professionalLanguageSchema.options.map((value) => ({ value, label: value })),
        },
        {
          ...field("canton", "select"),
          optional: true,
          options: swissCantonSchema.options.map((value) => ({ value, label: value })),
        },
        field("modes", "multi", ["phone", "video", "office", "home"]),
        field("reason", "select", ["capacity", "convention", "specialist", "collaboration"]),
        field("qualification", "select", ["need_stated", "contacted", "documents_reviewed"]),
        {
          ...field("steps", "multi", [
            "contact",
            "appointment",
            "comparison",
            "offers_requested",
            "offers_received",
          ]),
          optional: true,
        },
        {
          ...field("constraints", "multi", [
            "deadline",
            "remote_only",
            "travel",
            "specialist",
            "client_choice",
          ]),
          optional: true,
        },
        field("expiresAt", "datetime-local"),
        { name: "publicationConfirmed", type: "checkbox", label: t("publicationConsent") },
      ]}
      parse={(v) =>
        marketPublicationSchema.parse({
          leadRevision: lead.revision,
          conditionId: value(v, "conditionId"),
          language: value(v, "language"),
          canton: value(v, "canton") || null,
          modes: values(v, "modes"),
          reason: value(v, "reason"),
          qualification: value(v, "qualification"),
          steps: values(v, "steps"),
          constraints: values(v, "constraints"),
          expiresAt: instant(v, "expiresAt"),
          publicationConfirmed: v.publicationConfirmed,
        })
      }
      onSend={(v, o) => partnerApi.publishMarket(lead.id, v, o)}
      onClose={onClose}
    >
      {terms.data && (cursor || terms.data.nextCursor) && (
        <EconomyPages
          next={terms.data.nextCursor}
          reset={() => setCursor(undefined)}
          onNext={setCursor}
        />
      )}
    </EconomyForm>
  );
}
