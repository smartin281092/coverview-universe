import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FileText, Download } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import type { DocumentSummary, InsuranceContract } from "@coverview/contracts";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  LoadingState,
} from "@coverview/ui";
import { api } from "../../api";
import { AdminFailure } from "./AdminFailure";

export function AdminContracts({
  identity,
  userId,
  profileId,
  blocked,
  portalContainer,
}: {
  identity: IdentityMe;
  userId: string;
  profileId: string;
  blocked: boolean;
  portalContainer: HTMLDivElement | null;
}) {
  const { t, i18n } = useTranslation("dossier");
  const query = useQuery({
    queryKey: [
      "private",
      identity.user.id,
      identity.session.id,
      "admin-user",
      userId,
      "contracts",
      profileId,
    ],
    queryFn: ({ signal }) => api.adminProfileContracts(userId, profileId, { signal }),
    enabled: !blocked,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (current) => (current.state.error ? false : 15000),
  });
  const [selected, setSelected] = useState<{
    contract: InsuranceContract | null;
    documents: DocumentSummary[];
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  const download = async (document: DocumentSummary) => {
    if (blocked || busy.current) return;
    busy.current = true;
    setPending(true);
    setFailure(null);
    const active = new AbortController();
    controller.current = active;
    try {
      const blob = await api.downloadAdminDocument(userId, profileId, document.id, {
        signal: active.signal,
      });
      if (active.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = document.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (!active.signal.aborted) setFailure(error);
    } finally {
      if (!active.signal.aborted) {
        busy.current = false;
        setPending(false);
      }
    }
  };
  if (query.isError)
    return <AdminFailure error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return <LoadingState label={t("loading")} />;
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeZone: "UTC" });
  const contract = selected?.contract;
  const hasContracts =
    query.data.companies.some((company) => company.contracts.length > 0) ||
    query.data.unassigned.length > 0;
  return (
    <div className="space-y-6">
      {!hasContracts && (
        <EmptyState title={t("contracts.empty")} description={t("contracts.emptyDescription")} />
      )}
      {query.data.companies
        .filter((company) => company.contracts.length > 0)
        .map((company) => (
          <section key={company.companyId} className="space-y-3">
            <h2 className="text-lg font-medium">{t(`contracts.companies.${company.companyId}`)}</h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {company.contracts.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={blocked}
                    onClick={() =>
                      setSelected({
                        contract: item,
                        documents: company.documents.filter((document) =>
                          item.documentIds.includes(document.id),
                        ),
                      })
                    }
                    className="flex h-full w-full gap-3 rounded-xl border p-4 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <FileText className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
                    <span className="space-y-2">
                      <span className="block break-words font-medium">{item.title}</span>
                      {item.policyNumber && (
                        <span className="block text-sm text-muted-foreground">
                          {t("contracts.number", { number: item.policyNumber })}
                        </span>
                      )}
                      <Badge variant="secondary">{t(`contracts.states.${item.state}`)}</Badge>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      {query.data.unassigned.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">{t("contracts.unknown")}</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {query.data.unassigned.map((document) => (
              <li key={document.id}>
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => setSelected({ contract: null, documents: [document] })}
                  className="w-full rounded-xl border p-4 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {document.title || document.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Dialog
        open={Boolean(selected && !blocked)}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setSelected(null);
            setFailure(null);
          }
        }}
      >
        <DialogContent
          portalContainer={portalContainer}
          className="max-h-[90dvh] overflow-y-auto p-6 sm:max-w-xl"
        >
          <DialogHeader>
            <DialogTitle>{contract?.title ?? t("contracts.details")}</DialogTitle>
            <DialogDescription>{t("contracts.source")}</DialogDescription>
          </DialogHeader>
          {contract && (
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">{t("contracts.period")}</dt>
                <dd>
                  {t("contracts.periodValue", {
                    start: contract.startsOn
                      ? date.format(new Date(contract.startsOn))
                      : t("contracts.missing"),
                    end: contract.endsOn
                      ? date.format(new Date(contract.endsOn))
                      : t("contracts.missing"),
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("contracts.premium")}</dt>
                <dd>
                  {contract.premium
                    ? new Intl.NumberFormat(i18n.language, {
                        style: "currency",
                        currency: contract.premium.currency,
                      }).format(contract.premium.amountMinor / 100)
                    : t("contracts.missing")}
                  {contract.premium && (
                    <span className="ml-2">
                      {t(`contracts.frequencies.${contract.premium.period}`)}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          )}
          <section className="space-y-3">
            <h3 className="font-medium">{t("contracts.documents")}</h3>
            {selected?.documents.map((document) => (
              <div
                key={document.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <p className="min-w-0 flex-1 break-words text-sm">
                  {document.title || document.name}
                </p>
                <Button
                  variant="outline"
                  disabled={pending || blocked || !document.canDownload}
                  onClick={() => void download(document)}
                >
                  <Download className="size-4" aria-hidden="true" />
                  {t("contracts.document")}
                </Button>
              </div>
            ))}
          </section>
          {failure ? <AdminFailure error={failure} onRetry={() => setFailure(null)} /> : null}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                setSelected(null);
                setFailure(null);
              }}
            >
              {t("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
