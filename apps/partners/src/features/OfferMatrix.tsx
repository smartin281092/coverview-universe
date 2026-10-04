import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Badge, ComparisonMatrix } from "@coverview/ui";
import type { BenefitLimit } from "@coverview/contracts/partner-benefits";
import type { OfferComparison } from "@coverview/contracts/partner-comparison";

type Cell = NonNullable<OfferComparison["rows"][number]["cells"][number]>;
const money = (minor: number) =>
  new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" }).format(minor / 100);
const number = new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 2 });

function amount(limit: BenefitLimit, t: TFunction<"partner">) {
  const value =
    limit.unit === "chf"
      ? money(limit.value)
      : limit.unit === "percent"
        ? t("comparison.percent", { value: number.format(limit.value / 100) })
        : t("comparison.days", { count: limit.value });
  return t(`comparison.period.${limit.period}`, { value });
}

function Value({ cell, detailed }: { cell: Cell; detailed: boolean }) {
  const { t } = useTranslation("partner");
  const negative = cell.change === "removed" || cell.change === "worse";
  return (
    <div className="space-y-2">
      <p>
        {cell.verification === "missing"
          ? t("comparison.notProvided")
          : cell.limit
            ? amount(cell.limit, t)
            : cell.value || t(`comparison.coverage.${cell.coverage}`)}
      </p>
      <p className="text-xs text-muted-foreground">{cell.label}</p>
      <div className="flex flex-wrap gap-1">
        {cell.change && cell.change !== "identical" && (
          <Badge variant={negative ? "destructive" : "outline"}>
            {t(`comparison.change.${cell.change}`)}
          </Badge>
        )}
        {cell.best && <Badge variant="secondary">{t("comparison.best")}</Badge>}
        {!cell.change && cell.verification === "to_verify" && (
          <Badge variant="outline">{t("comparison.uncertain")}</Badge>
        )}
      </div>
      {cell.conditions && (
        <p className="whitespace-pre-wrap text-xs text-muted-foreground">{cell.conditions}</p>
      )}
      {cell.exclusions && (
        <p className="whitespace-pre-wrap text-xs text-muted-foreground">
          {t("comparison.exclusions", { value: cell.exclusions })}
        </p>
      )}
      {detailed && cell.source && (
        <p className="text-xs text-muted-foreground">
          {cell.page === null
            ? t("comparison.sourceQuote", { quote: cell.source })
            : t("comparison.sourcePage", { page: cell.page, quote: cell.source })}
        </p>
      )}
    </div>
  );
}

// Adapter only: classifications, amounts and differences are computed by the API.
export function OfferMatrix({ comparison }: { comparison: OfferComparison }) {
  const { t } = useTranslation("partner");
  if (!comparison.columns.some((column) => column.kind === "offer")) return null;
  const columns = comparison.columns.map((column) => ({
    id: column.offerId ?? "current",
    title: column.kind === "current" ? t("comparison.current") : column.company,
    subtitle: column.kind === "current" ? column.company : column.product,
  }));
  const summary = [
    {
      id: "premium",
      label: t("comparison.premium"),
      cells: comparison.columns.map((column) => (
        <div key={column.offerId ?? "current"} className="space-y-1">
          <p className="font-semibold">
            {column.annualPremiumMinor === null
              ? t("comparison.notProvided")
              : money(column.annualPremiumMinor)}
          </p>
          {column.premiumStatus === "to_verify" && (
            <Badge variant="outline">{t("comparison.uncertain")}</Badge>
          )}
          {column.annualFactor !== null && column.annualFactor > 1 && (
            <p className="text-xs text-muted-foreground">
              {t("comparison.annualized", { factor: column.annualFactor })}
            </p>
          )}
          {column.annualDifferenceMinor !== null && (
            <p className="text-xs">
              {t(column.annualDifferenceMinor <= 0 ? "comparison.saving" : "comparison.surcharge", {
                amount: money(Math.abs(column.annualDifferenceMinor)),
              })}
            </p>
          )}
        </div>
      )),
    },
    ...(comparison.reference === "current_contract"
      ? [
          {
            id: "balance",
            label: t("comparison.balance"),
            cells: comparison.columns.map((column) =>
              column.summary ? (
                <ul key={column.offerId} className="space-y-1 text-xs">
                  <li>{t("comparison.gains", { count: column.summary.gains })}</li>
                  <li>{t("comparison.losses", { count: column.summary.losses })}</li>
                  {column.summary.exclusionsChanged > 0 && (
                    <li>
                      {t("comparison.exclusionsChanged", {
                        count: column.summary.exclusionsChanged,
                      })}
                    </li>
                  )}
                  {column.summary.toVerify > 0 && (
                    <li>{t("comparison.toVerify", { count: column.summary.toVerify })}</li>
                  )}
                  {column.summary.missing > 0 && (
                    <li>{t("comparison.missing", { count: column.summary.missing })}</li>
                  )}
                </ul>
              ) : (
                <span key="current" className="text-xs text-muted-foreground">
                  {t("comparison.reference")}
                </span>
              ),
            ),
          },
        ]
      : []),
  ];
  const rows = comparison.rows.map((row) => {
    const render = (detailed: boolean) =>
      row.cells.map((cell, index) =>
        cell ? (
          <Value key={index} cell={cell} detailed={detailed} />
        ) : (
          <span key={index} className="text-muted-foreground">
            {t("comparison.absent")}
          </span>
        ),
      );
    return {
      id: row.key,
      label: row.label ?? t(`comparison.benefit.${row.category}`),
      cells: render(false),
      details: render(true),
    };
  });
  return (
    <ComparisonMatrix
      title={t("comparison.title")}
      description={t(
        comparison.reference === "current_contract"
          ? "comparison.descriptionCurrent"
          : "comparison.description",
      )}
      criterionLabel={t("comparison.criterion")}
      detailsLabel={t("comparison.detailed")}
      closeLabel={t("comparison.close")}
      columns={columns}
      summary={summary}
      rows={rows}
      primary={comparison.rows.filter((row) => row.primary).map((row) => row.key)}
    />
  );
}
