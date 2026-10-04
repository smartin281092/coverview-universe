import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@coverview/ui";
import { usePartner } from "./PartnerSession";
import { partnerApi } from "../api";
import { formatMeasure, defaultPilotageQuery } from "./pilotage-display";
export function GoalSummary() {
  const { t, i18n } = useTranslation("pilotage"),
    session = usePartner();
  const goals = useQuery({
    queryKey: [...session.queryKey, "dashboard-goals"],
    queryFn: ({ signal }) => partnerApi.goals({ state: "active" }, signal),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 60000,
  });
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t("goalsTitle")}</h2>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link to="/goals" search={{ state: "active" }}>
              {t("allGoals")}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link
              to="/statistics"
              search={{
                ...defaultPilotageQuery(),
                scope: session.context.administrator ? "network" : "self",
              }}
            >
              {t("title")}
            </Link>
          </Button>
        </div>
      </div>
      {goals.isPending ? (
        <p>{t("loading")}</p>
      ) : goals.isError ? (
        <div role="alert">
          <p>{t("changed")}</p>
          <Button variant="outline" onClick={() => void goals.refetch()}>
            {t("reload")}
          </Button>
        </div>
      ) : !goals.data.items.length ? (
        <p>{t("noGoals")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {goals.data.items.slice(0, 3).map((goal) => (
            <Link
              key={goal.id}
              to="/goals"
              search={{ state: "active", goalId: goal.id }}
              className="space-y-3 rounded-xl border border-border p-5 hover:bg-muted/40"
            >
              <p className="font-semibold">{goal.current.input.title}</p>
              <p>
                {t("goalNumbers", {
                  actual: formatMeasure(goal.actual.value, goal.actual.unit, i18n.language),
                  target: formatMeasure(goal.current.input.target, goal.actual.unit, i18n.language),
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("progressValue", {
                  value: formatMeasure(goal.progressPercent, "percent", i18n.language),
                })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
