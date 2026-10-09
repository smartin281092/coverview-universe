import { useWalletProfileScope } from "../profile/use-wallet-profile-scope";
import { useTranslation } from "react-i18next";
import type { ActionCenterSummary } from "@coverview/contracts";
import { numberFormat } from "@coverview/ui/number-format";

export function ActionProgress({ summary }: { summary: ActionCenterSummary }) {
  const { t, i18n } = useTranslation("actions");
  const { scope } = useWalletProfileScope();
  const percent = numberFormat(i18n.language, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  return (
    <section className="space-y-3" aria-label={t("progress.label")}>
      <p className="font-medium">
        {t(scope === "all" ? "progress.optimized" : "progress.profileOptimized", {
          percent: percent.format(summary.optimizationPercent / 100),
        })}
      </p>
      <div
        role="progressbar"
        aria-label={t("progress.label")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={summary.optimizationPercent}
        className="h-2 overflow-hidden rounded-full bg-border"
      >
        <div
          className="h-full rounded-full bg-chart-3 transition-[width] motion-reduce:transition-none"
          style={{ width: `${summary.optimizationPercent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {t("progress.remaining", { count: summary.pending })}
      </p>
      {summary.incomplete && (
        <p className="basis-full text-xs text-muted-foreground">{t("incomplete")}</p>
      )}
    </section>
  );
}
