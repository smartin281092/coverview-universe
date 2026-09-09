import { useTranslation } from "react-i18next";
import type { ActionCenterSummary } from "@coverview/contracts";

export function ActionProgress({ summary }: { summary: ActionCenterSummary }) {
  const { t, i18n } = useTranslation("actions");
  const percent = new Intl.NumberFormat(i18n.language, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  return (
    <section className="flex flex-wrap items-center gap-6" aria-label={t("progress.label")}>
      <div className="min-w-0 flex-1 space-y-3">
        <p className="font-medium">{t("progress.remaining", { count: summary.pending })}</p>
        <div
          role="progressbar"
          aria-label={t("progress.label")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={summary.completionPercent}
          className="h-2 overflow-hidden rounded-full bg-border"
        >
          <div
            className="h-full rounded-full bg-chart-3 transition-[width] motion-reduce:transition-none"
            style={{ width: `${summary.completionPercent}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {t("progress.completed", { count: summary.completed, total: summary.total })}
        </p>
        {summary.inProgress > 0 && (
          <p className="text-xs text-muted-foreground">
            {t("progress.inProgress", { count: summary.inProgress })}
          </p>
        )}
      </div>
      <div
        className="flex items-center gap-3"
        role="img"
        aria-label={t("progress.optimizationValue", {
          percent: percent.format(summary.optimizationPercent / 100),
        })}
      >
        <span
          className="relative flex size-16 shrink-0 items-center justify-center text-sm tabular-nums"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 48 48"
            className="absolute inset-0 size-full -rotate-90 fill-none"
            style={{ strokeWidth: "var(--spacing-4)" }}
          >
            <circle cx="24" cy="24" r="22" className="stroke-border" />
            <circle
              cx="24"
              cy="24"
              r="22"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={100 - summary.optimizationPercent}
              className="stroke-chart-3"
            />
          </svg>
          <span className="relative">{percent.format(summary.optimizationPercent / 100)}</span>
        </span>
        <span className="text-sm text-muted-foreground">{t("progress.optimization")}</span>
      </div>
      {summary.incomplete && (
        <p className="basis-full text-xs text-muted-foreground">{t("incomplete")}</p>
      )}
    </section>
  );
}
