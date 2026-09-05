import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button, EmptyState, ErrorState, LoadingState } from "@coverview/ui";
import { api } from "../api";

export function HomePage() {
  const { t } = useTranslation();
  const health = useQuery({
    queryKey: ["platform", "health"],
    queryFn: ({ signal }) => api.health({ signal }),
  });
  return (
    <>
      <div className="space-y-3">
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground">{t("subtitle")}</p>
      </div>
      <EmptyState
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        action={
          import.meta.env.DEV ? (
            <Button asChild size="lg">
              <Link to="/preview">
                {t("preview")}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ) : undefined
        }
      />
      <section aria-label={t("health.title")} className="space-y-3">
        <h2 className="text-sm font-semibold">{t("health.title")}</h2>
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
          <div
            role="status"
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-5"
          >
            <CheckCircle2 className="size-5 text-success-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">{t("health.ready")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("health.description")}</p>
            </div>
          </div>
        )}
      </section>
      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{t("demoNote")}</p>
    </>
  );
}
