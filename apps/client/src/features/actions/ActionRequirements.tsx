import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import type { ActionCenterItem } from "@coverview/contracts";
import { Button } from "@coverview/ui";

export function ActionRequirements({ action }: { action: ActionCenterItem }) {
  const { t, i18n } = useTranslation("actions");
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  if (!action.requirements.length) return null;
  return (
    <section className="space-y-3" aria-label={t("requirements.title")}>
      {action.requirements.map((requirement) => (
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
          {requirement.state !== "complete" &&
            (requirement.kind === "profile_information" ? (
              <Button asChild variant="outline">
                <Link
                  to="/profile"
                  search={{
                    person: requirement.profileId,
                    tab: "general",
                    ...(requirement.step ? { step: requirement.step } : {}),
                  }}
                >
                  {t("requirements.completeProfile")}
                </Link>
              </Button>
            ) : (
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
            ))}
        </div>
      ))}
    </section>
  );
}
