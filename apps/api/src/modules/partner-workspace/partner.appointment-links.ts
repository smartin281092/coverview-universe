import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  appointmentTermsSchema,
  appointmentLinksSelectionSchema,
  appointmentLinksConfirmSchema,
  appointmentUnlinkSchema,
  appointmentLinksManagementSchema,
  appointmentLinksPreviewSchema,
  sharedAppointmentsSchema,
  type AppointmentLinksSelection,
  type AppointmentLinksConfirm,
  type AppointmentUnlink,
  type PartnerApplication,
} from "@coverview/contracts/partner";
import {
  context,
  fail,
  lockActor,
  membership,
  type Executor,
  type PartnerActor,
} from "./partner.policy.js";
import { event, newId } from "./partner.audit.js";
import { readAppointmentPeriod } from "./partner.appointment-assessment.js";
import type { AdviceTarget } from "./partner.advice.js";

type Lead = AdviceTarget & { revision: number };
type ReadLead = (db: Executor, actor: PartnerActor, id: string) => Promise<Lead>;
type Mutation = <T>(
  actor: PartnerActor,
  operation: string,
  key: string,
  input: unknown,
  action: (tx: PoolClient) => Promise<string>,
  project: (tx: PoolClient, id: string) => Promise<T>,
) => Promise<T>;
type Appointment = {
  id: string;
  lead_id: string;
  advisor_id: string;
  starts_at: Date;
  duration_minutes: number;
  mode: string;
  location: string;
  timezone: string;
  state: string;
  link_terms_revision: number;
  occupied_before_minutes: number;
  occupied_after_minutes: number;
};
type Facts = {
  id: string;
  title: string;
  category: string;
  stage: string;
  owner_id: string | null;
  profile_id: string | null;
  profile_revision: number;
  subject_key: string | null;
  personal: boolean;
  basis: unknown;
};
type LinkRow = {
  id: string;
  appointment_id: string;
  source_lead_id: string;
  lead_id: string;
  user_id: string;
  owner_id: string;
  subject_key: string;
  profile_revision: number;
  revision: number;
  terms_revision: number;
  action: "linked" | "unlinked";
  terms: unknown;
  source_basis: string;
  target_basis: string;
  invalidated_at: Date | null;
  recorded_at: Date;
};
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const terms = (a: Appointment) =>
  appointmentTermsSchema.parse({
    startsAt: a.starts_at.toISOString(),
    durationMinutes: a.duration_minutes,
    mode: a.mode,
    location: a.location,
    timezone: a.timezone,
  });
const currentMember = (member: PartnerApplication | null) =>
  !!member &&
  member.state === "approved" &&
  member.organizationState === "approved" &&
  member.grantedRoles.includes("advisor") &&
  (!member.reviewDueAt || Date.parse(member.reviewDueAt) > Date.now());
const eligible = (facts: Facts, member: PartnerApplication | null) =>
  currentMember(member) &&
  facts.personal &&
  !["draft", "completed"].includes(facts.stage) &&
  !!facts.owner_id &&
  !!facts.subject_key &&
  !!member?.categories.some((c) => c === facts.category);
const fingerprint = (facts: Facts, member: PartnerApplication | null) =>
  hash({
    facts: facts.basis,
    professional: member && [member.organizationId, member.revision, member.professionalRevision],
  });

// Internal contextual facts, never a source Lead projection or a fabricated actor/session.
async function facts(db: Executor, id: string, userId: string) {
  const row = (
    await db.query<Facts>(
      `select l.id,l.title,l.category,l.stage,
    coalesce(p.user_id,l.client_user_id) owner_id,l.client_profile_id profile_id,
    coalesce(p.revision,0) profile_revision,
    case when p.id is not null then 'profile:'||p.id when l.client_user_id is not null then 'self:'||l.client_user_id end subject_key,
    (l.responsible_id=$2 or exists(select 1 from partner_contributors c where c.lead_id=l.id
      and c.user_id=$2 and c.revoked_at is null and c.access_scope='advice' and c.can_edit and c.can_contact)) personal,
    jsonb_build_array(l.advice_scope_revision,coalesce(p.user_id,l.client_user_id),l.client_profile_id,
      coalesce(p.revision,0),l.responsible_id,l.assignment,l.notification_cycle,
      (select coalesce(max(revision),0) from partner_advice_preferences where lead_id=l.id),
      (select jsonb_agg(jsonb_build_array(c.id,c.collaboration_id,c.access_scope,c.can_edit,c.can_contact) order by c.id)
        from partner_contributors c where c.lead_id=l.id and c.user_id=$2 and c.revoked_at is null),
      (select jsonb_build_array(n.id,n.resolved_at) from partner_notifications n where n.lead_id=l.id
        and n.kind='interlocutor_request' order by n.created_at desc,n.id desc limit 1)) basis
    from partner_leads l left join managed_profiles p on p.id=l.client_profile_id where l.id=$1`,
      [id, userId],
    )
  ).rows[0];
  if (!row) return fail("PARTNER_NOT_FOUND", 404);
  return row;
}
async function appointment(db: Executor, id: string) {
  const row = (await db.query<Appointment>("select * from partner_appointments where id=$1", [id]))
    .rows[0];
  if (!row) return fail("PARTNER_NOT_FOUND", 404);
  return row;
}
async function latest(db: Executor, appointmentId: string, leadId: string) {
  return (
    await db.query<LinkRow>(
      `select * from partner_appointment_links where appointment_id=$1
    and lead_id=$2 order by revision desc limit 1`,
      [appointmentId, leadId],
    )
  ).rows[0];
}
async function state(db: Executor, row: LinkRow) {
  if ((await latest(db, row.appointment_id, row.lead_id))?.revision !== row.revision)
    return "superseded" as const;
  if (row.action === "unlinked") return "unlinked" as const;
  if (row.invalidated_at) return "review_required" as const;
  const appt = await appointment(db, row.appointment_id),
    member = await membership(db, row.user_id);
  const source = await facts(db, row.source_lead_id, row.user_id),
    target = await facts(db, row.lead_id, row.user_id);
  return appt.lead_id === row.source_lead_id &&
    appt.advisor_id === row.user_id &&
    appt.link_terms_revision === row.terms_revision &&
    eligible(source, member) &&
    eligible(target, member) &&
    source.subject_key === row.subject_key &&
    target.subject_key === row.subject_key &&
    fingerprint(source, member) === row.source_basis &&
    fingerprint(target, member) === row.target_basis
    ? ("linked" as const)
    : ("review_required" as const);
}
async function lockSubject(db: Executor, lead: Facts) {
  if (lead.profile_id)
    await db.query("select id from managed_profiles where id=$1 for share", [lead.profile_id]);
  else if (lead.owner_id)
    await db.query("select id from identity_profiles where user_id=$1 for share", [lead.owner_id]);
}

export function createAppointmentLinkOperations(pool: Pool, transaction: Mutation, read: ReadLead) {
  async function reading<T>(actor: PartnerActor, action: (tx: PoolClient) => Promise<T>) {
    const tx = await pool.connect();
    try {
      await tx.query("begin");
      await lockActor(tx, actor);
      const result = await action(tx);
      await lockActor(tx, actor);
      await tx.query("commit");
      return result;
    } catch (error) {
      await tx.query("rollback");
      throw error;
    } finally {
      tx.release();
    }
  }
  async function locked(
    tx: PoolClient,
    actor: PartnerActor,
    sourceId: string,
    appointmentId: string,
    targets: string[],
  ) {
    if (actor.wallet || targets.includes(sourceId)) fail("PARTNER_ACCESS_DENIED", 403);
    await lockActor(tx, actor);
    await membership(tx, actor.userId, true);
    const ids = [...new Set([sourceId, ...targets])].sort();
    await tx.query("select id from partner_leads where id=any($1::text[]) order by id for update", [
      ids,
    ]);
    await tx.query("select id from partner_appointments where id=$1 for update", [appointmentId]);
    await tx.query("select pg_advisory_xact_lock(hashtextextended($1,1))", [actor.userId]);
    const before = await facts(tx, sourceId, actor.userId);
    await lockSubject(tx, before);
    // READ COMMITTED joins can predate a waited-on lock. Re-read all authorization and canonical
    // facts after the last wait, including wall-clock session/MFA/professional expiration.
    await lockActor(tx, actor);
    const ctx = await context(tx, actor),
      appt = await appointment(tx, appointmentId);
    if (appt.lead_id !== sourceId || appt.advisor_id !== actor.userId)
      fail("PARTNER_NOT_FOUND", 404);
    const leads: Lead[] = [],
      contexts: Facts[] = [];
    for (const id of ids) {
      const lead = await read(tx, actor, id),
        current = await facts(tx, id, actor.userId);
      if (!eligible(current, ctx.application)) fail("PARTNER_ACCESS_DENIED", 403);
      if (
        current.subject_key !== before.subject_key ||
        current.owner_id !== before.owner_id ||
        current.profile_revision !== before.profile_revision
      )
        fail("PARTNER_INVALID_CLIENT");
      leads.push(lead);
      contexts.push(current);
    }
    return { ctx, appt, leads, contexts, source: contexts.find((c) => c.id === sourceId)! };
  }
  async function management(
    tx: PoolClient,
    actor: PartnerActor,
    sourceId: string,
    appointmentId: string,
  ) {
    const scope = await locked(tx, actor, sourceId, appointmentId, []);
    const candidates = (
      await tx.query<{ id: string }>(
        `select l.id from partner_leads l
      left join managed_profiles p on p.id=l.client_profile_id where l.id<>$1 and l.stage not in ('draft','completed')
      and coalesce(p.user_id,l.client_user_id)=$2 and l.client_profile_id is not distinct from $3
      and l.category=any($4::text[]) and (l.responsible_id=$5 or exists(select 1 from partner_contributors c
        where c.lead_id=l.id and c.user_id=$5 and c.revoked_at is null and c.access_scope='advice' and c.can_edit and c.can_contact))
      order by l.id limit 51`,
        [
          sourceId,
          scope.source.owner_id,
          scope.source.profile_id,
          scope.ctx.application!.categories,
          actor.userId,
        ],
      )
    ).rows;
    const items = [];
    for (const { id } of candidates.slice(0, 50)) {
      const current = await facts(tx, id, actor.userId);
      if (
        !eligible(current, scope.ctx.application) ||
        current.subject_key !== scope.source.subject_key
      )
        continue;
      const previous = await latest(tx, appointmentId, id);
      items.push({
        id,
        title: current.title,
        revision: previous?.revision ?? 0,
        status: previous ? await state(tx, previous) : null,
      });
    }
    return appointmentLinksManagementSchema.parse({
      appointment: terms(scope.appt),
      canLink: scope.appt.state === "scheduled" && scope.appt.starts_at.getTime() > Date.now(),
      candidates: items,
      candidatesTruncated: candidates.length > 50,
    });
  }
  async function preview(
    tx: PoolClient,
    actor: PartnerActor,
    sourceId: string,
    appointmentId: string,
    input: AppointmentLinksSelection,
  ) {
    const scope = await locked(tx, actor, sourceId, appointmentId, input.leadIds),
      readings = [];
    const versions: { id: string; revision: number; status: string | null }[] = [];
    for (const lead of scope.leads) {
      const assessment = await readAppointmentPeriod(
        tx,
        actor,
        lead,
        appointmentId,
        scope.appt,
        scope.ctx,
        true,
        lead.revision,
      );
      readings.push({ id: lead.id, title: lead.title, assessment });
      if (lead.id !== sourceId) {
        const previous = await latest(tx, appointmentId, lead.id);
        versions.push({
          id: lead.id,
          revision: previous?.revision ?? 0,
          status: previous ? await state(tx, previous) : null,
        });
      }
    }
    const records = (
      await tx.query<LinkRow>(
        `select distinct on (lead_id) * from partner_appointment_links where appointment_id=$1
      order by lead_id,revision desc limit 1001`,
        [appointmentId],
      )
    ).rows;
    if (records.length > 1000) fail("PARTNER_ACTION_REQUIRED");
    const active: string[] = [];
    for (const record of records)
      if ((await state(tx, record)) === "linked") active.push(record.lead_id);
    const count = new Set([...active, ...input.leadIds]).size;
    await lockActor(tx, actor);
    if (!currentMember(await membership(tx, actor.userId))) fail("PARTNER_ACCESS_DENIED", 403);
    const result = appointmentLinksPreviewSchema.parse({
      appointment: terms(scope.appt),
      targets: readings
        .filter((r) => r.id !== sourceId)
        .map((r) => ({ id: r.id, title: r.title, assessment: r.assessment.status })),
      basis: hash({
        actor: actor.userId,
        appointment: scope.appt,
        contexts: scope.contexts.map((c) => fingerprint(c, scope.ctx.application)),
        assessments: readings.map((r) => r.assessment.timeProtection!.basis),
        versions,
        count,
      }),
      canConfirm:
        count <= 9 &&
        scope.appt.state === "scheduled" &&
        scope.appt.starts_at.getTime() > Date.now() &&
        readings.every(
          (r) => r.assessment.status === "consistent" && !!r.assessment.timeProtection?.current,
        ) &&
        versions.every((r) => r.status !== "linked"),
    });
    return { result, scope, versions };
  }
  return {
    appointmentLinks: (actor: PartnerActor, sourceId: string, appointmentId: string) =>
      reading(actor, (tx) => management(tx, actor, sourceId, appointmentId)),
    previewAppointmentLinks: (
      actor: PartnerActor,
      sourceId: string,
      appointmentId: string,
      raw: AppointmentLinksSelection,
    ) => {
      const input = appointmentLinksSelectionSchema.parse(raw);
      return reading(
        actor,
        async (tx) => (await preview(tx, actor, sourceId, appointmentId, input)).result,
      );
    },
    confirmAppointmentLinks(
      actor: PartnerActor,
      sourceId: string,
      appointmentId: string,
      raw: AppointmentLinksConfirm,
      key: string,
    ) {
      const input = appointmentLinksConfirmSchema.parse(raw);
      return transaction(
        actor,
        `appointment-links:${sourceId}:${appointmentId}`,
        key,
        input,
        async (tx) => {
          const { result, scope, versions } = await preview(
            tx,
            actor,
            sourceId,
            appointmentId,
            input,
          );
          if (result.basis !== input.basis) fail("PARTNER_CONFLICT", 409);
          if (!result.canConfirm) fail("PARTNER_ACTION_REQUIRED");
          for (const version of versions) {
            const id = newId("palink"),
              target = scope.contexts.find((c) => c.id === version.id)!;
            await tx.query(
              `insert into partner_appointment_links(id,appointment_id,source_lead_id,lead_id,user_id,
            owner_id,subject_key,profile_revision,revision,terms_revision,action,terms,source_basis,target_basis,evidence)
            values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'linked',$11,$12,$13,$14)`,
              [
                id,
                appointmentId,
                sourceId,
                version.id,
                actor.userId,
                target.owner_id,
                target.subject_key,
                target.profile_revision,
                version.revision + 1,
                scope.appt.link_terms_revision,
                JSON.stringify(result.appointment),
                fingerprint(scope.source, scope.ctx.application),
                fingerprint(target, scope.ctx.application),
                JSON.stringify(input),
              ],
            );
            await event(tx, actor, null, "appointment.linked.v1", "", "private", id);
          }
          return appointmentId;
        },
        async (tx) => {
          await locked(tx, actor, sourceId, appointmentId, input.leadIds);
          return management(tx, actor, sourceId, appointmentId);
        },
      );
    },
    unlinkAppointment(
      actor: PartnerActor,
      sourceId: string,
      appointmentId: string,
      raw: AppointmentUnlink,
      key: string,
    ) {
      const input = appointmentUnlinkSchema.parse(raw);
      return transaction(
        actor,
        `appointment-unlink:${sourceId}:${appointmentId}`,
        key,
        input,
        async (tx) => {
          await locked(tx, actor, sourceId, appointmentId, [input.leadId]);
          const previous = await latest(tx, appointmentId, input.leadId);
          if (!previous || previous.revision !== input.revision || previous.action !== "linked")
            fail("PARTNER_CONFLICT", 409);
          const id = newId("palink");
          await tx.query(
            `insert into partner_appointment_links(id,appointment_id,source_lead_id,lead_id,user_id,owner_id,
          subject_key,profile_revision,revision,terms_revision,action,terms,source_basis,target_basis,evidence)
          select $1,appointment_id,source_lead_id,lead_id,$2,owner_id,subject_key,profile_revision,revision+1,
            terms_revision,'unlinked',terms,source_basis,target_basis,$3 from partner_appointment_links where id=$4`,
            [id, actor.userId, JSON.stringify(input), previous.id],
          );
          await event(tx, actor, null, "appointment.unlinked.v1", "", "private", id);
          return appointmentId;
        },
        async (tx) => {
          await locked(tx, actor, sourceId, appointmentId, [input.leadId]);
          return management(tx, actor, sourceId, appointmentId);
        },
      );
    },
    sharedAppointments(actor: PartnerActor, leadId: string) {
      return reading(actor, async (tx) => {
        await context(tx, actor, true);
        await tx.query("select id from partner_leads where id=$1 for share", [leadId]);
        await read(tx, actor, leadId);
        await lockSubject(tx, await facts(tx, leadId, actor.userId));
        await lockActor(tx, actor);
        if (!actor.wallet && !(await context(tx, actor)).operational)
          fail("PARTNER_ACCESS_DENIED", 403);
        await read(tx, actor, leadId);
        const target = await facts(tx, leadId, actor.userId);
        const parameters = [leadId, target.subject_key, target.owner_id, target.profile_revision];
        const predicate = "lead_id=$1 and subject_key=$2 and owner_id=$3 and profile_revision=$4";
        const rows = (
          await tx.query<LinkRow>(
            `select distinct on (appointment_id) * from partner_appointment_links
          where ${predicate} order by appointment_id,revision desc limit 101`,
            parameters,
          )
        ).rows;
        const history = (
          await tx.query<LinkRow>(
            `select * from partner_appointment_links where ${predicate}
          order by recorded_at desc,id desc limit 21`,
            parameters,
          )
        ).rows;
        async function project(row: LinkRow) {
          const status = await state(tx, row);
          return {
            id: row.id,
            revision: row.revision,
            status,
            recordedAt: row.recorded_at.toISOString(),
            appointment: row.terms,
            outcome: status === "linked" ? (await appointment(tx, row.appointment_id)).state : null,
          };
        }
        const items = [],
          versions = [];
        for (const row of rows.slice(0, 100)) items.push(await project(row));
        for (const row of history.slice(0, 20)) versions.push(await project(row));
        return sharedAppointmentsSchema.parse({
          items,
          history: versions,
          itemsTruncated: rows.length > 100,
          historyTruncated: history.length > 20,
        });
      });
    },
  };
}
