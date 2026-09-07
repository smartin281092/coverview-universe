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
      className="flex-row items-center gap-4 rounded-xl border border-border bg-transparent px-5 py-4 transition-colors duration-200 hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary motion-reduce:transition-none"
    >
      <Link
        to="/insurance-companies/$companyId"
        params={{ companyId }}
        search={{}}
        aria-label={t("companyOpen", { company: name })}
      >
        <span className="flex h-12 w-28 shrink-0 items-center justify-center">
          <CompanyLogo companyId={companyId} />
        </span>
        <span className="min-w-0 flex-1 break-words text-base font-medium">{name}</span>
        <ArrowUpRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </Card>
  );
}
