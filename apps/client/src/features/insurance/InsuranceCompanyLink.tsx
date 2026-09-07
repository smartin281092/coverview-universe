import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@coverview/ui";
import type { InsuranceCompanyId } from "@coverview/contracts";
import { CompanyLogo } from "./CompanyLogo";

export function InsuranceCompanyLink({ companyId }: { companyId: InsuranceCompanyId }) {
  const { t } = useTranslation("documents");
  const { t: ta } = useTranslation("authorizations");
  const name = ta(`companies.names.${companyId}`);
  return (
    <Card
      asChild
      className="w-48 max-w-full gap-2 rounded-xl border border-border bg-transparent p-3 transition-colors duration-200 hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary motion-reduce:transition-none"
    >
      <Link
        to="/insurance-companies/$companyId"
        params={{ companyId }}
        search={{}}
        aria-label={t("companyOpen", { company: name })}
      >
        <span className="flex w-full items-center justify-between gap-3">
          <CompanyLogo companyId={companyId} className="h-6 w-14 object-left" />
          <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </span>
        <span className="min-w-0 break-words text-sm font-medium">{name}</span>
      </Link>
    </Card>
  );
}
