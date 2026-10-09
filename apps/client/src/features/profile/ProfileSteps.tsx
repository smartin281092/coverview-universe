import { useTranslation } from "react-i18next";
import { numberFormat } from "@coverview/ui/number-format";

export type ProfileViewStep = "information" | "contact" | "details";
export const profileViewSteps: ProfileViewStep[] = ["information", "contact", "details"];
export type ProfileEditorBridge = {
  dirty: boolean;
  pending: boolean;
  completion: number | null;
  scopeKey: string;
  save: () => Promise<boolean>;
  discard: () => void;
};

export function ProfileSteps({
  step,
  labels,
  completion,
  disabled,
  onChange,
}: {
  step: ProfileViewStep;
  labels: Record<"information" | "details", string> & Partial<Record<"contact", string>>;
  completion: Record<"information" | "details", number> & Partial<Record<"contact", number>>;
  disabled: boolean;
  onChange: (step: ProfileViewStep) => void;
}) {
  const { t, i18n } = useTranslation("profile");
  const steps = profileViewSteps.filter(
    (value) => value !== "contact" || completion.contact !== undefined,
  );
  const percent = numberFormat(i18n.language, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  return (
    <ol
      aria-label={t("progress")}
      className={`grid ${steps.length === 3 ? "grid-cols-3" : "grid-cols-2"} lg:grid-cols-1`}
    >
      {steps.map((value, index) => {
        const progress = completion[value] ?? 0;
        const percentage = Number.isFinite(progress)
          ? Math.round(Math.min(100, Math.max(0, progress)))
          : 0;
        const formattedPercentage = percent.format(percentage / 100);
        const label = labels[value] ?? t("steps.contact");
        return (
          <li key={value} className="relative min-w-0 lg:pb-6">
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute left-1/2 right-0 top-6 h-px w-full bg-border lg:left-6 lg:top-6 lg:h-full lg:w-px"
              />
            )}
            <button
              type="button"
              disabled={disabled}
              aria-current={value === step ? "step" : undefined}
              aria-label={t("stepCompletion", {
                step: label,
                completion: formattedPercentage,
              })}
              onClick={() => onChange(value)}
              className={`relative flex min-h-11 w-full flex-col items-center gap-2 rounded-lg px-1 text-center text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 lg:flex-row lg:gap-3 lg:px-0 lg:text-left lg:text-sm ${value === step ? "font-medium text-foreground" : "text-muted-foreground"}`}
            >
              <span
                aria-hidden="true"
                className={`relative flex size-12 shrink-0 items-center justify-center rounded-full bg-background text-xs tabular-nums transition-transform motion-reduce:transition-none ${value === step ? "scale-110" : ""}`}
              >
                <svg
                  viewBox="0 0 48 48"
                  focusable="false"
                  className="absolute inset-0 size-full -rotate-90 fill-none"
                  style={{ strokeWidth: "var(--spacing-4)" }}
                >
                  <circle cx="24" cy="24" r="22" className="stroke-border" />
                  {percentage > 0 && (
                    <circle
                      cx="24"
                      cy="24"
                      r="22"
                      pathLength="100"
                      strokeDasharray={percentage < 100 ? "100" : undefined}
                      strokeDashoffset={percentage < 100 ? 100 - percentage : undefined}
                      className="stroke-chart-3"
                    />
                  )}
                </svg>
                <span className="relative">{formattedPercentage}</span>
              </span>
              <span className="relative bg-background px-1 lg:px-0">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
