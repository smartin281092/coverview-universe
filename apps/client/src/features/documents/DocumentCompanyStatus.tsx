import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import type { CompanyAction } from "@coverview/contracts";

export function DocumentCompanyStatus({
  action,
  different,
}: {
  action: CompanyAction | undefined;
  different: boolean;
}) {
  const { t, i18n } = useTranslation("documents");
  if (!action && !different) return null;
  const green = action && ["current", "notified", "confirmed"].includes(action.status);
  const pending = action && ["requested", "in_progress"].includes(action.status);
  const label = !action
    ? "unknownCompany"
    : green
      ? action.status
      : pending
        ? "pending"
        : action.status === "needs_review"
          ? "needsReview"
          : action.status === "unknown"
            ? "unknown"
            : "different";
  const Icon = green ? CheckCircle2 : pending ? Clock3 : AlertTriangle;
  return (
    <div
      className={`space-y-2 rounded-lg p-4 text-sm ${green ? "bg-emerald-50 text-emerald-950" : pending ? "bg-muted text-foreground" : "bg-amber-50 text-amber-950"}`}
    >
      <p className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t(`reviewEdit.${label}`)}
      </p>
      {action?.evidence && (
        <p className="text-xs">
          {t("reviewEdit.date", {
            date: new Intl.DateTimeFormat(i18n.language, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(action.evidence.occurredAt)),
          })}
        </p>
      )}
      {action && !green && (
        <Link
          to="/actions"
          className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
        >
          {t("reviewEdit.actionCenter")}
        </Link>
      )}
    </div>
  );
}
