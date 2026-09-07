import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowUpRight,
  CalendarDays,
  CarFront,
  House,
  Shield,
  HeartPulse,
  Landmark,
  Plane,
  PawPrint,
  CircleHelp,
  Clock3,
  UserRound,
} from "lucide-react";
import type { InsuranceContract, InsuranceDomain } from "@coverview/contracts";
import { Card } from "@coverview/ui";

const domainIcons: Record<InsuranceDomain, typeof Shield> = {
  motor: CarFront,
  household: House,
  personal_liability: Shield,
  building: House,
  legal_protection: Shield,
  health: HeartPulse,
  accident: Shield,
  life: HeartPulse,
  pension_3a: Landmark,
  pension_3b: Landmark,
  pension: Landmark,
  travel: Plane,
  pet: PawPrint,
  other: Shield,
};
export function InsuranceContractCard({ contract }: { contract: InsuranceContract }) {
  const { t, i18n } = useTranslation("insurance");
  const Icon = contract.domain ? domainIcons[contract.domain] : Shield;
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeZone: "UTC" }).format(
      new Date(value),
    );
  return (
    <Card
      asChild
      className="gap-5 rounded-xl border border-border bg-transparent p-5 transition-colors duration-200 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary motion-reduce:transition-none"
    >
      <Link to="/documents/$documentId" params={{ documentId: contract.id }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <h3 className="break-words text-lg font-medium">
              {t(contract.domain ? `domain.${contract.domain}` : "contract")}
            </h3>
          </div>
          <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="flex min-w-0 items-start gap-2 text-sm">
          <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="break-words">{contract.insuredSubject ?? t("subjectMissing")}</p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
          <span
            className={`inline-flex items-center gap-2 ${contract.state === "active" ? "text-green-700" : contract.state === "upcoming" ? "text-indigo-700" : "text-muted-foreground"}`}
          >
            <span className="relative inline-flex size-2 shrink-0" aria-hidden="true">
              {contract.state === "active" && (
                <span className="absolute inset-0 rounded-full bg-green-500 opacity-40 motion-safe:animate-ping" />
              )}
              <span
                className={`relative inline-flex size-2 rounded-full ${contract.state === "active" ? "bg-green-600" : contract.state === "upcoming" ? "bg-indigo-500" : "bg-muted-foreground"}`}
              />
            </span>
            {t(`state.${contract.state}`)}
          </span>
          {contract.expiresSoon && (
            <span className="inline-flex items-center gap-1.5 text-amber-700">
              <Clock3 aria-hidden="true" className="size-3.5" />
              {t("expiresSoon")}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <CircleHelp aria-hidden="true" className="size-3.5" />
            {t("optimizationUnknown")}
          </span>
        </div>
        <div className="mt-auto space-y-3 border-t border-border pt-3">
          <p className="text-lg font-medium">
            {contract.premium ? (
              t("premium", {
                amount: new Intl.NumberFormat(i18n.language, {
                  style: "currency",
                  currency: contract.premium.currency,
                }).format(contract.premium.amountMinor / 100),
                period: t(`period.${contract.premium.period}`),
              })
            ) : (
              <span className="text-sm font-normal text-muted-foreground">
                {t("premiumMissing")}
              </span>
            )}
          </p>
          {(contract.startsOn || contract.endsOn) && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
              {contract.startsOn && contract.endsOn
                ? t("validity", { start: date(contract.startsOn), end: date(contract.endsOn) })
                : contract.endsOn
                  ? t("endsOn", { date: date(contract.endsOn) })
                  : t("startsOn", { date: date(contract.startsOn!) })}
            </p>
          )}
          {contract.policyNumber && (
            <p className="break-words text-xs text-muted-foreground">
              {t("policyNumber", { number: contract.policyNumber })}
            </p>
          )}
          <span className="sr-only">{t("openContract")}</span>
        </div>
      </Link>
    </Card>
  );
}
