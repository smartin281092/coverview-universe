import { useTranslation } from "react-i18next";
import type { LeadOffer } from "@coverview/contracts/partner";
import type { LeadOrientation } from "@coverview/contracts/partner-orientation";
import { numberFormat } from "../../number-format";

const money = (minor: number) =>
  numberFormat("fr-CH", { style: "currency", currency: "CHF" }).format(minor / 100);
const date = (value: string) =>
  new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" }).format(
    new Date(value),
  );

// Adapter only: the orientation is computed by the API from verified values, never validated.
export function OrientationPanel({
  orientation,
  offers,
}: {
  orientation: LeadOrientation;
  offers: LeadOffer[];
}) {
  const { t } = useTranslation("offers");
  if (!orientation.offers.length) return null;
  const name = (row: { category: string; label: string | null }) =>
    row.label ?? t(`comparison.benefit.${row.category}`);
  const list = (rows: { key: string; category: string; label: string | null }[]) =>
    rows.map(name).join(", ");
  return (
    <section className="space-y-4 rounded-xl border border-dashed border-border p-4">
      <div className="space-y-1">
        <h3 className="font-semibold">{t("orientation.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("orientation.notice")}</p>
      </div>
      <p className="font-medium">{t(`orientation.kind.${orientation.kind}`)}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {orientation.offers.map((item) => {
          const offer = offers.find((value) => value.id === item.offerId);
          return (
            <article
              key={item.offerId}
              className="space-y-2 rounded-lg border border-border p-3 text-sm"
            >
              <h4 className="font-medium">
                {t("orientation.offer", {
                  company: offer?.company ?? "",
                  product: offer?.product ?? "",
                })}
              </h4>
              <p>{t(`orientation.status.${item.status}`)}</p>
              {item.annualDifferenceMinor !== null && (
                <p>
                  {t(item.annualDifferenceMinor <= 0 ? "orientation.saves" : "orientation.costs", {
                    amount: money(Math.abs(item.annualDifferenceMinor)),
                  })}
                </p>
              )}
              {item.improves.length > 0 && (
                <p>{t("orientation.improves", { list: list(item.improves) })}</p>
              )}
              {item.loses.length > 0 && <p>{t("orientation.loses", { list: list(item.loses) })}</p>}
              {item.notes.length > 0 && <p>{t("orientation.notes", { list: list(item.notes) })}</p>}
              {item.toVerify.length > 0 && (
                <p className="text-muted-foreground">
                  {t("orientation.toVerify", { list: list(item.toVerify) })}
                </p>
              )}
              {item.missing.length > 0 && (
                <p className="text-muted-foreground">
                  {t("orientation.missing", { list: list(item.missing) })}
                </p>
              )}
            </article>
          );
        })}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer">{t("orientation.transparency")}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            {t("orientation.scope", {
              offers: t("orientation.offers", { count: orientation.transparency.offers.length }),
              companies: t("orientation.companies", { count: orientation.transparency.companies }),
            })}
          </li>
          {orientation.transparency.offers.map((item) => (
            <li key={item.offerId}>
              {item.reviewedAt
                ? t("orientation.reviewed", {
                    company: item.company,
                    version: item.offerVersion,
                    date: date(item.reviewedAt),
                  })
                : t("orientation.unreviewed", {
                    company: item.company,
                    version: item.offerVersion,
                  })}
            </li>
          ))}
          {orientation.transparency.currentReviewVersion !== null && (
            <li>
              {t("orientation.current", { version: orientation.transparency.currentReviewVersion })}
            </li>
          )}
          {orientation.transparency.assumptions.map((item) => (
            <li key={item}>
              {t(`orientation.assumption.${item}`, {
                factor: orientation.transparency.annualFactor ?? 1,
              })}
            </li>
          ))}
          <li>{t("orientation.availability")}</li>
          {orientation.transparency.asOf && (
            <li>{t("orientation.asOf", { date: date(orientation.transparency.asOf) })}</li>
          )}
        </ul>
      </details>
    </section>
  );
}
