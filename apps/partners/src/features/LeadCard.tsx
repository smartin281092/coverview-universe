import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  AlarmClock,
  ArrowUpRight,
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  Clock3,
  Flag,
  LifeBuoy,
  MoonStar,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@coverview/ui";
import type { LeadSummary } from "@coverview/api-client/partner";
import { formatDate, formatMoney } from "./Field";

const icons = {
  stale: MoonStar,
  urgent: Flag,
  task_overdue: TriangleAlert,
  appointment_today: CalendarCheck,
  near_deadline: AlarmClock,
  coverview_needed: LifeBuoy,
} as const;

// Compact by design: what is needed to decide the next action, details stay in the file.
export function LeadCard({
  lead,
  compact = false,
  onOpen,
}: {
  lead: LeadSummary;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const { t } = useTranslation();
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(lead.stageChangedAt).getTime()) / 86400000),
  );
  return (
    <article
      draggable={lead.allowedActions?.includes("transition") ?? lead.canEdit}
      onDragStart={(event) => event.dataTransfer.setData("text/lead-id", lead.id)}
      className="group rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {lead.requestKind === "new_insurance"
            ? t(`category.${lead.category}`)
            : t(`requestKind.${lead.requestKind}`)}
        </span>
        {lead.priority !== "normal" && (
          <Badge variant="outline">
            <Flag className="mr-1 size-3" />
            {t(`priority.${lead.priority}`)}
          </Badge>
        )}
      </div>
      <Link
        to="/leads/$leadId"
        params={{ leadId: lead.id }}
        onClick={onOpen}
        className="flex items-start justify-between gap-2 text-base font-semibold leading-snug"
      >
        <span>{lead.title}</span>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
      <p className="mt-1 text-sm text-muted-foreground">{lead.clientName}</p>
      {lead.object && <p className="mt-1 truncate text-xs text-muted-foreground">{lead.object}</p>}
      {lead.indicators.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t("card.indicators")}>
          {lead.indicators.map((indicator) => {
            const Icon = icons[indicator];
            return (
              <li key={indicator}>
                <Badge
                  variant={
                    ["task_overdue", "near_deadline", "coverview_needed"].includes(indicator)
                      ? "destructive"
                      : "secondary"
                  }
                >
                  <Icon className="mr-1 size-3" aria-hidden />
                  {t(`card.indicator.${indicator}`)}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
      {!compact && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="line-clamp-2 text-sm">{lead.nextAction || t("detail.noAction")}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 className="size-3.5" aria-hidden />
            {formatDate(lead.dueAt)}
          </p>
          {lead.nextAppointmentAt && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" aria-hidden />
              {t("card.appointment", { date: formatDate(lead.nextAppointmentAt) })}
            </p>
          )}
          {lead.lastContactAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("card.lastContact", { date: formatDate(lead.lastContactAt) })}
            </p>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{lead.responsibleName ?? t("detail.noResponsible")}</span>
        {lead.referrerName && <span>{t("card.referrer", { name: lead.referrerName })}</span>}
        <span>{t("card.daysInStage", { count: days })}</span>
        {lead.openTasks > 0 && (
          <span className="ml-auto flex items-center gap-1">
            <CheckSquare className="size-3.5" aria-hidden />
            {t("card.tasks", { count: lead.openTasks })}
          </span>
        )}
      </div>
      {lead.alerts.length > 0 && (
        <ul className="mt-3 space-y-1">
          {lead.alerts.map((alert) => (
            <li
              key={alert}
              className="rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive"
            >
              {t(`alerts.${alert}`)}
            </li>
          ))}
        </ul>
      )}
      {lead.estimatedCommissionMinor !== null && (
        <p className="mt-3 text-xs">
          {t("detail.potential")}
          {" · "}
          {formatMoney(lead.estimatedCommissionMinor)}
        </p>
      )}
    </article>
  );
}
