import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Button } from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "../features/PartnerSession";
import {
  EconomyLoading,
  EconomyPages,
  economyQueryPolicy,
  useEconomyFormat,
} from "../features/EconomyViews";
export function MarketplacePage() {
  const { t } = useTranslation("economy"),
    session = usePartner(),
    f = useEconomyFormat();
  const [view, setView] = useState<"available" | "mine" | "applications" | "all">("available"),
    [cursor, setCursor] = useState<string>();
  const query = useQuery({
    queryKey: [...session.queryKey, "marketplace", view, cursor],
    queryFn: ({ signal }) =>
      partnerApi.marketplace({ view, ...(cursor ? { cursor } : {}) }, signal),
    ...economyQueryPolicy,
  });
  const data = query.isError ? undefined : query.data;
  return (
    <>
      <header className="space-y-3">
        <h1 className="cv-app-heading">{t("marketTitle")}</h1>
        <p className="max-w-3xl text-muted-foreground">{t("marketIntro")}</p>
        <Button asChild variant="outline">
          <Link to="/commercial-conditions">{t("termsTitle")}</Link>
        </Button>
      </header>
      <div className="flex flex-wrap gap-2">
        {(
          [
            "available",
            "mine",
            "applications",
            ...(session.context.administrator ? ["all" as const] : []),
          ] as const
        ).map((v) => (
          <Button
            key={v}
            variant={view === v ? "default" : "outline"}
            aria-pressed={view === v}
            onClick={() => {
              setView(v);
              setCursor(undefined);
            }}
          >
            {t(`view.${v}`)}
          </Button>
        ))}
      </div>
      {!data ? (
        <EconomyLoading error={query.isError} retry={() => void query.refetch()} />
      ) : (
        <div className="space-y-4">
          {!data.items.length && (
            <p className="rounded-xl border border-border p-6">{t("noMarket")}</p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {data.items.map((m) => (
              <Link
                key={m.id}
                to="/marketplace/$marketId"
                params={{ marketId: m.id }}
                className="space-y-4 rounded-xl border border-border bg-card p-6 hover:bg-muted"
              >
                <div className="flex justify-between gap-4">
                  <h2 className="font-semibold">{t(`partner:category.${m.category}`)}</h2>
                  <Badge variant="secondary">{t(`state.${m.state}`)}</Badge>
                </div>
                <p>
                  {m.language.toUpperCase()}
                  {t("separator")}
                  {m.canton ?? t("unspecified")}
                  {t("separator")} {m.modes.map((v) => t(`modes.${v}`)).join(", ")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t(`qualification.${m.qualification}`)}
                  {t("separator")}
                  {t(`reason.${m.reason}`)}
                </p>
                <p>
                  {t(`model.${m.supplier.model}`)}
                  {t("separator")}{" "}
                  {m.supplier.model === "fixed"
                    ? f.money(m.supplier.amountMinor)
                    : f.percent(m.supplier.rateBps)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("published", { date: f.date(m.createdAt) })}
                </p>
              </Link>
            ))}
          </div>
          <EconomyPages
            next={data.nextCursor}
            reset={() => setCursor(undefined)}
            onNext={setCursor}
          />
        </div>
      )}
    </>
  );
}
