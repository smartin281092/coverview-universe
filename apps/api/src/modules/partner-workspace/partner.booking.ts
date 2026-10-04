import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  bookingProposalInputSchema,
  bookingChoiceSchema,
  bookingProposalsSchema,
  bookingWithdrawalSchema,
  coordinatedBookingInputSchema,
  coordinatedBookingReceiptSchema,
  type CoordinatedBookingInput,
  type BookingProposalInput,
  type BookingChoice,
  type PartnerApplication,
} from "@coverview/contracts/partner";
import {
  authorityCurrent,
  camel,
  contextForApplication,
  fail,
  lockActor,
  membership,
  ownedClient,
  type PartnerActor,
  failOnConcurrentAbort,
} from "./partner.policy.js";
import type { partnerLeads } from "./partner.schema.js";
import { previewPersonalAppointment } from "./partner.appointment-creation.js";
import { recordAppointmentTime } from "./partner.appointment-time.js";
import { executeLeadCommand } from "./partner.commands.js";
import { event, newId } from "./partner.audit.js";
import { syncLeadNotifications } from "./partner.notifications.js";

type Mutation = <T>(
  actor: PartnerActor,
  operation: string,
  key: string,
  input: unknown,
  action: (tx: PoolClient) => Promise<string>,
  project: (tx: PoolClient, id: string) => Promise<T>,
) => Promise<T>;
type Lead = typeof partnerLeads.$inferSelect & {
  ownerId: string | null;
  profileRevision: number;
  personal: boolean;
};
type Proposal = {
  id: string;
  lead_id: string;
  advisor_id: string;
  advisor_name: string;
  subject_key: string;
  owner_id: string;
  fingerprint: string;
  input: unknown;
  expires_at: Date;
  state: "offered" | "booked" | "withdrawn";
  invalidated_at: Date | null;
  appointment_id: string | null;
  selected_slot: number | null;
};
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const subjectKey = (lead: Lead) =>
  lead.clientProfileId ? `profile:${lead.clientProfileId}` : `self:${lead.ownerId}`;
const personal = `((l.responsible_id=$3 and ${authorityCurrent("l")}) and l.assignment='accepted' or exists(select 1 from partner_contributors c where c.lead_id=l.id and c.user_id=$3 and c.revoked_at is null and ${authorityCurrent("c")} and c.access_scope='advice' and c.can_edit and c.can_contact))`;

async function readLead(tx: PoolClient, actor: PartnerActor, id: string, advisorId: string | null) {
  const row = (
    await tx.query<Record<string, unknown>>(
      `select l.*,
    case when l.client_profile_id is null then l.client_user_id else p.user_id end owner_id,
    case when l.client_profile_id is null then coalesce(ip.revision,0) else p.revision end profile_revision,
    ${personal} personal
    from partner_leads l left join managed_profiles p on p.id=l.client_profile_id
    left join identity_profiles ip on ip.user_id=l.client_user_id
    where l.id=$2 and $1::text is not null and (${actor.wallet ? ownedClient : personal})`,
      [actor.userId, id, advisorId],
    )
  ).rows[0];
  if (!row) return fail("PARTNER_NOT_FOUND", 404);
  return camel<Lead>(row);
}
function eligible(lead: Lead, member: PartnerApplication | null) {
  return !!(
    lead.personal &&
    lead.ownerId &&
    !["draft", "completed"].includes(lead.stage) &&
    contextForApplication(member).canAdvise &&
    member?.categories.some((c) => c === lead.category)
  );
}
function fingerprint(lead: Lead, member: PartnerApplication | null) {
  return hash({
    lead: [
      lead.id,
      lead.revision,
      lead.adviceScopeRevision,
      lead.ownerId,
      lead.clientProfileId,
      lead.profileRevision,
    ],
    member: member && [
      member.userId,
      member.organizationId,
      member.revision,
      member.professionalRevision,
    ],
  });
}

// Membership → Lead → proposal → planning → canonical profile, then fresh authorization/clock.
// No fabricated professional session: Wallet stays the authenticated actor in all reads and audit.
async function locked(tx: PoolClient, actor: PartnerActor, id: string, proposalId?: string) {
  await lockActor(tx, actor);
  const seed = (
    await tx.query<Proposal>(
      `select b.* from partner_booking_proposals b
    join partner_leads l on l.id=b.lead_id where b.lead_id=$2 and (${actor.wallet ? ownedClient : "b.advisor_id=$1"})
    and ${proposalId ? "b.id=$3" : "b.state='offered' and b.invalidated_at is null"}
    order by b.created_at desc,b.id desc limit 1`,
      proposalId ? [actor.userId, id, proposalId] : [actor.userId, id],
    )
  ).rows[0];
  if (proposalId && !seed) fail("PARTNER_NOT_FOUND", 404);
  const advisorId = actor.wallet ? (seed?.advisor_id ?? null) : actor.userId;
  const member = advisorId ? await membership(tx, advisorId, true) : null;
  await readLead(tx, actor, id, advisorId);
  await tx.query("select id from partner_leads where id=$1 for update", [id]);
  if (advisorId)
    await tx.query(
      "select id from partner_contributors where lead_id=$1 and user_id=$2 for share",
      [id, advisorId],
    );
  const rows = (
    await tx.query<Proposal>(
      `select * from partner_booking_proposals where lead_id=$1
    ${actor.wallet ? "" : "and advisor_id=$2"} order by created_at desc,id desc limit 20 for update`,
      actor.wallet ? [id] : [id, actor.userId],
    )
  ).rows;
  const active = rows.find((r) => r.state === "offered" && !r.invalidated_at);
  // A newly published proposal may have appeared while waiting for the Lead. Retry with its author locked.
  if (actor.wallet && active && active.advisor_id !== advisorId) fail("PARTNER_CONFLICT", 409);
  if (advisorId)
    await tx.query("select pg_advisory_xact_lock(hashtextextended($1,1))", [advisorId]);
  const before = await readLead(tx, actor, id, advisorId);
  if (before.clientProfileId)
    await tx.query("select id from managed_profiles where id=$1 for share", [
      before.clientProfileId,
    ]);
  else
    await tx.query("select user_id from identity_profiles where user_id=$1 for share", [
      before.ownerId,
    ]);
  await lockActor(tx, actor);
  const lead = await readLead(tx, actor, id, advisorId);
  if (!actor.wallet && !eligible(lead, member)) fail("PARTNER_ACCESS_DENIED", 403);
  return { lead, member, advisorId, rows };
}
type Locked = Awaited<ReturnType<typeof locked>>;
async function inspect(tx: PoolClient, actor: PartnerActor, data: Locked, row: Proposal) {
  const input = bookingProposalInputSchema.parse(row.input);
  const current =
    row.advisor_id === data.advisorId &&
    eligible(data.lead, data.member) &&
    row.fingerprint === fingerprint(data.lead, data.member);
  const state =
    row.state !== "offered"
      ? row.state
      : row.expires_at.getTime() <= Date.now()
        ? "expired"
        : row.invalidated_at || !current
          ? "invalidated"
          : "offered";
  const slots = [];
  for (const slot of input.slots) {
    const preview =
      state === "offered"
        ? await previewPersonalAppointment(
            tx,
            actor,
            { ...data.lead, clientUserId: data.lead.ownerId },
            contextForApplication(data.member),
            { appointment: slot.appointment, time: slot.time },
            undefined,
            row.advisor_id,
          )
        : null;
    slots.push({
      appointment: slot.appointment,
      canBook: !!(actor.wallet && preview?.canConfirm && preview.basis === slot.basis),
      basis: hash({
        proposal: row.id,
        slot,
        fingerprint: row.fingerprint,
        client: data.lead.ownerId,
        expiresAt: row.expires_at,
      }),
    });
  }
  return {
    id: row.id,
    advisorName: row.advisor_name,
    expiresAt: row.expires_at.toISOString(),
    state,
    appointmentId: row.appointment_id,
    selectedSlot: row.selected_slot,
    canWithdraw: !actor.wallet && row.state === "offered" && !row.invalidated_at,
    slots,
  };
}
async function project(tx: PoolClient, actor: PartnerActor, id: string) {
  const data = await locked(tx, actor, id);
  const proposals = [];
  for (const row of data.rows)
    if (
      !actor.wallet ||
      (row.subject_key === subjectKey(data.lead) && row.owner_id === data.lead.ownerId)
    )
      proposals.push(await inspect(tx, actor, data, row));
  await lockActor(tx, actor);
  const active = await tx.query(
    "select id from partner_booking_proposals where lead_id=$1 and state='offered' and invalidated_at is null and expires_at>clock_timestamp() limit 1",
    [id],
  );
  return bookingProposalsSchema.parse({ canPropose: !actor.wallet && !active.rowCount, proposals });
}

async function reserveOne(
  tx: PoolClient,
  actor: PartnerActor,
  id: string,
  proposalId: string,
  input: BookingChoice,
  coordinationId?: string,
) {
  const data = await locked(tx, actor, id, proposalId);
  const row = data.rows.find((r) => r.id === proposalId);
  if (!row) fail("PARTNER_NOT_FOUND", 404);
  const value = await inspect(tx, actor, data, row);
  if (
    value.state !== "offered" ||
    !value.slots[input.slot]?.canBook ||
    value.slots[input.slot]?.basis !== input.basis
  )
    fail("PARTNER_CONFLICT", 409);
  const offered = bookingProposalInputSchema.parse(row.input),
    slot = offered.slots[input.slot]!;
  // All blocking source reads are finished; elapsed expiry/session/mandate must still be valid.
  await lockActor(tx, actor);
  if (row.expires_at.getTime() <= Date.now() || !eligible(data.lead, data.member))
    fail("PARTNER_CONFLICT", 409);
  const preview = await previewPersonalAppointment(
    tx,
    actor,
    { ...data.lead, clientUserId: data.lead.ownerId },
    contextForApplication(data.member),
    { appointment: slot.appointment, time: slot.time },
    undefined,
    row.advisor_id,
  );
  if (!preview.canConfirm || preview.basis !== slot.basis) fail("PARTNER_CONFLICT", 409);
  const appointmentId = await executeLeadCommand(tx, actor, data.lead, {
    action: "appointment",
    revision: data.lead.revision,
    appointment: { ...slot.appointment, advisorId: row.advisor_id },
  });
  if (!appointmentId) throw new Error("Booking returned no appointment");
  // Preserve deliberate work on the origin; unrelated Leads are never updated.
  if (data.lead.waiting || data.lead.nextAction)
    await tx.query("update partner_leads set next_action=$2,due_at=$3,waiting=$4 where id=$1", [
      id,
      data.lead.nextAction,
      data.lead.dueAt,
      data.lead.waiting,
    ]);
  await recordAppointmentTime(
    tx,
    actor,
    appointmentId,
    1,
    { ...slot.time, basis: slot.basis, confirmed: true },
    new Date(preview.occupiedStartsAt),
    new Date(preview.occupiedEndsAt),
    {
      booking: {
        proposalId,
        ...(coordinationId ? { coordinationId } : {}),
        advisorId: row.advisor_id,
        input: offered,
        choice: input,
        clientUserId: actor.userId,
        clientProfileId: data.lead.clientProfileId,
      },
      declaration: preview.assessment.declaration,
      client: preview.assessment.client,
      appointment: slot.appointment,
    },
    row.advisor_id,
  );
  await tx.query(
    "update partner_booking_proposals set state='booked',appointment_id=$2,selected_slot=$3 where id=$1",
    [proposalId, appointmentId, input.slot],
  );
  await tx.query("update partner_leads set revision=revision+1,updated_at=now() where id=$1", [id]);
  await event(tx, actor, id, "client.appointment_reserved.v1", "", "client", appointmentId);
  await syncLeadNotifications(tx, id);
  if (coordinationId)
    await event(tx, actor, id, "client.appointments_coordinated.v1", "", "client", coordinationId);
  return proposalId;
}

export function createBookingOperations(pool: Pool, transaction: Mutation) {
  return {
    reserveCoordinatedBookings(actor: PartnerActor, raw: CoordinatedBookingInput, key: string) {
      const input = coordinatedBookingInputSchema.parse(raw);
      if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
      const ordered = [...input.choices].sort((a, b) => a.leadId.localeCompare(b.leadId));
      const guards: { data: Locked; expires: number; starts: number }[] = [];
      return transaction(
        actor,
        "booking.coordinate:v1",
        key,
        input,
        async (tx) => {
          const seeds = [];
          for (const choice of ordered) {
            const seed = (
              await tx.query<Proposal>(
                `select b.* from partner_booking_proposals b join partner_leads l on l.id=b.lead_id
             where b.id=$2 and b.lead_id=$3 and (${ownedClient})`,
                [actor.userId, choice.proposalId, choice.leadId],
              )
            ).rows[0];
            if (!seed) fail("PARTNER_NOT_FOUND", 404);
            seeds.push(seed);
          }
          const advisors = [...new Set(seeds.map((s) => s.advisor_id))].sort();
          if (advisors.length < 2) fail("PARTNER_ACTION_REQUIRED");
          for (const advisor of advisors) await membership(tx, advisor, true);
          for (const choice of ordered) {
            await tx.query("select id from partner_leads where id=$1 for update", [choice.leadId]);
            await tx.query(
              "select id from partner_contributors where lead_id=$1 order by id for share",
              [choice.leadId],
            );
            await tx.query(
              "select id from partner_booking_proposals where lead_id=$1 order by id for update",
              [choice.leadId],
            );
          }
          for (const advisor of advisors)
            await tx.query("select pg_advisory_xact_lock(hashtextextended($1,1))", [advisor]);
          let subject: string | undefined;
          const periods: { start: number; end: number }[] = [];
          for (const choice of ordered) {
            const data = await locked(tx, actor, choice.leadId, choice.proposalId);
            const row = data.rows.find((r) => r.id === choice.proposalId);
            if (!row) fail("PARTNER_NOT_FOUND", 404);
            if (subject && subject !== subjectKey(data.lead)) fail("PARTNER_ACTION_REQUIRED");
            subject = subjectKey(data.lead);
            const value = await inspect(tx, actor, data, row),
              slot = value.slots[choice.slot];
            if (value.state !== "offered" || !slot?.canBook || slot.basis !== choice.basis)
              fail("PARTNER_CONFLICT", 409);
            const start = Date.parse(slot.appointment.startsAt),
              end = start + slot.appointment.durationMinutes * 60000;
            if (periods.some((p) => p.start < end && p.end > start))
              fail("PARTNER_APPOINTMENT_CONFLICT", 409);
            periods.push({ start, end });
            guards.push({ data, expires: row.expires_at.getTime(), starts: start });
          }
          const id = newId("coordination");
          for (const choice of ordered)
            await reserveOne(
              tx,
              actor,
              choice.leadId,
              choice.proposalId,
              bookingChoiceSchema.parse({
                slot: choice.slot,
                basis: choice.basis,
                confirmed: true,
              }),
              id,
            );
          return id;
        },
        async (tx, id) => {
          const items = [];
          for (const choice of ordered) {
            const booking = await project(tx, actor, choice.leadId);
            const proposal = booking.proposals.find((p) => p.id === choice.proposalId);
            if (!proposal) fail("PARTNER_NOT_FOUND", 404);
            items.push({ leadId: choice.leadId, proposal });
          }
          await lockActor(tx, actor);
          // A delayed last write/projection must roll back every preceding reservation too.
          if (
            guards.some(
              (g) =>
                g.expires <= Date.now() ||
                g.starts <= Date.now() ||
                !eligible(g.data.lead, g.data.member),
            )
          )
            fail("PARTNER_CONFLICT", 409);
          return coordinatedBookingReceiptSchema.parse({ id, items });
        },
      );
    },
    async bookingProposals(actor: PartnerActor, id: string) {
      const tx = await pool.connect();
      try {
        await tx.query("begin");
        const result = await project(tx, actor, id);
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
    proposeBooking(actor: PartnerActor, id: string, raw: BookingProposalInput, key: string) {
      const input = bookingProposalInputSchema.parse(raw);
      if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
      return transaction(
        actor,
        `booking.propose:${id}`,
        key,
        input,
        async (tx) => {
          const data = await locked(tx, actor, id);
          const expires = Date.parse(input.expiresAt);
          if (expires <= Date.now() || expires > Date.now() + 7 * 86400000)
            fail("PARTNER_ACTION_REQUIRED");
          for (const slot of input.slots) {
            const preview = await previewPersonalAppointment(
              tx,
              actor,
              { ...data.lead, clientUserId: data.lead.ownerId },
              contextForApplication(data.member),
              { appointment: slot.appointment, time: slot.time },
            );
            if (preview.basis !== slot.basis) fail("PARTNER_CONFLICT", 409);
            if (!preview.canConfirm || expires >= Date.parse(preview.occupiedStartsAt))
              fail("PARTNER_ACTION_REQUIRED");
          }
          await lockActor(tx, actor);
          if (!eligible(data.lead, data.member) || expires <= Date.now())
            fail("PARTNER_ACTION_REQUIRED");
          await tx.query(
            "update partner_booking_proposals set invalidated_at=clock_timestamp() where lead_id=$1 and state='offered' and invalidated_at is null and expires_at<=clock_timestamp()",
            [id],
          );
          if (
            (
              await tx.query(
                "select id from partner_booking_proposals where lead_id=$1 and state='offered' and invalidated_at is null",
                [id],
              )
            ).rowCount
          )
            fail("PARTNER_CONFLICT", 409);
          const proposalId = newId("booking");
          await tx.query(
            `insert into partner_booking_proposals(id,lead_id,advisor_id,advisor_name,fingerprint,input,expires_at,subject_key,owner_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              proposalId,
              id,
              actor.userId,
              data.member!.name,
              fingerprint(data.lead, data.member),
              JSON.stringify(input),
              input.expiresAt,
              subjectKey(data.lead),
              data.lead.ownerId,
            ],
          );
          await event(tx, actor, id, "appointment.slots_offered.v1", "", "client", proposalId);
          return proposalId;
        },
        async (tx) => project(tx, actor, id),
      );
    },
    withdrawBooking(
      actor: PartnerActor,
      id: string,
      proposalId: string,
      raw: { confirmed: true },
      key: string,
    ) {
      const input = bookingWithdrawalSchema.parse(raw);
      if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
      return transaction(
        actor,
        `booking.withdraw:${id}:${proposalId}`,
        key,
        input,
        async (tx) => {
          const data = await locked(tx, actor, id, proposalId);
          const row = data.rows.find((r) => r.id === proposalId);
          if (!row || row.state !== "offered" || row.invalidated_at) fail("PARTNER_CONFLICT", 409);
          await tx.query("update partner_booking_proposals set state='withdrawn' where id=$1", [
            proposalId,
          ]);
          await event(tx, actor, id, "appointment.slots_withdrawn.v1", "", "client", proposalId);
          return proposalId;
        },
        async (tx) => project(tx, actor, id),
      );
    },
    reserveBooking(
      actor: PartnerActor,
      id: string,
      proposalId: string,
      raw: BookingChoice,
      key: string,
    ) {
      const input = bookingChoiceSchema.parse(raw);
      if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
      return transaction(
        actor,
        `booking.reserve:${id}:${proposalId}`,
        key,
        input,
        (tx) => reserveOne(tx, actor, id, proposalId, input),
        async (tx) => project(tx, actor, id),
      );
    },
  };
}
