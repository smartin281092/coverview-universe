import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  leadMatchingSchema,
  type MatchingCandidate,
  type MatchingExclusion,
} from "@coverview/contracts/partner-matching";
import {
  fail,
  failOnConcurrentAbort,
  lockActor,
  engageable,
  membership,
  type Executor,
  type PartnerActor,
} from "./partner.policy.js";
import { readCompetenceSummary } from "./partner.competence.js";
import { readConventionCoverage } from "./partner.convention.js";
import { readPracticeSummary } from "./partner.practice.js";
import { readCurrentAvailability } from "./partner.availability.js";
import { readCapacityAssessment, readCapacityWorkload } from "./partner.capacity.js";
import { readLeadReferentSelection } from "./partner.referents.js";
import { readConfirmedAdvice, type AdviceTarget } from "./partner.advice.js";
import { newId } from "./partner.audit.js";

export type MatchingLead = AdviceTarget & { revision: number; responsibleId: string | null };
type Preferences = {
  status: "confirmed" | "unset" | "confirmation_required" | "unlinked";
  languageCode: string | null;
  mode: string | null;
  canton: string | null;
};
type Evaluated = Omit<MatchingCandidate, "rank" | "reasons" | "caveats">;
type Ranked = { value: Evaluated; order: (number | string)[] };
export type Matching = {
  preferences: Preferences;
  candidates: MatchingCandidate[];
  excluded: { reason: MatchingExclusion; count: number }[];
  evaluated: number;
  truncated: boolean;
  basis: string;
};

const evaluationLimit = 100;
const upcomingWindowMs = 14 * 86_400_000;
const exclusionOrder: MatchingExclusion[] = [
  "previous",
  "restricted",
  "competence",
  "convention",
  "language",
  "region",
  "absence",
  "capacity",
];

export async function readMatchingLead(db: Executor, id: string): Promise<MatchingLead> {
  const row = (
    await db.query<{
      id: string;
      title: string;
      category: string;
      object: string;
      details: unknown;
      client_user_id: string | null;
      client_profile_id: string | null;
      client_name: string;
      advice_scope_revision: number;
      stage: string;
      revision: number;
      responsible_id: string | null;
    }>(
      "select id,title,category,object,details,client_user_id,client_profile_id,client_name,advice_scope_revision,stage,revision,responsible_id from partner_leads where id=$1",
      [id],
    )
  ).rows[0];
  if (!row) fail("PARTNER_NOT_FOUND", 404);
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    object: row.object,
    details: row.details,
    clientUserId: row.client_user_id,
    clientProfileId: row.client_profile_id,
    clientName: row.client_name,
    adviceScopeRevision: row.advice_scope_revision,
    stage: row.stage,
    revision: row.revision,
    responsibleId: row.responsible_id,
  };
}

function compare(requested: string | null, declared: string[] | null) {
  if (!requested) return "not_requested" as const;
  if (!declared?.length) return "unknown" as const;
  return declared.includes(requested) ? ("matches" as const) : ("differs" as const);
}

// Eligibility filters, then explainable criteria. Remuneration and economic data are never read.
async function evaluate(
  db: Executor,
  userId: string,
  lead: MatchingLead,
  preferences: Preferences,
  referentId: string | null,
  now: Date,
): Promise<{ excluded: MatchingExclusion } | { candidate: Ranked }> {
  const member = await membership(db, userId);
  if (!member) return { excluded: "competence" };
  // A CoverView restriction stops new requests for this person or category (C8a).
  if (!engageable(member, lead.category)) return { excluded: "restricted" };
  const competence = (await readCompetenceSummary(db, userId, lead.category)).status;
  if (competence !== "reviewed" && competence !== "limited") return { excluded: "competence" };
  const convention = await readConventionCoverage(db, userId, lead.category);
  if (convention === "missing") return { excluded: "convention" };
  const practice = await readPracticeSummary(db, userId);
  const declared = practice.status === "declared";
  const language = compare(preferences.languageCode, declared ? practice.languageCodes : null);
  if (language === "differs") return { excluded: "language" };
  const inPerson = preferences.mode === "office" || preferences.mode === "home";
  const region = !preferences.mode
    ? ("not_requested" as const)
    : !inPerson
      ? ("not_applicable" as const)
      : compare(preferences.canton, declared ? practice.cantons : null);
  if (region === "differs") return { excluded: "region" };
  const declaration = await readCurrentAvailability(db, member);
  const availability = declaration?.professionalScope === "current" ? declaration : null;
  const at = now.getTime();
  const covers = (p: { startsAt: string; endsAt: string }) =>
    Date.parse(p.startsAt) <= at && Date.parse(p.endsAt) > at;
  if (availability?.periods.some((p) => p.kind === "absent" && covers(p)))
    return { excluded: "absence" };
  const upcoming = availability?.periods.some(
    (p) =>
      p.kind === "available" &&
      Date.parse(p.endsAt) > at &&
      Date.parse(p.startsAt) < at + upcomingWindowMs,
  );
  const mode = !preferences.mode
    ? ("not_requested" as const)
    : !availability
      ? ("unknown" as const)
      : availability.modes.includes(preferences.mode as (typeof availability.modes)[number])
        ? ("matches" as const)
        : ("differs" as const);
  const capacity = await readCapacityAssessment(
    db,
    member,
    lead.category as Parameters<typeof readCapacityAssessment>[2],
    now.toISOString(),
  );
  if (capacity.status === "declared" && capacity.position === "unavailable")
    return { excluded: "capacity" };
  const workload = await readCapacityWorkload(db, userId, now.toISOString());
  const subject = lead.clientProfileId
    ? "l.client_profile_id=$2"
    : "l.client_profile_id is null and l.client_user_id=$2";
  const relationship = !!(
    lead.clientUserId &&
    (
      await db.query(
        `select 1 from partner_leads l where l.id<>$3 and ${subject} and (l.responsible_id=$1
        or exists(select 1 from partner_contributors c where c.lead_id=l.id and c.user_id=$1 and c.access_scope='advice'))
        limit 1`,
        [userId, lead.clientProfileId ?? lead.clientUserId, lead.id],
      )
    ).rowCount
  );
  const recentAssignments =
    (
      await db.query<{ count: number }>(
        "select count(*)::int count from partner_events where kind='lead.assigned' and subject_id=$1 and created_at>$2::timestamptz-interval '30 days'",
        [userId, now.toISOString()],
      )
    ).rows[0]?.count ?? 0;
  const candidate = {
    userId,
    name: member.name,
    organization: member.organization,
    competence: competence === "reviewed" ? ("category" as const) : ("limited" as const),
    convention,
    language,
    region,
    mode,
    availability: !availability
      ? ("undeclared" as const)
      : upcoming
        ? ("upcoming" as const)
        : ("none_upcoming" as const),
    capacity:
      capacity.status === "declared" && capacity.position
        ? capacity.position === "open"
          ? ("open" as const)
          : ("case_by_case" as const)
        : ("unknown" as const),
    referent: referentId === userId,
    relationship,
    activeLeads: workload.accepted + workload.proposed + workload.contributing,
    recentAssignments,
  };
  const comparisons = [candidate.language, candidate.region, candidate.mode];
  const unknowns =
    comparisons.filter((v) => v === "unknown").length +
    (candidate.availability === "undeclared" ? 1 : 0) +
    (candidate.capacity === "unknown" ? 1 : 0);
  return {
    candidate: {
      value: candidate,
      // Lexicographic order: client choice and continuity, client criteria, documented scope,
      // declared availability and capacity, then balance. Ties end on the stable identifier.
      order: [
        candidate.referent ? 0 : 1,
        candidate.relationship ? 0 : 1,
        -comparisons.filter((v) => v === "matches").length,
        candidate.mode === "differs" ? 1 : 0,
        unknowns,
        candidate.competence === "category" ? 0 : 1,
        candidate.convention === "category" ? 0 : 1,
        { upcoming: 0, none_upcoming: 1, undeclared: 2 }[candidate.availability],
        { open: 0, case_by_case: 1, unknown: 2 }[candidate.capacity],
        candidate.activeLeads,
        candidate.recentAssignments,
        userId,
      ],
    },
  };
}

function explain(
  candidate: Evaluated,
  minimumLoad: number,
): Pick<MatchingCandidate, "reasons" | "caveats"> {
  const reasons: MatchingCandidate["reasons"] = [],
    caveats: MatchingCandidate["caveats"] = [];
  if (candidate.referent) reasons.push("referent");
  if (candidate.relationship) reasons.push("relationship");
  if (candidate.language === "matches") reasons.push("language");
  if (candidate.region === "matches") reasons.push("region");
  if (candidate.mode === "matches") reasons.push("mode");
  if (candidate.competence === "category") reasons.push("competence_category");
  if (candidate.availability === "upcoming") reasons.push("availability");
  if (candidate.capacity === "open") reasons.push("capacity_open");
  if (candidate.activeLeads === minimumLoad) reasons.push("low_load");
  if (candidate.language === "unknown") caveats.push("language_unknown");
  if (candidate.region === "unknown") caveats.push("region_unknown");
  if (candidate.mode === "unknown") caveats.push("mode_unknown");
  if (candidate.mode === "differs") caveats.push("mode_differs");
  if (candidate.competence === "limited") caveats.push("competence_limited");
  if (candidate.convention === "limited") caveats.push("convention_limited");
  if (candidate.availability === "undeclared") caveats.push("availability_undeclared");
  if (candidate.capacity === "unknown") caveats.push("capacity_unknown");
  // Conflicts for this precise need are declared by the person once in charge: never inferred.
  caveats.push("conflicts_unchecked");
  return { reasons, caveats };
}

const before = (a: (number | string)[], b: (number | string)[]) => {
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    return typeof a[i] === "number"
      ? (a[i] as number) - (b[i] as number)
      : String(a[i]) < String(b[i])
        ? -1
        : 1;
  }
  return 0;
};

export async function computeMatching(
  db: Executor,
  lead: MatchingLead,
  exclude: string[] = [],
  now = new Date(),
): Promise<Matching> {
  const advice = await readConfirmedAdvice(db, lead);
  const preferences: Preferences =
    advice.status === "confirmed" && advice.current
      ? {
          status: "confirmed",
          languageCode: advice.current.languageCode,
          mode: advice.current.mode,
          canton: advice.current.canton,
        }
      : { status: advice.status, languageCode: null, mode: null, canton: null };
  const referent = await readLeadReferentSelection(db, lead);
  const referentId = referent?.status === "chosen" ? (referent.advisor?.id ?? null) : null;
  const rows = (
    await db.query<{ user_id: string }>(
      `select m.user_id from partner_members m join partner_organizations o on o.id=m.organization_id
      join identity_users u on u.id=m.user_id
      where m.state='approved' and o.state='approved' and m.roles ? 'advisor' and m.application->'categories' ? $1
      and (m.review_due_at is null or m.review_due_at>$2::timestamptz) and not u.global_revocation_pending
      order by m.user_id limit $3`,
      [lead.category, now.toISOString(), evaluationLimit + 1],
    )
  ).rows;
  const counts = new Map<MatchingExclusion, number>();
  const ranked: Ranked[] = [];
  for (const { user_id } of rows.slice(0, evaluationLimit)) {
    if (exclude.includes(user_id)) {
      counts.set("previous", (counts.get("previous") ?? 0) + 1);
      continue;
    }
    const result = await evaluate(db, user_id, lead, preferences, referentId, now);
    if ("excluded" in result) counts.set(result.excluded, (counts.get(result.excluded) ?? 0) + 1);
    else ranked.push(result.candidate);
  }
  ranked.sort((a, b) => before(a.order, b.order));
  const minimumLoad = Math.min(...ranked.map((c) => c.value.activeLeads));
  const candidates = ranked.map(({ value }, index) => ({
    ...value,
    rank: index + 1,
    ...explain(value, minimumLoad),
  }));
  const excluded = exclusionOrder
    .filter((reason) => counts.has(reason))
    .map((reason) => ({ reason, count: counts.get(reason)! }));
  return {
    preferences,
    candidates,
    excluded,
    evaluated: Math.min(rows.length, evaluationLimit),
    truncated: rows.length > evaluationLimit,
    basis: createHash("sha256")
      .update(
        JSON.stringify({
          lead: [lead.id, lead.revision, lead.responsibleId],
          preferences,
          candidates: ranked.map(({ value }) => value),
          excluded,
        }),
      )
      .digest("hex"),
  };
}

// Compact snapshot kept with a decision: identifiers and criteria only, no free text.
function snapshot(matching: Matching) {
  return matching.candidates.slice(0, 10).map((c) => ({
    rank: c.rank,
    userId: c.userId,
    competence: c.competence,
    convention: c.convention,
    language: c.language,
    region: c.region,
    mode: c.mode,
    availability: c.availability,
    capacity: c.capacity,
    referent: c.referent,
    relationship: c.relationship,
    activeLeads: c.activeLeads,
    recentAssignments: c.recentAssignments,
  }));
}

export async function recordMatchingDecision(
  db: Executor,
  decision: {
    leadId: string;
    cycle: number;
    kind: "manual" | "automatic";
    actorId: string | null;
    chosenUserId: string;
    reason: string;
    matching: Matching;
  },
) {
  const chosen = decision.matching.candidates.find((c) => c.userId === decision.chosenUserId);
  const top = decision.matching.candidates[0]?.userId ?? null;
  await db.query(
    `insert into partner_matching_decisions(id,lead_id,cycle,kind,actor_id,system_actor,chosen_user_id,chosen_rank,top_user_id,deviation,reason,basis,ranking,excluded)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      newId("pmatch"),
      decision.leadId,
      decision.cycle,
      decision.kind,
      decision.kind === "manual" ? decision.actorId : null,
      decision.kind === "automatic" ? "partner-continuity-v1" : null,
      decision.chosenUserId,
      chosen?.rank ?? null,
      top,
      decision.kind === "manual" && decision.chosenUserId !== top,
      decision.reason,
      decision.matching.basis,
      JSON.stringify(snapshot(decision.matching)),
      JSON.stringify(decision.matching.excluded),
    ],
  );
}

// Automatic proposals since the last human decision, with everyone already tried in that chain.
export async function automaticChain(db: Executor, leadId: string) {
  const rows = (
    await db.query<{ kind: string; chosen_user_id: string }>(
      "select kind,chosen_user_id from partner_matching_decisions where lead_id=$1 order by created_at desc,id desc limit 20",
      [leadId],
    )
  ).rows;
  const chain: string[] = [];
  for (const row of rows) {
    if (row.kind !== "automatic") break;
    chain.push(row.chosen_user_id);
  }
  return { count: chain.length, tried: chain };
}

async function decisions(db: Executor, leadId: string) {
  return (
    await db.query<{
      id: string;
      kind: "manual" | "automatic";
      chosen_user_id: string;
      chosen_name: string | null;
      chosen_rank: number | null;
      deviation: boolean;
      reason: string;
      created_at: Date;
    }>(
      `select d.*,m.application->>'name' chosen_name from partner_matching_decisions d
      left join partner_members m on m.user_id=d.chosen_user_id
      where d.lead_id=$1 order by d.created_at desc,d.id desc limit 20`,
      [leadId],
    )
  ).rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    chosenUserId: row.chosen_user_id,
    chosenName: row.chosen_name ?? "CoverView",
    chosenRank: row.chosen_rank,
    deviation: row.deviation,
    reason: row.reason,
    createdAt: row.created_at.toISOString(),
  }));
}

export function createMatchingOperations(pool: Pool) {
  return {
    async leadMatching(actor: PartnerActor, id: string) {
      // Ranking reads private professional declarations: CoverView administration only.
      if (!actor.administrator || actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
      const tx: PoolClient = await pool.connect();
      try {
        await tx.query("begin isolation level repeatable read");
        await lockActor(tx, actor);
        const lead = await readMatchingLead(tx, id);
        if (lead.stage === "completed") fail("PARTNER_INVALID_TRANSITION");
        const now = (await tx.query<{ at: Date }>("select transaction_timestamp() at")).rows[0]!.at;
        const matching = await computeMatching(
          tx,
          lead,
          lead.responsibleId ? [lead.responsibleId] : [],
          now,
        );
        const result = leadMatchingSchema.parse({
          leadId: lead.id,
          leadRevision: lead.revision,
          category: lead.category,
          preferences: matching.preferences,
          assessedAt: now.toISOString(),
          basis: matching.basis,
          evaluated: matching.evaluated,
          truncated: matching.truncated,
          candidates: matching.candidates.slice(0, 10),
          excluded: matching.excluded,
          recommendation: matching.candidates.length ? "candidate" : "coverview_queue",
          decisions: await decisions(tx, lead.id),
        });
        await lockActor(tx, actor);
        await tx.query("commit");
        return result;
      } catch (cause) {
        await tx.query("rollback");
        failOnConcurrentAbort(cause);
        throw cause;
      } finally {
        tx.release();
      }
    },
  };
}
