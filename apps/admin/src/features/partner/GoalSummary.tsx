import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import type { createPartnerClient } from "@coverview/api-client/partner";
import { Button } from "@coverview/ui";
export function GoalSummary({
  identity,
  blocked,
  client,
  partnerUrl,
}: {
  identity: IdentityMe;
  blocked: boolean;
  client: ReturnType<typeof createPartnerClient>;
  partnerUrl: string;
}) {
  const { t, i18n } = useTranslation("partner");
  const query = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "partner-goals"],
    queryFn: ({ signal }) => client.goals({ state: "active" }, signal),
    enabled: !blocked,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 60000,
  });
  if (blocked) return null;
  const percent = (value: number | null) =>
    value === null
      ? t("goals.unavailable")
      : new Intl.NumberFormat(i18n.language, { style: "percent", maximumFractionDigits: 1 }).format(
          value / 100,
        );
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t("goals.title")}</h2>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <a href={`${partnerUrl}/statistics?scope=network`}>{t("goals.statistics")}</a>
          </Button>
          <Button variant="outline" asChild>
            <a href={`${partnerUrl}/goals`}>{t("goals.open")}</a>
          </Button>
        </div>
      </div>
      {query.isPending ? (
        <p>{t("loading")}</p>
      ) : query.isError ? (
        <div role="alert">
          <p>{t("error")}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : !query.data.items.length ? (
        <p>{t("goals.empty")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {query.data.items.slice(0, 3).map((goal) => (
            <a
              key={goal.id}
              href={`${partnerUrl}/goals?goalId=${encodeURIComponent(goal.id)}`}
              className="space-y-3 rounded-xl border border-border p-5 hover:bg-muted/40"
            >
              <h3 className="font-semibold">{goal.current.input.title}</h3>
              <p>{t("goals.progress", { value: percent(goal.progressPercent) })}</p>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
