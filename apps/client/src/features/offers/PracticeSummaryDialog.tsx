import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReferentContinuity } from "@coverview/contracts/partner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  swissCantonNamesFr,
} from "@coverview/ui";

export function PracticeSummaryDialog({
  value,
}: {
  value: NonNullable<ReferentContinuity["practice"]>;
}) {
  const { t, i18n } = useTranslation("offers"),
    [open, setOpen] = useState(false);
  const names = new Intl.DisplayNames([i18n.language], { type: "language" });
  const list = new Intl.ListFormat(i18n.language);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {t("practice.title")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={t("close")} className="max-h-[90svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("practice.title")}</DialogTitle>
            <DialogDescription>{t("practice.limits")}</DialogDescription>
          </DialogHeader>
          <p className="text-sm">{t(`practice.status.${value.status}`)}</p>
          {value.status === "declared" && (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">{t("practice.languages")}</dt>
                <dd>
                  {value.languageCodes.length
                    ? list.format(value.languageCodes.map((code) => names.of(code) ?? code))
                    : t("practice.unspecified")}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("practice.cantons")}</dt>
                <dd>
                  {value.cantons.length
                    ? list.format(value.cantons.map((code) => swissCantonNamesFr[code]))
                    : t("practice.unspecified")}
                </dd>
              </div>
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
