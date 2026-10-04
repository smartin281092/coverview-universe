import {
  partnerContinuityPolicySchema,
  partnerContinuitySettingsSchema,
  type PartnerContinuityPolicy,
  type PartnerContinuityUpdate,
} from "@coverview/contracts/partner";
import { date, fail, type Executor, type PartnerActor } from "./partner.policy.js";

export const defaultContinuityPolicy: PartnerContinuityPolicy = {
  acceptanceHours: 4,
  automaticReassignments: 1,
  calendar: {
    enabled: false,
    timezone: "Europe/Zurich",
    weekdays: [1, 2, 3, 4, 5],
    opensAt: 540,
    closesAt: 1080,
    closedDates: [],
  },
};
export async function currentContinuityPolicy(db: Executor) {
  const row = (
    await db.query<{ revision: number; policy: unknown }>(
      "select revision,policy from partner_continuity_policies order by revision desc limit 1",
    )
  ).rows[0];
  return {
    revision: row?.revision ?? 0,
    policy: row ? partnerContinuityPolicySchema.parse(row.policy) : defaultContinuityPolicy,
  };
}
export async function readContinuitySettings(db: Executor, actor: PartnerActor) {
  if (!actor.administrator || actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
  const rows = (
    await db.query<{
      revision: number;
      policy: unknown;
      changed_by: string;
      reason: string;
      created_at: Date;
    }>("select * from partner_continuity_policies order by revision desc limit 20")
  ).rows;
  return partnerContinuitySettingsSchema.parse({
    current: rows[0]
      ? { revision: rows[0].revision, policy: rows[0].policy }
      : { revision: 0, policy: defaultContinuityPolicy },
    history: rows.map((r) => ({
      revision: r.revision,
      policy: r.policy,
      changedBy: r.changed_by,
      reason: r.reason,
      createdAt: date(r.created_at),
    })),
  });
}
export async function updateContinuitySettings(
  db: Executor,
  actor: PartnerActor,
  input: PartnerContinuityUpdate,
) {
  if (!actor.administrator || actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
  await db.query("select pg_advisory_xact_lock(hashtext('partner-continuity-settings'))");
  const current = await currentContinuityPolicy(db);
  if (current.revision !== input.revision) fail("PARTNER_CONFLICT", 409);
  const revision = current.revision + 1;
  await db.query(
    "insert into partner_continuity_policies(revision,policy,changed_by,reason) values($1,$2,$3,$4)",
    [revision, JSON.stringify(input.policy), actor.userId, input.reason],
  );
  return String(revision);
}

// Calendar exceptions defer an elapsed-hours deadline to an opening; they never turn 24 h into 24 working hours.
// Search UTC instants so gaps/repeated local times at DST cannot produce an invalid instant.
export function attributionDeadlines(notifiedAt: Date, policy: PartnerContinuityPolicy) {
  const calendar = policy.calendar;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: calendar.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const closed = new Set(calendar.closedDates);
  function isOpen(at: number) {
    const parts = Object.fromEntries(formatter.formatToParts(at).map((p) => [p.type, p.value]));
    const localDate = `${parts.year}-${parts.month}-${parts.day}`;
    const weekday = new Date(`${localDate}T12:00:00Z`).getUTCDay();
    const minute = Number(parts.hour) * 60 + Number(parts.minute);
    return (
      calendar.weekdays.includes(weekday) &&
      !closed.has(localDate) &&
      minute >= calendar.opensAt &&
      minute < calendar.closesAt
    );
  }
  function deadline(hours: number) {
    const raw = notifiedAt.getTime() + hours * 3600000;
    if (!calendar.enabled || isOpen(raw)) return new Date(raw);
    const cap = raw + 7 * 86400000;
    for (let candidate = Math.ceil(raw / 900000) * 900000; candidate <= cap; candidate += 900000)
      if (isOpen(candidate)) return new Date(candidate);
    return new Date(cap);
  }
  const firstActionDueAt = deadline(24);
  return {
    firstActionDueAt,
    acceptanceDueAt: new Date(
      Math.min(deadline(policy.acceptanceHours).getTime(), firstActionDueAt.getTime()),
    ),
  };
}
