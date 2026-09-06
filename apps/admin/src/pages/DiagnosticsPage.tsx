import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import { AccessDeniedState, ErrorState, LoadingState } from "@coverview/ui";
import { api } from "../api";

export function DiagnosticsPage() {
  const { t } = useTranslation();
  const health = useQuery({
    queryKey: ["platform", "health"],
    queryFn: ({ signal }) => api.health({ signal }),
    enabled: import.meta.env.DEV,
  });
  if (!import.meta.env.DEV)
    return (
      <AccessDeniedState
        title={t("stateExamples.localOnly")}
        description={t("stateExamples.localOnlyDescription")}
      />
    );
  return (
    <section className="space-y-6">
      <h1 className="cv-app-heading">{t("health.title")}</h1>
      {health.isPending ? (
        <LoadingState label={t("health.loading")} />
      ) : health.isError ? (
        <ErrorState
          title={t("health.error")}
          description={t("health.errorDescription")}
          retryLabel={t("health.retry")}
          pendingLabel={t("health.pending")}
          isPending={health.isFetching}
          onRetry={() => {
            void health.refetch();
          }}
        />
      ) : (
        <div role="status" className="flex items-center gap-4 py-6">
          <CheckCircle2 className="size-5 text-success-foreground" aria-hidden="true" />
          <div>
            <p className="font-medium">{t("health.ready")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("health.description")}</p>
          </div>
        </div>
      )}
    </section>
  );
}
