import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Info, X, ArrowUpRight } from "lucide-react";
import { Button } from "@coverview/ui";

export function AuthorizationNotice({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation("authorizations");
  return (
    <aside
      className="relative flex flex-col gap-2 rounded-xl bg-indigo-50 p-4 pr-14 text-indigo-950"
      aria-label={t("noticeTitle")}
    >
      <div className="flex items-center gap-2">
        <Info className="size-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <h2 className="text-base font-semibold">{t("noticeTitle")}</h2>
      </div>
      <p className="max-w-2xl text-sm leading-relaxed">{t("notice")}</p>
      <Link
        to="/authorizations/$kind"
        params={{ kind: "procuration" }}
        className="inline-flex min-h-11 self-start items-center gap-2 text-sm font-medium text-indigo-700"
      >
        {t("signProcuration")}
        <ArrowUpRight className="size-4" aria-hidden="true" />
      </Link>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 size-11 motion-reduce:transition-none"
        aria-label={t("dismiss")}
        onClick={onDismiss}
      >
        <X className="size-4" aria-hidden="true" />
      </Button>
    </aside>
  );
}
