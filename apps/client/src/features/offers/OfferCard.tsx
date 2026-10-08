import { useTranslation } from "react-i18next";
import { Check, FileText } from "lucide-react";
import type { LeadOffer } from "@coverview/api-client/partner";
import { Badge, Button } from "@coverview/ui";
import { CompanyLogo } from "../insurance/CompanyLogo";

export type OfferAction = "select" | "question" | "modification" | "refuse";
const money = (minor: number) =>
  new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" }).format(minor / 100);
const day = (value: string) =>
  new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" }).format(
    new Date(value),
  );

/**
 * One offer as the client sees it, in the offers list and in the request window
 * (8 October 2026): the company's logo when it is recognised, the selected offer outlined in green.
 */
export function OfferCard({
  offer,
  busy = false,
  closed = false,
  onAction,
  onPreview,
}: {
  offer: LeadOffer;
  busy?: boolean;
  closed?: boolean;
  onAction: (type: OfferAction) => void;
  onPreview: () => void;
}) {
  const { t } = useTranslation("offers");
  const selected = offer.state === "selected";
  const expired = !!offer.validUntil && new Date(offer.validUntil).getTime() < Date.now();
  return (
    <article
      className={`flex flex-col gap-3 rounded-xl border bg-background p-5 ${
        selected ? "border-green-600 ring-2 ring-green-600" : "border-border"
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
          <h4 className="font-semibold">{offer.product}</h4>
        </div>
        {selected ? (
          <Badge className="h-6 shrink-0 border-transparent bg-green-700 px-2.5 text-xs text-white [&>svg]:size-3.5!">
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
      <div>
        <p className="text-2xl font-medium">
          {offer.annualPremiumMinor === null ? t("missing") : money(offer.annualPremiumMinor)}
        </p>
        <p className="text-xs text-muted-foreground">
          {offer.annualPremiumMinor === null ? "" : t("workspace.perYear")}
          {offer.validUntil && ` · ${t("workspace.validUntil", { date: day(offer.validUntil) })}`}
        </p>
      </div>
      {offer.updatedSinceViewed && <p className="text-sm">{t("updatedSinceViewed")}</p>}
      {offer.sourceStatus && offer.sourceStatus !== "current" && (
        <p role="status" className="text-sm">
          {t(`history.sourceStatus.${offer.sourceStatus}`)}
        </p>
      )}
      {offer.summary && <p className="whitespace-pre-wrap text-sm">{offer.summary}</p>}
      {offer.limitations && (
        <details className="text-sm">
          <summary className="cursor-pointer">{t("limitations")}</summary>
          <p className="mt-2 whitespace-pre-wrap text-xs">{offer.limitations}</p>
        </details>
      )}
      <div className="mt-auto flex flex-wrap gap-2">
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
      <div className="flex flex-wrap gap-3 text-xs">
        {(["question", "modification", "refuse"] as const).map((type) => (
          <button
            key={type}
            type="button"
            disabled={busy || !offer.canChoose || closed}
            className="underline underline-offset-4 disabled:opacity-50"
            onClick={() => onAction(type)}
          >
            {t(type)}
          </button>
        ))}
      </div>
    </article>
  );
}
