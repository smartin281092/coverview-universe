import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { createPartnerClient } from "@coverview/api-client/partner";
import { Button, LoadingState, ErrorState } from "@coverview/ui";
import { AdminBoundary } from "../features/users/AdminBoundary";
import { CounselQueue } from "../features/partner/CounselQueue";

const client = createPartnerClient(
  import.meta.env.VITE_API_URL ??
    (import.meta.env.DEV ? "http://127.0.0.1:4100" : window.location.origin),
);
const partnerUrl =
  import.meta.env.VITE_PARTNER_URL ??
  (import.meta.env.DEV ? "http://127.0.0.1:4104" : "https://partners.coverview.ch");
function Overview({ identity, blocked }: { identity: IdentityMe; blocked: boolean }) {
  const { t } = useTranslation("partner");
  const dashboard = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "partner-dashboard"],
    queryFn: ({ signal }) => client.dashboard(signal),
    enabled: !blocked,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 30000,
  });
  return (
    <div className="space-y-8">
      <header>
        <p className="cv-meta">{t("eyebrow")}</p>
        <h1 className="cv-app-heading mt-3">{t("title")}</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">{t("description")}</p>
      </header>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link to="/partner/continuity">{t("continuity.title")}</Link>
        </Button>
        <Button asChild>
          <a href={partnerUrl}>{t("open")}</a>
        </Button>
        <Button variant="outline" asChild>
          <a href={`${partnerUrl}/applications`}>{t("applications")}</a>
        </Button>
        <Button variant="outline" asChild>
          <a href={`${partnerUrl}/notifications`}>{t("notifications")}</a>
        </Button>
      </div>
      {dashboard.isPending ? (
        <LoadingState label={t("loading")} />
      ) : dashboard.isError ? (
        <ErrorState
          title={t("error")}
          description={t("retryDescription")}
          retryLabel={t("retry")}
          pendingLabel={t("loading")}
          onRetry={() => void dashboard.refetch()}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(["active", "overdue", "unassigned", "resolved"] as const).map((key) => (
            <a
              key={key}
              href={`${partnerUrl}/leads?view=${key === "overdue" ? "overdue" : key === "resolved" ? "closed" : "all"}`}
              className="rounded-xl border border-border bg-card p-6 hover:bg-muted/40"
            >
              <p className="text-sm text-muted-foreground">{t(key)}</p>
              <p className="mt-3 text-3xl font-semibold">{dashboard.data[key]}</p>
            </a>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("scope")}</p>
      <CounselQueue identity={identity} blocked={blocked} />
    </div>
  );
}
export function PartnerPage() {
  return (
    <AdminBoundary>
      {(identity, blocked) => <Overview identity={identity} blocked={blocked} />}
    </AdminBoundary>
  );
}
