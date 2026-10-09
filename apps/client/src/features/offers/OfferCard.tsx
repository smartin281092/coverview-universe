import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Check, FileText } from "lucide-react";
import type { LeadOffer } from "@coverview/api-client/partner";
import { Badge, Button } from "@coverview/ui";
import { CompanyLogo } from "../insurance/CompanyLogo";
import { amountsInText, numberFormat } from "../../number-format";

export type OfferAction = "select" | "question" | "modification" | "refuse";
const day = (value: string) =>
  new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" }).format(
    new Date(value),
  );

/**
 * One offer as the client sees it, in the offers list and in the request window
 * (8 October 2026): the company's logo when it is recognised, the whole card opening the offer's
 * page, the selected offer framed by the call-to-action colours turning around it.
 */
export function OfferCard({
  leadId,
  offer,
  busy = false,
  closed = false,
  onAction,
  onPreview,
}: {
  leadId: string;
  offer: LeadOffer;
  busy?: boolean;
  closed?: boolean;
  onAction: (type: OfferAction) => void;
  onPreview: () => void;
}) {
  const { t, i18n } = useTranslation("offers");
  const selected = offer.state === "selected";
  const expired = !!offer.validUntil && new Date(offer.validUntil).getTime() < Date.now();
  return (
    <article
      className={`relative flex flex-col gap-3 rounded-xl border bg-background p-5 ${
        selected ? "cv-offer-selected" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-2">
          {offer.companyId ? (
            <CompanyLogo
              companyId={offer.companyId}
              alt={offer.company}
              className="h-8 w-auto max-w-32 object-left"
            />
          ) : (
            <p className="text-sm text-muted-foreground">{offer.company}</p>
          )}
          <h4 className="font-normal text-muted-foreground">
            {/* The whole card opens the offer; its buttons stay above this link. */}
            <Link
              to="/offers/$leadId/$offerId"
              params={{ leadId, offerId: offer.id }}
              className="after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-[#6366f1]"
            >
              {offer.product}
            </Link>
          </h4>
        </div>
        {selected ? (
          <Badge className="cv-offer-tag h-6 shrink-0 px-2.5 text-xs [&>svg]:size-3.5!">
            <Check aria-hidden="true" />
            {t("state.selected")}
          </Badge>
        ) : (
          !["published", "viewed"].includes(offer.state) && (
            <Badge variant="outline" className="shrink-0">
              {t(`state.${offer.state}`)}
            </Badge>
          )
        )}
      </div>
      <div className="space-y-1">
        {offer.annualPremiumMinor === null ? (
          <p className="text-2xl font-medium">{t("missing")}</p>
        ) : (
          // The monthly share of the yearly premium (8 October 2026), however it is paid.
          <p className="flex items-center gap-2">
            <span className="text-4xl leading-none font-medium tracking-tight">
              {numberFormat(i18n.language, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(Math.round(offer.annualPremiumMinor / 12) / 100)}
            </span>
            <span className="flex flex-col text-xs leading-tight text-muted-foreground">
              <span>{t("offerPage.chf")}</span>
              <span>{t("offerPage.per.month")}</span>
            </span>
          </p>
        )}
        {offer.validUntil && (
          <p className="text-xs text-muted-foreground">
            {t("workspace.validUntil", { date: day(offer.validUntil) })}
          </p>
        )}
      </div>
      {offer.updatedSinceViewed && <p className="text-sm">{t("updatedSinceViewed")}</p>}
      {offer.sourceStatus && offer.sourceStatus !== "current" && (
        <p role="status" className="text-sm">
          {t(`history.sourceStatus.${offer.sourceStatus}`)}
        </p>
      )}
      {offer.summary && (
        <p className="whitespace-pre-wrap text-sm">{amountsInText(offer.summary, i18n.language)}</p>
      )}
      {offer.limitations && (
        <details className="relative z-10 text-sm">
          <summary className="cursor-pointer">{t("limitations")}</summary>
          <p className="mt-2 whitespace-pre-wrap text-xs">
            {amountsInText(offer.limitations, i18n.language)}
          </p>
        </details>
      )}
      <div className="relative z-10 mt-auto flex flex-wrap gap-2">
        <Button
          disabled={
            busy ||
            !offer.canChoose ||
            !["published", "viewed", "selected"].includes(offer.state) ||
            expired ||
            closed
          }
          onClick={() => onAction("select")}
        >
          {selected && <Check className="size-4" aria-hidden="true" />}
          {t(selected ? "selected" : "choose")}
        </Button>
        {offer.canDownload && (
          <Button variant="outline" onClick={onPreview}>
            <FileText className="size-4" aria-hidden="true" />
            {t("source")}
          </Button>
        )}
      </div>
    </article>
  );
}
