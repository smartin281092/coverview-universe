import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  BadgeCheck,
  Banknote,
  CalendarCheck,
  CalendarClock,
  Check,
  ExternalLink,
  Hash,
  type LucideIcon,
} from "lucide-react";
import type { LeadOffer } from "@coverview/api-client/partner";
import type { EvidenceBenefit } from "@coverview/api-client/health-recommendation";
import { Badge } from "@coverview/ui";
import { amountsInText, numberFormat } from "@coverview/ui/number-format";
import { recommendationApi } from "../../api";
import { benefitIcon, factIcon } from "./offer-icons";

/**
 * A details panel (9 October 2026): framed, a gray header, a white body. It never folds: no
 * foldable block outside the FAQ (FRONT-14).
 */
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-panel-border bg-background">
      <h2 className="flex min-h-14 items-center border-b border-panel-border bg-panel-head px-5 py-4 text-base font-semibold text-panel-title">
        {title}
      </h2>
      <div className="space-y-3 p-5 text-panel-text">{children}</div>
    </section>
  );
}
function Glyph({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full border border-panel-border bg-background text-panel-text">
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}
function Entry({
  icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Glyph icon={icon} />
      <dt className="w-28 shrink-0 sm:w-40">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-panel-title">{children}</dd>
    </div>
  );
}
function Item({ icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 rounded-lg border border-panel-border bg-panel-inset p-4">
      <Glyph icon={icon} />
      <div className="min-w-0 flex-1 space-y-1 break-words">
        <p className="font-medium text-panel-title">{title}</p>
        {children}
      </div>
    </li>
  );
}

// Member advantages are shown apart from the model's own benefits, as in the comparator.
const club = (fact: EvidenceBenefit) =>
  fact.category === "members" ||
  fact.classification === "commercial" ||
  fact.classification === "supplementary";

/** The facts the 2027 comparator publishes for the model the offer names. */
function ModelFacts({ modelId }: { modelId: string }) {
  const { t, i18n } = useTranslation("offers");
  const evidence = useQuery({
    queryKey: ["health-model-evidence", 2027, modelId],
    queryFn: ({ signal }) => recommendationApi.modelEvidence(modelId, 2027, signal),
    staleTime: 3_600_000,
    retry: 1,
  });
  if (evidence.isPending)
    return (
      <p role="status" className="text-sm">
        {t("offerPage.model.loading")}
      </p>
    );
  if (!evidence.data) return <p className="text-sm">{t("offerPage.model.unavailable")}</p>;
  const { model, benefits, benefitTypes, sources } = evidence.data;
  const types = new Map(benefitTypes.map((type) => [type.key, type]));
  const order = benefitTypes.map((type) => type.key);
  const rank = (fact: EvidenceBenefit) =>
    order.indexOf(fact.equivalenceGroup) + 1 || order.length + 1;
  const sorted = [...benefits].sort((a, b) => rank(a) - rank(b));
  const text = (value: string) => amountsInText(value, i18n.language);
  const groups = [
    { id: "model", facts: sorted.filter((fact) => !club(fact)) },
    { id: "club", facts: sorted.filter(club) },
  ].filter((group) => group.facts.length);
  return (
    <div className="space-y-5 pt-2">
      <p className="text-xs">
        {t("offerPage.model.intro", { insurer: model.insurerBrand, name: model.name })}
      </p>
      {groups.map((group) => (
        <div key={group.id} className="space-y-3">
          <h3 className="text-sm font-semibold text-panel-title">
            {t(`offerPage.model.${group.id}`)}
          </h3>
          <ul className="space-y-3">
            {group.facts.map((fact) => {
              const type = types.get(fact.equivalenceGroup);
              const source = sources.find((item) => fact.sourceIds.includes(item.id));
              const conditions = [fact.conditions, fact.activation].filter(Boolean).join(" ");
              return (
                <Item
                  key={fact.id}
                  icon={factIcon(fact.category)}
                  title={type?.label ?? fact.title}
                >
                  {type && <p className="text-xs">{fact.title}</p>}
                  <p>{text(fact.effect)}</p>
                  {conditions && (
                    <p className="text-xs">
                      {t("offerPage.model.conditions", { text: text(conditions) })}
                    </p>
                  )}
                  {fact.exclusions && (
                    <p className="text-xs">
                      {t("offerPage.model.exclusions", { text: text(fact.exclusions) })}
                    </p>
                  )}
                  {source && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-8 items-center gap-1 text-xs underline-offset-4 hover:underline"
                    >
                      {t("offerPage.model.source")}
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  )}
                </Item>
              );
            })}
          </ul>
        </div>
      ))}
      <p className="text-xs">{t("offerPage.model.partial")}</p>
    </div>
  );
}

/** The Details tab of an offer: the offer, its benefits with the model's, then its texts. */
export function OfferDetails({ offer }: { offer: LeadOffer }) {
  const { t, i18n } = useTranslation("offers");
  const money = (minor: number) =>
    numberFormat(i18n.language, { style: "currency", currency: "CHF" }).format(minor / 100);
  const day = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeZone: "Europe/Zurich",
    }).format(new Date(value));
  const text = (value: string) => amountsInText(value, i18n.language);
  return (
    <div className="space-y-4">
      <Panel title={t("offerPage.details.offer")}>
        <dl>
          <Entry icon={Banknote} label={t("offerPage.details.premium")}>
            {offer.annualPremiumMinor === null
              ? t("missing")
              : `${money(offer.annualPremiumMinor)} ${t("workspace.perYear")}`}
          </Entry>
          <Entry icon={CalendarClock} label={t("offerPage.details.validUntil")}>
            {offer.validUntil ? day(offer.validUntil) : t("missing")}
          </Entry>
          <Entry icon={CalendarCheck} label={t("offerPage.details.effectiveDate")}>
            {offer.effectiveDate ? day(offer.effectiveDate) : t("missing")}
          </Entry>
          {offer.reference && (
            <Entry icon={Hash} label={t("offerPage.details.reference")}>
              {offer.reference}
            </Entry>
          )}
          <Entry icon={BadgeCheck} label={t("offerPage.details.status")}>
            {offer.state === "selected" ? (
              <Badge className="cv-offer-tag h-6 px-2.5 text-xs [&>svg]:size-3.5!">
                <Check aria-hidden="true" />
                {t("state.selected")}
              </Badge>
            ) : ["published", "viewed"].includes(offer.state) ? (
              t("offerPage.details.available")
            ) : (
              t(`state.${offer.state}`)
            )}
          </Entry>
        </dl>
      </Panel>
      <Panel title={t("offerPage.details.benefits")}>
        {offer.features.length ? (
          <ul className="space-y-3">
            {offer.features.map((feature, index) => (
              <Item key={index} icon={benefitIcon(feature)} title={feature.label}>
                <p className="flex flex-wrap items-center gap-2">
                  {feature.value ? text(feature.value) : t("missing")}
                  {feature.coverage === "included" && (
                    <Badge variant="outline">{t("offerPage.details.included")}</Badge>
                  )}
                  {feature.coverage === "excluded" && (
                    <Badge variant="outline">{t("offerPage.details.excluded")}</Badge>
                  )}
                </p>
                {feature.conditions && <p className="text-xs">{text(feature.conditions)}</p>}
              </Item>
            ))}
          </ul>
        ) : (
          <p>{t("offerPage.details.noBenefits")}</p>
        )}
        {offer.healthModelId && <ModelFacts modelId={offer.healthModelId} />}
      </Panel>
      {offer.summary && (
        <Panel title={t("offerPage.details.summary")}>
          <p className="whitespace-pre-wrap">{text(offer.summary)}</p>
        </Panel>
      )}
      {offer.limitations && (
        <Panel title={t("offerPage.details.limitations")}>
          <p className="whitespace-pre-wrap">{text(offer.limitations)}</p>
        </Panel>
      )}
    </div>
  );
}
