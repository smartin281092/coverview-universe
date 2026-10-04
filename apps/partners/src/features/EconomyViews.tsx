import { useTranslation } from "react-i18next";
import { Button, Badge } from "@coverview/ui";
import type { CommercialTerms, MarketReservation } from "@coverview/contracts/partner-economy";
export const economyQueryPolicy = {
  gcTime: 0,
  staleTime: 0,
  retry: false,
  refetchInterval: 15000,
} as const;
export function EconomyLoading({ error, retry }: { error: boolean; retry: () => void }) {
  const { t } = useTranslation("economy");
  return (
    <div className="rounded-xl border border-border p-6" role={error ? "alert" : "status"}>
      <p>{t(error ? "loadError" : "loading")}</p>
      {error && (
        <Button className="mt-3" variant="outline" onClick={retry}>
          {t("retry")}
        </Button>
      )}
    </div>
  );
}
export function EconomyPages({
  next,
  reset,
  onNext,
}: {
  next: string | null;
  reset: () => void;
  onNext: (s: string) => void;
}) {
  const { t } = useTranslation("economy");
  return (
    <nav aria-label={t("pagination")} className="flex justify-end gap-3">
      <Button variant="outline" onClick={reset}>
        {t("first")}
      </Button>
      <Button variant="outline" disabled={!next} onClick={() => next && onNext(next)}>
        {t("next")}
      </Button>
    </nav>
  );
}
export function useEconomyFormat() {
  const { i18n } = useTranslation();
  return {
    money: (n: number | null) =>
      n === null
        ? "—"
        : new Intl.NumberFormat(i18n.language, { style: "currency", currency: "CHF" }).format(
            n / 100,
          ),
    percent: (n: number) =>
      new Intl.NumberFormat(i18n.language, { style: "percent", maximumFractionDigits: 2 }).format(
        n / 10000,
      ),
    date: (s: string) =>
      new Intl.DateTimeFormat(i18n.language, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Zurich",
      }).format(new Date(s)),
  };
}
export function TermsView({ terms }: { terms: CommercialTerms }) {
  const { t } = useTranslation("economy"),
    f = useEconomyFormat();
  return (
    <div className="space-y-4">
      <p className="font-medium">
        {t(`model.${terms.supplier.model}`)}
        {t("separator")}{" "}
        {terms.supplier.model === "fixed"
          ? f.money(terms.supplier.amountMinor)
          : f.percent(terms.supplier.rateBps)}
      </p>
      <p className="text-sm">
        {t(`trigger.${terms.supplier.trigger}`)}
        {t("separator")}{" "}
        {t("validity", { from: f.date(terms.validFrom), until: f.date(terms.validUntil) })}
      </p>
      <dl className="grid gap-4 sm:grid-cols-2">
        {[
          "basis",
          "sourceReference",
          "reserveTerms",
          "clawbackTerms",
          "paymentTerms",
          "validityCriteria",
          "replacementRefundTerms",
          "branchRules",
          "caps",
          "taxTreatment",
          "bonusTerms",
        ].map((name) => (
          <div key={name}>
            <dt className="text-sm text-muted-foreground">{t(`fields.${name}`)}</dt>
            <dd className="whitespace-pre-wrap break-words">
              {terms[name as keyof CommercialTerms] as string}
            </dd>
          </div>
        ))}
        <div>
          <dt>{t("fields.disputeDays")}</dt>
          <dd>{terms.disputeDays}</dd>
        </div>
        <div>
          <dt>{t("fields.categories")}</dt>
          <dd>{terms.categories.map((c) => t(`partner:category.${c}`)).join(", ")}</dd>
        </div>
        <div>
          <dt>{t("fields.companies")}</dt>
          <dd>{terms.companies.join(", ")}</dd>
        </div>
        <div>
          <dt>{t("fields.coverviewRate")}</dt>
          <dd>{f.percent(terms.coverviewRateBps)}</dd>
        </div>
        <div>
          <dt>{t("fields.collector")}</dt>
          <dd>{t(`collector.${terms.collector}`)}</dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">{t("fixedNotice")}</p>
      <p className="text-sm text-muted-foreground">{t("receiverResidual")}</p>
      <dl className="space-y-2">
        {terms.deductions.map((d) => (
          <div key={d.code}>
            <dt>{d.code}</dt>
            <dd>{d.description}</dd>
          </div>
        ))}
        {terms.contributors.map((c) => (
          <div key={c.userId}>
            <dt>
              {c.userId}
              {t("separator")}
              {f.percent(c.rateBps)}
            </dt>
            <dd>{c.basisReference}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
export function MissionView({ reservation }: { reservation: MarketReservation }) {
  const { t } = useTranslation("economy"),
    f = useEconomyFormat();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{t(`state.${reservation.state}`)}</Badge>
        <Badge variant="outline">
          {t("mandateState", { state: t(`state.${reservation.mandate}`) })}
        </Badge>
      </div>
      <p>
        {reservation.publisherName}
        {t("arrow")}
        {reservation.targetName}
      </p>
      <p>
        {t(`partner:collaboration.mode.${reservation.mission.mode}`)}
        {t("separator")} {t(`partner:collaboration.access.${reservation.mission.access}`)}
        {t("separator")}{" "}
        {t(`partner:collaboration.communication.${reservation.mission.communication}`)}
      </p>
      <dl className="space-y-3">
        {(["scope", "responsibilities", "powers", "limitations"] as const).map((k) => (
          <div key={k}>
            <dt className="text-sm text-muted-foreground">{t(`fields.${k}`)}</dt>
            <dd className="whitespace-pre-wrap">{reservation.mission[k]}</dd>
          </div>
        ))}
      </dl>
      <p>{t("missionUntil", { date: f.date(reservation.mission.validUntil) })}</p>
      <p>{t("reservationUntil", { date: f.date(reservation.expiresAt) })}</p>
    </div>
  );
}
