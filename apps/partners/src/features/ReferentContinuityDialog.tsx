import { useTranslation } from "react-i18next";
import type { LeadDetail } from "@coverview/contracts/partner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@coverview/ui";
export function ReferentContinuityDialog({
  lead,
  onClose,
}: {
  lead: LeadDetail;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const value = lead.referentContinuity;
  if (!value) return null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto" closeLabel={t("close")}>
        <DialogHeader>
          <DialogTitle>{t("referents.title")}</DialogTitle>
          <DialogDescription>
            {t("referents.subject", {
              client: lead.clientName,
              category: t(`category.${lead.category}`),
            })}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          {value.selection.advisor
            ? t("referents.advisor", {
                name: value.selection.advisor.name,
                organization: value.selection.advisor.organization,
              })
            : t("referents.none")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t(`referents.selection.${value.selection.status}`)}
        </p>
        <p className="text-sm font-medium">{t(`referents.status.${value.status}`)}</p>
        {value.suggestion && (
          <p className="text-sm">{t("referents.suggestion", { name: value.suggestion.name })}</p>
        )}
        {value.status === "human_review" && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("referents.checks")}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {value.missingChecks.map((check) => (
                <li key={check}>{t(`referents.missing.${check}`)}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-sm text-muted-foreground">{t("referents.limits")}</p>
      </DialogContent>
    </Dialog>
  );
}
