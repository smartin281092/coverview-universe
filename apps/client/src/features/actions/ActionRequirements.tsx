import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import type { ActionCenterItem } from "@coverview/contracts";
import { Button } from "@coverview/ui";
import { numberFormat } from "@coverview/ui/number-format";

export function ActionRequirements({
  action,
  asOptions = false,
  disabled = false,
}: {
  action: ActionCenterItem;
  asOptions?: boolean;
  disabled?: boolean;
}) {
  const { t, i18n } = useTranslation("actions");
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  const requirements = action.requirements.filter(
    (requirement) => requirement.kind !== "profile_information",
  );
  if (!requirements.length) return null;
  if (asOptions)
    return (
      <div className="space-y-2">
        {requirements
          .filter((requirement) => requirement.state !== "complete")
          .map((requirement, index) => (
            <Link
              key={`${requirement.kind}:${requirement.profileId}`}
              to="/authorizations/$kind"
              params={{
                kind: requirement.kind === "management_mandate" ? "mandate" : requirement.kind,
              }}
              search={{
                profile: requirement.profileId,
                person: requirement.profileId,
                returnAction: action.id,
              }}
              aria-disabled={disabled || undefined}
              tabIndex={disabled ? -1 : undefined}
              onClick={(event) => {
                if (disabled) event.preventDefault();
              }}
              className={`flex min-h-12 items-center gap-3 rounded-xl p-3 text-sm hover:bg-muted/50 ${disabled ? "pointer-events-none opacity-50" : ""}`}
            >
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs text-muted-foreground"
                aria-hidden="true"
              >
                {numberFormat(i18n.language).format(index + 1)}
              </span>
              <span className="min-w-0 flex-1 font-medium">
                {t(`requirements.${requirement.kind}`)}
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          ))}
      </div>
    );
  return (
    <section className="space-y-3" aria-label={t("requirements.title")}>
      {requirements.map((requirement) => (
        <div
          key={`${requirement.kind}:${requirement.profileId}`}
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 text-sm ${requirement.state === "complete" ? "bg-emerald-50 text-emerald-800" : "bg-muted"}`}
        >
          <div className="flex items-start gap-2">
            {requirement.state === "complete" && (
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            )}
            <div className="space-y-1">
              <p className="font-medium">{t(`requirements.${requirement.kind}`)}</p>
              <p>
                {requirement.completedAt
                  ? t("requirements.completed", {
                      date: date.format(new Date(requirement.completedAt)),
                    })
                  : t(
                      requirement.state === "unavailable"
                        ? "requirements.unavailable"
                        : "requirements.missing",
                    )}
              </p>
            </div>
          </div>
          {requirement.state !== "complete" && requirement.kind !== "profile_information" && (
            <Button asChild variant="outline">
              <Link
                to="/authorizations/$kind"
                params={{
                  kind: requirement.kind === "management_mandate" ? "mandate" : requirement.kind,
                }}
                search={{ person: requirement.profileId, returnAction: action.id }}
              >
                {t(requirement.kind === "lsa45" ? "requirements.read" : "requirements.openSign")}
              </Link>
            </Button>
          )}
        </div>
      ))}
    </section>
  );
}
