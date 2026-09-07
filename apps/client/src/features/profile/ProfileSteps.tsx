import { useTranslation } from "react-i18next";

export type ProfileViewStep = "information" | "details" | "review";
export const profileViewSteps: ProfileViewStep[] = ["information", "details", "review"];
export type ProfileEditorBridge = {
  dirty: boolean;
  pending: boolean;
  save: () => Promise<boolean>;
  discard: () => void;
};

export function ProfileSteps({
  step,
  labels,
  disabled,
  onChange,
}: {
  step: ProfileViewStep;
  labels: Record<ProfileViewStep, string>;
  disabled: boolean;
  onChange: (step: ProfileViewStep) => void;
}) {
  const { t } = useTranslation("profile");
  return (
    <ol aria-label={t("progress")} className="grid grid-cols-3 lg:grid-cols-1">
      {profileViewSteps.map((value, index) => (
        <li key={value} className="relative min-w-0 lg:pb-6">
          {index < profileViewSteps.length - 1 && (
            <span
              aria-hidden="true"
              className="absolute left-1/2 right-0 top-5 h-px w-full bg-border lg:left-5 lg:top-5 lg:h-full lg:w-px"
            />
          )}
          <button
            type="button"
            disabled={disabled}
            aria-current={value === step ? "step" : undefined}
            onClick={() => onChange(value)}
            className={`relative flex min-h-11 w-full flex-col items-center gap-2 rounded-lg px-1 text-center text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 lg:flex-row lg:gap-3 lg:px-0 lg:text-left lg:text-sm ${value === step ? "font-medium text-foreground" : "text-muted-foreground"}`}
          >
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-full border bg-background text-sm ${value === step ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
            >
              {index + 1}
            </span>
            <span className="relative bg-background px-1 lg:px-0">{labels[value]}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
