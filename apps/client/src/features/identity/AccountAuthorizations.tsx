import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CircleDashed, ArrowUpRight } from "lucide-react";
import { Button } from "@coverview/ui";

export function AccountAuthorizations() {
  const { t } = useTranslation("authorizations");
  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm text-muted-foreground">{t("intro")}</p>
      <ul className="divide-y divide-border">
        {(["procuration", "mandate"] as const).map((kind) => (
          <li key={kind} className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="font-medium">{t(`${kind}.title`)}</h2>
              <p className="max-w-xl text-sm text-muted-foreground">{t(`${kind}.description`)}</p>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CircleDashed className="size-4 shrink-0" aria-hidden="true" />
                {t("notRecorded")}
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/authorizations/$kind" params={{ kind }}>
                {t("view")}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
