import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, CalendarDays, CheckSquare, Clock3, Flag } from "lucide-react";
import { Badge } from "@coverview/ui";
import type { LeadSummary } from "@coverview/api-client/partner";
import { formatDate, formatMoney } from "./Field";
export function LeadCard({ lead, compact = false }: { lead: LeadSummary; compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <article
      draggable={lead.allowedActions?.includes("transition") ?? lead.canEdit}
      onDragStart={(event) => event.dataTransfer.setData("text/lead-id", lead.id)}
      className="group rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t(`category.${lead.category}`)}
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
        className="flex items-start justify-between gap-2 text-base font-semibold leading-snug"
      >
        <span>{lead.title}</span>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
      <p className="mt-1 text-sm text-muted-foreground">{lead.clientName}</p>
      {lead.object && <p className="mt-1 truncate text-xs text-muted-foreground">{lead.object}</p>}
      {!compact && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="line-clamp-2 text-sm">{lead.nextAction || t("detail.noAction")}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 className="size-3.5" />
            {formatDate(lead.dueAt)}
          </p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{lead.responsibleName ?? t("detail.noResponsible")}</span>
        {lead.openTasks > 0 && (
          <span className="ml-auto flex items-center gap-1">
            <CheckSquare className="size-3.5" />
            {lead.openTasks}
          </span>
        )}
        {lead.nextAppointmentAt && (
          <CalendarDays className="size-3.5" aria-label={formatDate(lead.nextAppointmentAt)} />
        )}
      </div>
      {lead.alerts[0] && (
        <p className="mt-3 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {t(`alerts.${lead.alerts[0]}`)}
        </p>
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
