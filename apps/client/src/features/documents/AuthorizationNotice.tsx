import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Info, X, ArrowUpRight } from "lucide-react";
import { Button } from "@coverview/ui";

export function AuthorizationNotice() {
  const { t } = useTranslation("authorizations");
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <aside
      className="relative flex items-start gap-3 rounded-xl bg-indigo-50 p-4 pr-14 text-indigo-950"
      aria-label={t("noticeTitle")}
    >
      <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="space-y-2">
        <p className="max-w-2xl text-sm leading-relaxed">{t("notice")}</p>
        <Link
          to="/authorizations/$kind"
          params={{ kind: "procuration" }}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-indigo-700"
        >
          {t("signProcuration")}
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 size-11"
        aria-label={t("dismiss")}
        onClick={() => setDismissed(true)}
      >
        <X className="size-4" aria-hidden="true" />
      </Button>
    </aside>
  );
}
