import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import {
  commercialTermsSchema,
  marketMissionSchema,
  economyCaseInputSchema,
  economyEntryInputSchema,
  economyRecordSchema,
  economyCaseSchema,
  economyCasesSchema,
  economyAgreementsSchema,
  type EconomyRecord,
} from "@coverview/contracts/partner-economy";
import {
  fail,
  membership,
  contextForApplication,
  visible,
  type PartnerActor,
} from "./partner.policy.js";
import {
  economyRead,
  economyCursor,
  economyNext,
  type EconomyMutation,
} from "./partner.commercial.js";
import { calculateEconomy, economyNet } from "./partner.economy-calculation.js";
import { event, newId } from "./partner.audit.js";
type Agreement = {
  id: string;
  lead_id: string;
  publisher_id: string;
  target_id: string;
  target_name: string;
  target_organization_id: string;
  target_revision: number;
  decided_at: Date;
  created_at: Date;
  mission: unknown;
  terms: unknown;
  declared_name: string;
  organization_id: string;
  professional_revision: number;
};
const agreementSql = `select r.*,c.terms,c.declared_name,c.organization_id,c.professional_revision from partner_market_reservations r join partner_commercial_conditions c on c.id=r.condition_id`;
async function agreement(tx: PoolClient, actor: PartnerActor, id: string) {
  if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
  const row = (
    await tx.query<Agreement>(`${agreementSql} where r.id=$1 and r.state='accepted'`, [id])
  ).rows[0];
  if (
    !row ||
    (!actor.administrator &&
      row.publisher_id !== actor.userId &&
      row.target_id !== actor.userId &&
      !commercialTermsSchema.parse(row.terms).contributors.some((c) => c.userId === actor.userId))
  )
    fail("PARTNER_NOT_FOUND", 404);
  return row;
}
type CaseRow = {
  id: string;
  agreement_id: string;
  stream: "lead_price" | "contract_commission";
  final_policy_id: string | null;
  company_id: string | null;
  reference: string;
  scope_reference: string;
  created_at: Date;
};
type EntryRow = {
  id: string;
  revision: number;
  author_id: string;
  entry: unknown;
  created_at: Date;
};
async function caseData(tx: PoolClient, actor: PartnerActor, id: string) {
  const row = (
    await tx.query<CaseRow>("select * from partner_economy_cases where id=$1 for update", [id])
  ).rows[0];
  if (!row) fail("PARTNER_NOT_FOUND", 404);
  const accepted = await agreement(tx, actor, row.agreement_id),
    terms = commercialTermsSchema.parse(accepted.terms);
  if (
    row.stream === "lead_price" &&
    !actor.administrator &&
    actor.userId !== accepted.publisher_id &&
    actor.userId !== accepted.target_id
  )
    fail("PARTNER_NOT_FOUND", 404);
  const entries = (
    await tx.query<EntryRow>(
      "select * from partner_economy_entries where case_id=$1 order by revision limit 1001",
      [id],
    )
  ).rows;
  if (entries.length > 1000) fail("PARTNER_ACTION_REQUIRED");
  const ids = [
    accepted.publisher_id,
    accepted.target_id,
    ...terms.contributors.map((c) => c.userId),
  ];
  const members = (
    await tx.query<{ user_id: string; name: string }>(
      "select user_id,application->>'name' name from partner_members where user_id=any($1::text[])",
      [ids],
    )
  ).rows;
  const names = new Map(members.map((m) => [m.user_id, m.name]));
  names.set("coverview", "CoverView");
  names.set(accepted.publisher_id, accepted.declared_name);
  names.set(accepted.target_id, accepted.target_name);
  const postings = entries.map((e) => ({
    id: e.id,
    revision: e.revision,
    entry: economyEntryInputSchema.parse(e.entry),
  }));
  const calculated = calculateEconomy(
    terms,
    accepted.publisher_id,
    accepted.target_id,
    row.stream === "lead_price",
    postings,
    names,
  );
  const collector = row.stream === "lead_price" ? "supplier" : terms.collector;
  const collectorId =
    collector === "supplier"
      ? accepted.publisher_id
      : collector === "receiver"
        ? accepted.target_id
        : null;
  const member = collectorId === actor.userId ? await membership(tx, actor.userId, true) : null;
  const canRecord =
    actor.administrator ||
    !!(
      member &&
      contextForApplication(member).operational &&
      member.organizationId ===
        (collector === "supplier" ? accepted.organization_id : accepted.target_organization_id) &&
      member.professionalRevision ===
        (collector === "supplier" ? accepted.professional_revision : accepted.target_revision)
    );
  const ownOnly =
    !actor.administrator &&
    actor.userId !== accepted.publisher_id &&
    actor.userId !== accepted.target_id;
  return {
    row,
    accepted,
    terms,
    entries,
    postings,
    calculated,
    collector,
    collectorId,
    canRecord,
    ownOnly,
  };
}
async function project(tx: PoolClient, actor: PartnerActor, id: string, cursor?: string) {
  const v = await caseData(tx, actor, id),
    [at, after] = economyCursor(cursor);
  const history = v.entries
    .filter(
      (e) =>
        !v.ownOnly ||
        ("beneficiary" in economyEntryInputSchema.parse(e.entry) &&
          z.object({ beneficiary: z.string() }).parse(e.entry).beneficiary === actor.userId),
    )
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id))
    .filter(
      (e) =>
        !at ||
        e.created_at.toISOString() < at ||
        (e.created_at.toISOString() === at && e.id < (after ?? "")),
    )
    .slice(0, 21);
  const own = v.calculated.balances.find((b) => b.beneficiary === actor.userId);
  return economyCaseSchema.parse({
    id,
    agreementId: v.row.agreement_id,
    stream: v.row.stream,
    reference: v.ownOnly ? id : v.row.reference,
    scopeReference: v.ownOnly
      ? v.terms.contributors.find((c) => c.userId === actor.userId)!.basisReference
      : v.row.scope_reference,
    finalPolicyId: v.ownOnly ? null : v.row.final_policy_id,
    companyId: v.ownOnly ? null : v.row.company_id,
    createdAt: v.row.created_at.toISOString(),
    collector: v.collector,
    currency: "CHF",
    revision: v.entries.at(-1)?.revision ?? 0,
    estimate: v.ownOnly ? null : v.calculated.estimate,
    confirmedMinor: v.ownOnly ? (own?.confirmedMinor ?? null) : v.calculated.confirmedMinor,
    receivedMinor: v.ownOnly ? (own?.receivedMinor ?? 0) : v.calculated.receivedMinor,
    balances: v.ownOnly ? (own ? [own] : []) : v.calculated.balances,
    reconciliation: v.ownOnly ? null : v.calculated.reconciliation,
    canRecord: v.canRecord && !v.ownOnly,
    terms: v.ownOnly ? null : v.terms,
    ownOnly: v.ownOnly,
    history: history.slice(0, 20).map((e) => ({
      id: e.id,
      revision: e.revision,
      authorId: e.author_id,
      createdAt: e.created_at.toISOString(),
      entry: economyEntryInputSchema.parse(e.entry),
      reversed: v.calculated.reversed.has(e.id),
    })),
    nextCursor: history.length > 20 ? economyNext(history[19]!) : null,
  });
}
export function createEconomyOperations(pool: Pool, mutate: EconomyMutation) {
  return {
    economyCase: (actor: PartnerActor, id: string, cursor?: string) =>
      economyRead(pool, actor, (tx) => project(tx, actor, id, cursor)),
    async economyAgreements(actor: PartnerActor, cursor?: string) {
      return economyRead(pool, actor, async (tx) => {
        if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
        const [at, id] = economyCursor(cursor);
        const rows = (
          await tx.query<Agreement>(
            `${agreementSql} where r.state='accepted' and (r.publisher_id=$1 or r.target_id=$1 or $2) and ($3::timestamptz is null or (r.created_at,r.id)<($3,$4)) order by r.created_at desc,r.id desc limit 21`,
            [actor.userId, actor.administrator, at, id],
          )
        ).rows;
        const items = [];
        for (const r of rows.slice(0, 20)) {
          const lead = (
            await tx.query<{ id: string }>(
              `select l.id from partner_leads l where l.id=$2 and (${visible(actor)})`,
              [actor.userId, r.lead_id],
            )
          ).rows[0];
          items.push({
            id: r.id,
            leadId: lead ? r.lead_id : null,
            acceptedAt: r.decided_at.toISOString(),
            supplierName: r.declared_name,
            receiverName: r.target_name,
            terms: commercialTermsSchema.parse(r.terms),
            mission: marketMissionSchema.parse(r.mission),
          });
        }
        return economyAgreementsSchema.parse({
          items,
          nextCursor: rows.length > 20 ? economyNext(rows[19]!) : null,
        });
      });
    },
    async economyCases(actor: PartnerActor, cursor?: string) {
      return economyRead(pool, actor, async (tx) => {
        if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
        const [at, id] = economyCursor(cursor);
        const rows = (
          await tx.query<{ id: string; created_at: Date }>(
            "select c.id,c.created_at from partner_economy_cases c join partner_market_reservations r on r.id=c.agreement_id join partner_commercial_conditions t on t.id=r.condition_id where (r.publisher_id=$1 or r.target_id=$1 or $2 or (c.stream='contract_commission' and t.terms->'contributors' @> jsonb_build_array(jsonb_build_object('userId',$1::text)))) and ($3::timestamptz is null or (c.created_at,c.id)<($3,$4)) order by c.created_at desc,c.id desc limit 21",
            [actor.userId, actor.administrator, at, id],
          )
        ).rows;
        const items = [];
        for (const r of rows.slice(0, 20)) items.push(await project(tx, actor, r.id));
        return economyCasesSchema.parse({
          items,
          nextCursor: rows.length > 20 ? economyNext(rows[19]!) : null,
        });
      });
    },
    async createEconomyCase(
      actor: PartnerActor,
      raw: z.infer<typeof economyCaseInputSchema>,
      key: string,
    ) {
      const input = economyCaseInputSchema.parse(raw);
      return mutate(
        actor,
        "economy.case_created.v1",
        key,
        input,
        async (tx) => {
          const accepted = await agreement(tx, actor, input.agreementId),
            terms = commercialTermsSchema.parse(accepted.terms);
          if (!actor.administrator) fail("PARTNER_ACCESS_DENIED", 403);
          if (input.stream === "lead_price" && terms.supplier.model !== "fixed")
            fail("PARTNER_ACTION_REQUIRED");
          if (input.finalPolicyId) {
            const policy = await tx.query(
              "select id from partner_final_policies where id=$1 and lead_id=$2 and active and source_snapshot#>>'{candidate,facts,companyId}'=$3 for share",
              [input.finalPolicyId, accepted.lead_id, input.companyId],
            );
            if (!policy.rowCount || !terms.companies.some((c) => c === input.companyId))
              fail("PARTNER_ACTION_REQUIRED");
          }
          const id = newId("pecase");
          await tx.query(
            "insert into partner_economy_cases(id,agreement_id,stream,final_policy_id,company_id,reference,scope_reference,author_id) values($1,$2,$3,$4,$5,$6,$7,$8)",
            [
              id,
              input.agreementId,
              input.stream,
              input.finalPolicyId,
              input.companyId,
              input.reference,
              input.scopeReference,
              actor.userId,
            ],
          );
          await event(tx, actor, null, "economy.case_created.v1", "", "private", id);
          return id;
        },
        (tx, id) => project(tx, actor, id),
      );
    },
    async recordEconomy(actor: PartnerActor, id: string, raw: EconomyRecord, key: string) {
      const input = economyRecordSchema.parse(raw);
      let created = false;
      return mutate(
        actor,
        "economy.recorded.v1",
        key,
        { id, input },
        async (tx) => {
          const value = await caseData(tx, actor, id),
            entry = input.entry;
          if (
            !value.canRecord ||
            (!actor.administrator &&
              !["receive", "pay", "recover", "refund", "reconcile"].includes(entry.kind))
          )
            fail("PARTNER_ACCESS_DENIED", 403);
          if (
            (value.entries.at(-1)?.revision ?? 0) !== input.revision ||
            value.entries.length >= 1000
          )
            fail("PARTNER_CONFLICT", 409);
          if (Date.parse(entry.proof.occurredAt) > Date.now()) fail("PARTNER_ACTION_REQUIRED");
          if (entry.kind === "receive") {
            if (value.calculated.confirmedMinor === null) fail("PARTNER_ACTION_REQUIRED");
            economyNet(
              entry.grossMinor,
              entry.deductions,
              value.terms,
              value.row.stream === "lead_price",
            );
            const collector = value.collectorId ?? "coverview";
            await tx.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
              JSON.stringify([collector, entry.statementReference, entry.settlementReference]),
            ]);
            const duplicate = await tx.query(
              `select e.id from partner_economy_entries e join partner_economy_cases c on c.id=e.case_id join partner_market_reservations r on r.id=c.agreement_id join partner_commercial_conditions t on t.id=r.condition_id
            where e.entry->>'kind'='receive' and e.entry->>'statementReference'=$1 and e.entry->>'settlementReference'=$2 and (case when c.stream='lead_price' then r.publisher_id when t.terms->>'collector'='receiver' then r.target_id else 'coverview' end)=$3
            and not exists(select 1 from partner_economy_entries reversal where reversal.case_id=c.id and reversal.entry->>'kind'='reverse' and reversal.entry->>'entryId'=e.id) limit 1`,
              [entry.statementReference, entry.settlementReference, collector],
            );
            if (duplicate.rowCount) fail("PARTNER_CONFLICT", 409);
          }
          if ("beneficiary" in entry) {
            const balance = value.calculated.balances.find(
              (b) => b.beneficiary === entry.beneficiary,
            );
            if (!balance) fail("PARTNER_ACTION_REQUIRED");
            if (
              value.row.stream === "lead_price" &&
              ["reserve", "release", "pay"].includes(entry.kind)
            )
              fail("PARTNER_ACTION_REQUIRED");
            if (
              ["reserve", "pay", "dispute"].includes(entry.kind) &&
              entry.amountMinor > balance.availableMinor
            )
              fail("PARTNER_ACTION_REQUIRED");
            if (entry.kind === "release" && entry.amountMinor > balance.reservedMinor)
              fail("PARTNER_ACTION_REQUIRED");
            if (entry.kind === "resolve_dispute" && entry.amountMinor > balance.disputedMinor)
              fail("PARTNER_ACTION_REQUIRED");
            if (
              entry.kind === "recover" &&
              entry.amountMinor >
                Math.min(balance.recoveryDueMinor, balance.paidMinor - balance.recoveredMinor)
            )
              fail("PARTNER_ACTION_REQUIRED");
            if (
              entry.kind === "clawback" &&
              (balance.confirmedMinor === null ||
                entry.amountMinor > balance.confirmedMinor - balance.clawbackMinor)
            )
              fail("PARTNER_ACTION_REQUIRED");
            if (
              entry.kind === "refund" &&
              entry.amountMinor > balance.paidMinor - balance.recoveredMinor
            )
              fail("PARTNER_ACTION_REQUIRED");
          }
          const entryId = newId("pevent");
          calculateEconomy(
            value.terms,
            value.accepted.publisher_id,
            value.accepted.target_id,
            value.row.stream === "lead_price",
            [...value.postings, { id: entryId, revision: input.revision + 1, entry }],
          );
          await tx.query(
            "insert into partner_economy_entries(id,case_id,revision,author_id,entry) values($1,$2,$3,$4,$5)",
            [entryId, id, input.revision + 1, actor.userId, JSON.stringify(entry)],
          );
          await event(tx, actor, null, "economy.recorded.v1", "", "private", id);
          created = true;
          return id;
        },
        async (tx, target) => {
          const result = await project(tx, actor, target);
          if (created && !result.canRecord) fail("PARTNER_ACCESS_DENIED", 403);
          return result;
        },
      );
    },
  };
}
