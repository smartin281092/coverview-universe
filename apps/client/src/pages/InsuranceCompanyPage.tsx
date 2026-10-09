import { useWalletProfileScope } from "../features/profile/use-wallet-profile-scope";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowUpRight, FileText, Wallet, ShieldCheck } from "lucide-react";
import { insuranceCompanyIdSchema, type InsuranceCompanyId } from "@coverview/contracts";
import type { IdentityMe } from "@coverview/api-client";
import {
  Button,
  Card,
  EmptyState,
  LoadingState,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@coverview/ui";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { DocumentFailure } from "../features/documents/DocumentFailure";
import { DocumentLabels } from "../features/documents/DocumentLabels";
import { CompanyLogo } from "../features/insurance/CompanyLogo";
import { InsuranceContractCard } from "../features/insurance/InsuranceContractCard";
import { api } from "../api";
import { MissingPage } from "./StatesPage";
import { numberFormat } from "@coverview/ui/number-format";

const pageSize = 12;
function Company({ identity, companyId }: { identity: IdentityMe; companyId: InsuranceCompanyId }) {
  const { scope, filter } = useWalletProfileScope();
  const { t, i18n } = useTranslation("insurance");
  const { t: ta } = useTranslation("authorizations");
  const { t: td } = useTranslation("documents");
  const search = useSearch({ from: "/insurance-companies/$companyId" });
  const navigate = useNavigate();
  const profiles = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "managed-profiles"],
    queryFn: ({ signal }) => api.profiles({ signal }),
    enabled: scope === "all",
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });

  const query = useQuery({
    queryKey: [
      "private",
      identity.user.id,
      identity.session.id,
      "insurance-company",
      companyId,
      scope,
    ],
    queryFn: ({ signal }) => api.insuranceCompany(companyId, { signal }, filter),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  if (query.isPending) return <LoadingState label={t("loading")} />;
  if (query.isError)
    return <DocumentFailure error={query.error} onRetry={() => void query.refetch()} />;
  const { contracts, documents, stats } = query.data;
  const tab = search.tab ?? (contracts.length ? "contracts" : "documents");
  const visibleContracts = contracts.filter((contract) =>
    tab === "expired" ? contract.state === "expired" : contract.state !== "expired",
  );
  const count = tab === "documents" ? documents.length : visibleContracts.length;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const page = Math.min(search.page ?? 1, totalPages);
  const start = (page - 1) * pageSize;
  const update = (nextTab: "contracts" | "expired" | "documents", nextPage = 1) =>
    void navigate({
      to: "/insurance-companies/$companyId",
      params: { companyId },
      search: { tab: nextTab, page: nextPage },
    });
  const money = (amountMinor: number, currency: string) =>
    numberFormat(i18n.language, { style: "currency", currency }).format(amountMinor / 100);
  const number = (value: number) => numberFormat(i18n.language).format(value);
  const addDocument = (
    <Button asChild className="min-h-11">
      <Link to="/documents">
        <FileText className="size-4" aria-hidden="true" />
        {t("readDocuments")}
      </Link>
    </Button>
  );
  const pagination = totalPages > 1 && (
    <nav className="flex items-center justify-between gap-3 pt-4" aria-label={t("pagination")}>
      <Button variant="outline" disabled={page === 1} onClick={() => update(tab, page - 1)}>
        {t("previous")}
      </Button>
      <span className="text-sm text-muted-foreground">
        {t("page", { page, total: totalPages })}
      </span>
      <Button
        variant="outline"
        disabled={page === totalPages}
        onClick={() => update(tab, page + 1)}
      >
        {t("next")}
      </Button>
    </nav>
  );
  return (
    <div className="space-y-6">
      <Link
        to="/documents"
        className="wallet-back-link inline-flex min-h-11 items-center gap-2 text-sm font-medium text-indigo-600"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("back")}
      </Link>
      <div className="cv-tabbed-page">
        <header className="space-y-3">
          <div className="flex items-center gap-5">
            <span className="flex h-16 w-28 shrink-0 items-center justify-center">
              <CompanyLogo companyId={companyId} />
            </span>
            <div className="min-w-0">
              <p className="wallet-page-eyebrow cv-meta text-muted-foreground">{t("eyebrow")}</p>
              <h1 className="break-words text-2xl font-medium tracking-tight sm:text-4xl">
                {ta(`companies.names.${companyId}`)}
              </h1>
            </div>
          </div>
          <p className="text-muted-foreground">{t("description")}</p>
        </header>
        <Tabs
          value={tab}
          className="gap-6"
          onValueChange={(value) => {
            if (value === "contracts" || value === "expired" || value === "documents")
              update(value);
          }}
        >
          <TabsList className="min-h-[50px] w-full sm:w-fit" aria-label={t("eyebrow")}>
            <TabsTrigger value="contracts" className="min-h-11 px-3 text-sm">
              {t("tabs.contracts")}
            </TabsTrigger>
            <TabsTrigger value="expired" className="min-h-11 px-3 text-sm">
              {t("tabs.expired")}
            </TabsTrigger>
            <TabsTrigger value="documents" className="min-h-11 px-3 text-sm">
              {t("tabs.documents")}
            </TabsTrigger>
          </TabsList>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card className="col-span-2 gap-2 p-5 sm:col-span-1">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="size-4" aria-hidden="true" />
                {t("premiums")}
              </p>
              <div className="space-y-1 text-xl font-medium">
                {stats.annualPremiumTotals.length ? (
                  stats.annualPremiumTotals.map((total) => (
                    <p key={total.currency}>{money(total.amountMinor, total.currency)}</p>
                  ))
                ) : (
                  <p>{t("noPremiums")}</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t("premiumsHelp")}</p>
              {stats.incomplete && (
                <p className="text-xs text-amber-700">
                  {stats.premiumCoverage.included < stats.premiumCoverage.total
                    ? t("partialPremiums", {
                        count: stats.premiumCoverage.included,
                        included: stats.premiumCoverage.included,
                        total: stats.premiumCoverage.total,
                      })
                    : t("uncertainPremiums")}
                </p>
              )}
            </Card>
            <Card className="gap-2 p-5">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="size-4" aria-hidden="true" />
                {t("contractsCount")}
              </p>
              <p className="text-3xl font-medium">{number(stats.contractCount)}</p>
              <p className="text-xs text-muted-foreground">
                {t("activeCount", { count: stats.activeContractCount })}
              </p>
            </Card>
            <Card className="gap-2 p-5">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="size-4" aria-hidden="true" />
                {t("documentsCount")}
              </p>
              <p className="text-3xl font-medium">{number(stats.documentCount)}</p>
              <p className="text-xs text-muted-foreground">{t("documentsHelp")}</p>
            </Card>
          </div>
          {(["contracts", "expired"] as const).map((section) => (
            <TabsContent key={section} value={section} className="space-y-4">
              <h2 className="sr-only">
                {t(section === "expired" ? "expiredContracts" : "currentContracts")}
              </h2>
              {visibleContracts.length === 0 ? (
                <EmptyState
                  title={t(section === "expired" ? "noExpired" : "noContracts")}
                  description={t(section === "expired" ? "noExpiredHelp" : "noContractsHelp")}
                  action={section === "contracts" ? addDocument : undefined}
                />
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    {visibleContracts.slice(start, start + pageSize).map((contract) => (
                      <InsuranceContractCard
                        key={contract.id}
                        contract={contract}
                        profileName={
                          scope === "all"
                            ? profiles.data?.profiles.find(
                                (profile) => profile.id === (contract.profileId ?? "self"),
                              )?.displayName
                            : undefined
                        }
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("statusHelp")}</p>
                  {pagination}
                </>
              )}
            </TabsContent>
          ))}
          <TabsContent value="documents" className="space-y-4">
            {documents.length === 0 ? (
              <EmptyState
                title={t("noDocuments")}
                description={t("noDocumentsHelp")}
                action={addDocument}
              />
            ) : (
              <>
                <ul className="space-y-1">
                  {documents.slice(start, start + pageSize).map((document) => (
                    <li key={document.id}>
                      <Link
                        to="/documents/$documentId"
                        params={{ documentId: document.id }}
                        className="flex min-h-16 items-center gap-3 rounded-xl px-3 py-3 transition-colors duration-200 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                      >
                        <FileText
                          className="size-5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <h3 className="break-words text-base font-medium">
                            {document.title ??
                              td(`classification.${document.classification ?? document.category}`)}
                          </h3>
                          <DocumentLabels document={document} />
                          {scope === "all" && (
                            <p className="text-xs text-muted-foreground">
                              {td("uploadProfile.name", {
                                name:
                                  profiles.data?.profiles.find(
                                    (profile) => profile.id === (document.profileId ?? "self"),
                                  )?.displayName ?? td("uploadProfile.unknown"),
                              })}
                            </p>
                          )}
                          <p className="break-words text-xs text-muted-foreground">
                            {t("documentMeta", {
                              name: document.name,
                              date: new Intl.DateTimeFormat(i18n.language, {
                                dateStyle: "medium",
                              }).format(new Date(document.createdAt)),
                            })}
                          </p>
                        </div>
                        <ArrowUpRight
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
                {pagination}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export function InsuranceCompanyPage() {
  const { companyId } = useParams({ from: "/insurance-companies/$companyId" });
  const parsed = insuranceCompanyIdSchema.safeParse(companyId);
  if (!parsed.success) return <MissingPage />;
  return (
    <IdentityBoundary>
      {(identity) => (
        <Company
          key={`${identity.user.id}:${identity.session.id}:${parsed.data}`}
          identity={identity}
          companyId={parsed.data}
        />
      )}
    </IdentityBoundary>
  );
}
