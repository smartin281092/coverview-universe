// Shared SQL projection for the bounded list and dashboard (alias l).
export const followUpOverdueSql = `l.stage not in ('draft','completed') and l.responsible_id is not null
  and (l.waiting is null or (l.waiting->>'until')::timestamptz<=now()) and (
    (l.waiting->>'until')::timestamptz<=now()
    or (l.first_useful_at is null and coalesce(l.first_action_due_at,l.notified_at+interval '24 hours')<=now())
    or (l.first_useful_at is not null and l.due_at<=now())
    or (l.assignment='proposed' and l.first_useful_at is null and l.acceptance_due_at<=now()))`;

// Attribution dates are frozen at notification; subsequent waits have an explicit review date.
export function followUpDeadline(lead: {
  notifiedAt: Date | null;
  firstUsefulAt: Date | null;
  dueAt: Date | null;
  waiting: { until: string } | null;
  firstActionDueAt?: Date | null;
  acceptanceDueAt?: Date | null;
}) {
  const firstActionDueAt =
    lead.firstActionDueAt ??
    (lead.notifiedAt ? new Date(lead.notifiedAt.getTime() + 86400000) : null);
  const base = lead.firstUsefulAt ? lead.dueAt : firstActionDueAt;
  const reviewDueAt = base
    ? new Date(Math.max(base.getTime(), lead.waiting ? new Date(lead.waiting.until).getTime() : 0))
    : null;
  return {
    firstActionDueAt,
    acceptanceDueAt: lead.acceptanceDueAt ?? null,
    reviewDueAt,
    escalationDueAt: reviewDueAt ? new Date(reviewDueAt.getTime() + 4 * 3600000) : null,
  };
}
