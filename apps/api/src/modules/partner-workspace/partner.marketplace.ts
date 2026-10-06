import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import {
  marketPublicationSchema,
  marketApplicationInputSchema,
  marketReservationInputSchema,
  marketDecisionSchema,
  marketMandateInputSchema,
  marketCardSchema,
  marketDetailSchema,
  marketListSchema,
  marketReservationSchema,
  marketMissionSchema,
  marketMandatesSchema,
  type MarketPublication,
  type MarketReservationInput,
} from "@coverview/contracts/partner-economy";
import {
  camel,
  context,
  contextForApplication,
  engageable,
  fail,
  lockActor,
  membership,
  authorityCurrent,
  type PartnerActor,
} from "./partner.policy.js";
import type { partnerLeads } from "./partner.schema.js";
import type { partnerMarketListings, partnerMarketReservations } from "./partner.economy.schema.js";
import {
  commercialCondition,
  requireCommercial,
  economyRead,
  economyCursor,
  economyNext,
  type EconomyMutation,
} from "./partner.commercial.js";
import { newId, event } from "./partner.audit.js";
import { requireNewEngagement, handoffWork } from "./partner.participants.js";
import { respondCollaboration, reconcileCollaborations } from "./partner.collaboration.js";
import { syncLeadNotifications } from "./partner.notifications.js";
type Lead = typeof partnerLeads.$inferSelect;
type Listing = typeof partnerMarketListings.$inferSelect;
type Reservation = typeof partnerMarketReservations.$inferSelect;
const subject = (lead: Lead) =>
  lead.clientProfileId ? `profile:${lead.clientProfileId}` : `self:${lead.clientUserId}`;
async function profile(tx: PoolClient, lead: Lead) {
  if (!lead.clientUserId) fail("PARTNER_INVALID_CLIENT");
  const row = lead.clientProfileId
    ? (
        await tx.query<{ user_id: string; revision: number }>(
          "select user_id,revision from managed_profiles where id=$1 for share",
          [lead.clientProfileId],
        )
      ).rows[0]
    : (
        await tx.query<{ user_id: string; revision: number }>(
          "select user_id,0 revision from identity_profiles where user_id=$1 for share",
          [lead.clientUserId],
        )
      ).rows[0];
  if (!row) fail("PARTNER_INVALID_CLIENT");
  return row;
}
async function marketAccess(tx: PoolClient, actor: PartnerActor) {
  if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
  const ctx = await context(tx, actor, true);
  if (!ctx.operational) fail("PARTNER_ACCESS_DENIED", 403);
  return ctx;
}
// A marketplace restriction (C8a) stops new publications, applications and reservations; what is
// already published or reserved follows its own course.
const marketRestricted = (ctx: Awaited<ReturnType<typeof context>>) =>
  !ctx.administrator && !!ctx.application?.restrictions.marketplace;
async function load(tx: PoolClient, actor: PartnerActor, id: string, targetId?: string) {
  const raw = (
    await tx.query<Record<string, unknown>>("select * from partner_market_listings where id=$1", [
      id,
    ])
  ).rows[0];
  if (!raw) fail("PARTNER_NOT_FOUND", 404);
  const listing = camel<Listing>(raw);
  for (const userId of [
    ...new Set([listing.publisherId, actor.userId, ...(targetId ? [targetId] : [])]),
  ].sort())
    await membership(tx, userId, true);
  const row = (
    await tx.query<Record<string, unknown>>("select * from partner_leads where id=$1 for update", [
      listing.leadId,
    ])
  ).rows[0];
  if (!row) fail("PARTNER_NOT_FOUND", 404);
  const lead = camel<Lead>(row),
    owner = await profile(tx, lead);
  const fresh = (
    await tx.query<Record<string, unknown>>(
      "select * from partner_market_listings where id=$1 for update",
      [id],
    )
  ).rows[0]!;
  const current = camel<Listing>(fresh);
  if (actor.wallet ? owner.user_id !== actor.userId : !(await marketAccess(tx, actor)).operational)
    fail("PARTNER_NOT_FOUND", 404);
  const member = await membership(tx, current.publisherId);
  const valid =
    !current.invalidatedAt &&
    subject(lead) === current.subjectKey &&
    owner.user_id === current.ownerId &&
    owner.revision === current.profileRevision &&
    lead.adviceScopeRevision === current.adviceScopeRevision &&
    lead.responsibleId === current.responsibleId &&
    lead.category === current.category &&
    !["draft", "completed"].includes(lead.stage) &&
    contextForApplication(member).canAdvise;
  return {
    listing: current,
    lead,
    owner,
    valid,
    manages: !actor.wallet && (actor.administrator || current.publisherId === actor.userId),
  };
}
type Loaded = Awaited<ReturnType<typeof load>>;
async function reservationRow(tx: PoolClient, id: string) {
  const row = (
    await tx.query<Record<string, unknown>>(
      "select * from partner_market_reservations where id=$1",
      [id],
    )
  ).rows[0];
  if (!row) fail("PARTNER_NOT_FOUND", 404);
  return camel<Reservation>(row);
}
async function mandate(tx: PoolClient, reservation: Reservation, current: Loaded) {
  const row = (
    await tx.query<{ id: string; owner_id: string; profile_revision: number; decision: string }>(
      "select * from partner_market_mandates where reservation_id=$1 order by created_at desc,id desc limit 1",
      [reservation.id],
    )
  ).rows[0];
  const lostAuthority =
    reservation.state === "accepted" &&
    row?.decision === "accept" &&
    current.lead.marketMandateId !== row.id &&
    !(
      await tx.query(
        "select id from partner_contributors where market_mandate_id=$1 and revoked_at is null limit 1",
        [row.id],
      )
    ).rowCount;
  const state =
    row?.decision === "accept" &&
    Date.parse(marketMissionSchema.parse(reservation.mission).validUntil) <= Date.now()
      ? "expired"
      : row &&
          (lostAuthority ||
            row.owner_id !== current.owner.user_id ||
            row.profile_revision !== current.owner.revision)
        ? "context_changed"
        : row?.decision === "accept"
          ? "accepted"
          : row?.decision === "decline"
            ? "declined"
            : row?.decision === "withdraw"
              ? "withdrawn"
              : "pending";
  return { id: row?.id ?? null, state };
}
async function reservationProjection(
  tx: PoolClient,
  actor: PartnerActor,
  reservation: Reservation,
  current: Loaded,
) {
  if (!actor.wallet && !current.manages && reservation.targetId !== actor.userId)
    fail("PARTNER_NOT_FOUND", 404);
  const authority = await mandate(tx, reservation, current);
  const member = await membership(tx, reservation.targetId, true);
  const matchingTarget =
    !!member &&
    member.organizationId === reservation.targetOrganizationId &&
    member.professionalRevision === reservation.targetRevision &&
    contextForApplication(member).canAdvise &&
    member.categories.some((c) => c === current.lead.category) &&
    // A restriction decided before acceptance stops the pending reservation (C8a).
    (reservation.state !== "reserved" ||
      (engageable(member, current.lead.category) && !member.restrictions.marketplace));
  const mission = marketMissionSchema.parse(reservation.mission);
  const state =
    reservation.state !== "reserved"
      ? reservation.state
      : !current.valid || !matchingTarget
        ? "context_changed"
        : reservation.expiresAt.getTime() <= Date.now() ||
            Date.parse(mission.validUntil) <= Date.now()
          ? "expired"
          : "reserved";
  const publisher = await membership(tx, reservation.publisherId);
  const condition = actor.wallet
    ? null
    : await commercialCondition(tx, actor, reservation.conditionId, false);
  return marketReservationSchema.parse({
    id: reservation.id,
    listingId: current.listing.id,
    targetId: reservation.targetId,
    targetName: reservation.targetName,
    publisherName: publisher?.name ?? "",
    createdAt: reservation.createdAt.toISOString(),
    expiresAt: reservation.expiresAt.toISOString(),
    mission,
    condition,
    state,
    mandate: authority.state,
    mandateId: authority.id,
    agreementId: state === "accepted" ? reservation.id : null,
    collaborationId: reservation.collaborationId,
    canRespond:
      !actor.wallet &&
      actor.userId === reservation.targetId &&
      state === "reserved" &&
      (authority.state === "accepted" || authority.state === "pending"),
    canCancel: current.manages && state === "reserved",
    canMandate:
      !!actor.wallet &&
      (state === "reserved" || (state === "accepted" && authority.state === "accepted")),
  });
}
async function card(tx: PoolClient, actor: PartnerActor, current: Loaded) {
  const { listing, lead, valid, manages } = current;
  const publication = marketPublicationSchema.parse(listing.publication);
  const terms = await commercialCondition(
    tx,
    { ...actor, wallet: false },
    listing.conditionId,
    false,
  );
  const latest = (
    await tx.query<{ state: string; expires_at: Date }>(
      "select state,expires_at from partner_market_reservations where listing_id=$1 order by created_at desc,id desc limit 1",
      [listing.id],
    )
  ).rows[0];
  const state =
    latest?.state === "accepted"
      ? "accepted"
      : listing.closedAt
        ? "withdrawn"
        : !valid || terms.state !== "approved"
          ? "context_changed"
          : listing.expiresAt.getTime() <= Date.now()
            ? "expired"
            : latest?.state === "reserved" && latest.expires_at.getTime() > Date.now()
              ? "reserved"
              : "available";
  const ctx = actor.wallet ? null : await context(tx, actor);
  return marketCardSchema.parse({
    id: listing.id,
    category: listing.category,
    createdAt: listing.createdAt.toISOString(),
    leadCreatedAt: lead.createdAt.toISOString(),
    expiresAt: listing.expiresAt.toISOString(),
    language: publication.language,
    canton: publication.canton,
    modes: publication.modes,
    reason: publication.reason,
    qualification: publication.qualification,
    steps: publication.steps,
    constraints: publication.constraints,
    supplier: terms.terms.supplier,
    currency: "CHF",
    state,
    canApply:
      !manages &&
      !actor.wallet &&
      !!ctx?.canAdvise &&
      !!ctx.application?.categories.some((c) => c === listing.category) &&
      !marketRestricted(ctx) &&
      (ctx.administrator || engageable(ctx.application, listing.category)) &&
      state === "available",
    canManage: manages,
    leadId: manages ? lead.id : null,
  });
}
async function detail(tx: PoolClient, actor: PartnerActor, id: string, cursor?: string) {
  const current = await load(tx, actor, id);
  if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
  const publication = await card(tx, actor, current);
  const [at, after] = economyCursor(cursor);
  const applications = (
    await tx.query<{
      id: string;
      user_id: string;
      name: string;
      reason: string;
      created_at: Date;
      withdrawn_at: Date | null;
    }>(
      `select a.*,coalesce(m.application->>'name','') name from partner_market_applications a left join partner_members m on m.user_id=a.user_id where listing_id=$1 and ($2 or a.user_id=$3) and ($4::timestamptz is null or (a.created_at,a.id)<($4,$5)) order by a.created_at desc,a.id desc limit 21`,
      [id, current.manages, actor.userId, at, after],
    )
  ).rows;
  const rows = (
    await tx.query<Record<string, unknown>>(
      `select * from partner_market_reservations where listing_id=$1 and ($2 or target_id=$3) and ($4::timestamptz is null or (created_at,id)<($4,$5)) order by created_at desc,id desc limit 21`,
      [id, current.manages, actor.userId, at, after],
    )
  ).rows.map((r) => camel<Reservation>(r));
  const reservations = [];
  for (const r of rows.slice(0, 20))
    reservations.push(await reservationProjection(tx, actor, r, current));
  const condition = current.manages
    ? await commercialCondition(tx, actor, current.listing.conditionId, false)
    : null;
  return marketDetailSchema.parse({
    publication,
    condition,
    canReserve: current.listing.publisherId === actor.userId && publication.state === "available",
    applications: applications.slice(0, 20).map((a) => ({
      id: a.id,
      userId: a.user_id,
      name: a.name,
      reason: a.reason,
      createdAt: a.created_at.toISOString(),
      withdrawn: !!a.withdrawn_at,
    })),
    reservations,
    nextApplicationsCursor: applications.length > 20 ? economyNext(applications[19]!) : null,
    nextReservationsCursor:
      rows.length > 20 ? economyNext({ id: rows[19]!.id, created_at: rows[19]!.createdAt }) : null,
  });
}
async function requireOpen(tx: PoolClient, actor: PartnerActor, current: Loaded) {
  if (
    !current.valid ||
    current.listing.closedAt ||
    current.listing.expiresAt.getTime() <= Date.now()
  )
    fail("PARTNER_CONFLICT", 409);
  await requireCommercial(
    tx,
    actor,
    current.listing.conditionId,
    current.listing.publisherId,
    current.listing.category,
  );
}
async function expire(tx: PoolClient, listing: Listing) {
  await tx.query(
    "update partner_market_reservations set state='expired',decided_at=clock_timestamp() where lead_id=$1 and state='reserved' and expires_at<=clock_timestamp()",
    [listing.leadId],
  );
}
export function createMarketplaceOperations(pool: Pool, mutate: EconomyMutation) {
  return {
    async marketplace(
      actor: PartnerActor,
      query: { cursor?: string | undefined; view: "available" | "mine" | "applications" | "all" },
    ) {
      return economyRead(pool, actor, async (tx) => {
        await marketAccess(tx, actor);
        if (query.view === "all" && !actor.administrator) fail("PARTNER_ACCESS_DENIED", 403);
        const [at, id] = economyCursor(query.cursor);
        const where =
          query.view === "mine"
            ? "publisher_id=$1"
            : query.view === "applications"
              ? "(exists(select 1 from partner_market_applications a where a.listing_id=p.id and a.user_id=$1) or exists(select 1 from partner_market_reservations r where r.listing_id=p.id and r.target_id=$1))"
              : query.view === "all"
                ? "$1::text is not null"
                : "p.closed_at is null and p.invalidated_at is null and p.expires_at>clock_timestamp() and $1::text is not null";
        const rows = (
          await tx.query<{ id: string; created_at: Date }>(
            `select id,created_at from partner_market_listings p where ${where} and ($2::timestamptz is null or (created_at,id)<($2,$3)) order by created_at desc,id desc limit 21`,
            [actor.userId, at, id],
          )
        ).rows;
        const items = [];
        for (const row of rows.slice(0, 20))
          items.push(await card(tx, actor, await load(tx, actor, row.id)));
        return marketListSchema.parse({
          items,
          nextCursor: rows.length > 20 ? economyNext(rows[19]!) : null,
        });
      });
    },
    marketDetail: (actor: PartnerActor, id: string, cursor?: string) =>
      economyRead(pool, actor, (tx) => detail(tx, actor, id, cursor)),
    async publishMarket(actor: PartnerActor, leadId: string, raw: MarketPublication, key: string) {
      const input = marketPublicationSchema.parse(raw);
      let created = false;
      return mutate(
        actor,
        "market.published.v1",
        key,
        { leadId, input },
        async (tx) => {
          if (marketRestricted(await marketAccess(tx, actor))) fail("PARTNER_ACCESS_DENIED", 403);
          const row = (
            await tx.query<Record<string, unknown>>(
              `select * from partner_leads l where id=$1 and ((responsible_id=$2 and ${authorityCurrent("l")}) or $3) for update`,
              [leadId, actor.userId, actor.administrator],
            )
          ).rows[0];
          if (!row) fail("PARTNER_NOT_FOUND", 404);
          const lead = camel<Lead>(row);
          if (
            !lead.responsibleId ||
            lead.revision !== input.leadRevision ||
            ["draft", "completed"].includes(lead.stage) ||
            !(lead.details as { transmissionAuthorized?: boolean }).transmissionAuthorized
          )
            fail("PARTNER_ACTION_REQUIRED");
          await requireCommercial(tx, actor, input.conditionId, lead.responsibleId, lead.category);
          const owner = await profile(tx, lead);
          if (
            Date.parse(input.expiresAt) <= Date.now() ||
            Date.parse(input.expiresAt) > Date.now() + 30 * 86400000
          )
            fail("PARTNER_ACTION_REQUIRED");
          await tx.query(
            "update partner_market_listings set closed_at=clock_timestamp() where lead_id=$1 and closed_at is null and expires_at<=clock_timestamp()",
            [lead.id],
          );
          const id = newId("pmarket");
          await tx.query(
            "insert into partner_market_listings(id,lead_id,publisher_id,condition_id,subject_key,owner_id,profile_revision,advice_scope_revision,responsible_id,category,publication,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8,$3,$9,$10,$11)",
            [
              id,
              lead.id,
              lead.responsibleId,
              input.conditionId,
              subject(lead),
              owner.user_id,
              owner.revision,
              lead.adviceScopeRevision,
              lead.category,
              JSON.stringify(input),
              input.expiresAt,
            ],
          );
          await event(tx, actor, lead.id, "market.published.v1", "", "assigned", id);
          created = true;
          return id;
        },
        async (tx, id) => {
          if (created) await requireOpen(tx, actor, await load(tx, actor, id));
          return detail(tx, actor, id);
        },
      );
    },
    async applyMarket(
      actor: PartnerActor,
      id: string,
      raw: z.infer<typeof marketApplicationInputSchema>,
      key: string,
    ) {
      const input = marketApplicationInputSchema.parse(raw);
      let created = false;
      return mutate(
        actor,
        "market.applied.v1",
        key,
        { id, input },
        async (tx) => {
          const current = await load(tx, actor, id);
          await requireOpen(tx, actor, current);
          if (!(await card(tx, actor, current)).canApply) fail("PARTNER_ACCESS_DENIED", 403);
          await requireNewEngagement(tx, current.lead, actor.userId, {
            ...actor,
            administrator: false,
          });
          await tx.query(
            "insert into partner_market_applications(id,listing_id,user_id,reason) values($1,$2,$3,$4)",
            [newId("pmap"), id, actor.userId, input.reason],
          );
          await event(tx, actor, current.lead.id, "market.applied.v1", "", "private", id);
          created = true;
          return id;
        },
        async (tx, target) => {
          if (created) await requireOpen(tx, actor, await load(tx, actor, target));
          return detail(tx, actor, target);
        },
      );
    },
    async withdrawMarketApplication(actor: PartnerActor, id: string, key: string) {
      return mutate(
        actor,
        "market.application_withdrawn.v1",
        key,
        { id },
        async (tx) => {
          const current = await load(tx, actor, id);
          const changed = await tx.query(
            "update partner_market_applications set withdrawn_at=clock_timestamp() where listing_id=$1 and user_id=$2 and withdrawn_at is null",
            [id, actor.userId],
          );
          if (!changed.rowCount) fail("PARTNER_CONFLICT", 409);
          await event(
            tx,
            actor,
            current.lead.id,
            "market.application_withdrawn.v1",
            "",
            "private",
            id,
          );
          return id;
        },
        (tx, target) => detail(tx, actor, target),
      );
    },
    async reserveMarket(actor: PartnerActor, id: string, raw: MarketReservationInput, key: string) {
      const input = marketReservationInputSchema.parse(raw);
      let createdId: string | null = null;
      return mutate(
        actor,
        "market.reserved.v1",
        key,
        { id, input },
        async (tx) => {
          const current = await load(tx, actor, id, input.targetId);
          await requireOpen(tx, actor, current);
          // A platform administrator cannot accept the supplier's economic offer in their place.
          if (
            actor.wallet ||
            current.listing.publisherId !== actor.userId ||
            input.targetId === actor.userId ||
            input.conditionId !== current.listing.conditionId
          )
            fail("PARTNER_ACCESS_DENIED", 403);
          if (marketRestricted(await context(tx, actor, true))) fail("PARTNER_ACCESS_DENIED", 403);
          await requireNewEngagement(tx, current.lead, input.targetId, {
            ...actor,
            administrator: false,
          });
          const target = (await membership(tx, input.targetId, true))!;
          if (target.restrictions.marketplace) fail("PARTNER_INVALID_ASSIGNEE");
          const condition = await requireCommercial(
            tx,
            actor,
            input.conditionId,
            actor.userId,
            current.lead.category,
          );
          if (condition.terms.contributors.some((c) => c.userId === input.targetId))
            fail("PARTNER_ACTION_REQUIRED");
          if (
            Date.parse(input.expiresAt) <= Date.now() ||
            Date.parse(input.expiresAt) > Date.now() + 86400000 ||
            Date.parse(input.expiresAt) > current.listing.expiresAt.getTime() ||
            Date.parse(input.mission.validUntil) <= Date.parse(input.expiresAt)
          )
            fail("PARTNER_ACTION_REQUIRED");
          await expire(tx, current.listing);
          const rid = newId("pmres");
          await tx.query(
            "insert into partner_market_reservations(id,listing_id,lead_id,publisher_id,target_id,condition_id,target_organization_id,target_revision,target_name,target_organization,mission,reason,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
            [
              rid,
              id,
              current.lead.id,
              actor.userId,
              input.targetId,
              input.conditionId,
              target.organizationId,
              target.professionalRevision,
              target.name,
              target.organization,
              JSON.stringify(input.mission),
              input.reason,
              input.expiresAt,
            ],
          );
          await event(tx, actor, current.lead.id, "market.reserved.v1", "", "assigned", rid);
          await event(tx, actor, current.lead.id, "market.mandate_requested.v1", "", "client", rid);
          createdId = rid;
          return id;
        },
        async (tx, target) => {
          if (createdId) {
            const current = await load(tx, actor, target, input.targetId);
            await requireOpen(tx, actor, current);
            if (
              (await reservationProjection(tx, actor, await reservationRow(tx, createdId), current))
                .state !== "reserved"
            )
              fail("PARTNER_CONFLICT", 409);
          }
          return detail(tx, actor, target);
        },
      );
    },
    async decideMarket(
      actor: PartnerActor,
      reservationId: string,
      raw: z.infer<typeof marketDecisionSchema>,
      key: string,
    ) {
      const input = marketDecisionSchema.parse(raw);
      let newlyAccepted = false;
      return mutate(
        actor,
        "market.decided.v1",
        key,
        { reservationId, input },
        async (tx) => {
          const reserved = await reservationRow(tx, reservationId),
            current = await load(tx, actor, reserved.listingId, reserved.targetId);
          const reservation = await reservationRow(tx, reservationId);
          if (
            actor.wallet ||
            (input.decision === "cancel" ? !current.manages : actor.userId !== reservation.targetId)
          )
            fail("PARTNER_ACCESS_DENIED", 403);
          if ((await reservationProjection(tx, actor, reservation, current)).state !== "reserved")
            fail("PARTNER_CONFLICT", 409);
          if (input.decision === "accept") {
            await requireOpen(tx, actor, current);
            const terms = await requireCommercial(
              tx,
              actor,
              reservation.conditionId,
              reservation.publisherId,
              current.lead.category,
            );
            if ((await mandate(tx, reservation, current)).state !== "accepted")
              fail("PARTNER_ACTION_REQUIRED");
            const mission = marketMissionSchema.parse(reservation.mission);
            // The publisher accepted the immutable economics at reservation; this is the recipient's act.
            const collaboration = newId("pcoll");
            const collaborationTerms = {
              targetId: reservation.targetId,
              mode: mission.mode,
              access: mission.access,
              communication: mission.communication,
              scope: mission.scope,
              responsibilities: mission.responsibilities,
              reason: reservation.reason,
              economicNote: `Accord ${reservation.id} / ${terms.id}`,
              existingRightsPreserved: true,
              transmissionConfirmed: true,
            };
            // Materialize the publisher's recorded proposal with its original author/time, then
            // execute the recipient's real acceptance. Never impersonate the publisher's session.
            await tx.query(
              "insert into partner_collaborations(id,lead_id,proposer_id,target_id,previous_responsible_id,category,terms,created_at) values($1,$2,$3,$4,$5,$6,$7,$8)",
              [
                collaboration,
                current.lead.id,
                reservation.publisherId,
                reservation.targetId,
                current.listing.responsibleId,
                current.lead.category,
                JSON.stringify(collaborationTerms),
                reservation.createdAt,
              ],
            );
            await tx.query(
              "update partner_market_reservations set state='accepted',decided_at=clock_timestamp(),response=$2,collaboration_id=$3 where id=$1",
              [reservation.id, input.reason, collaboration],
            );
            await respondCollaboration(tx, actor, collaboration, {
              revision: 0,
              decision: "accept",
              reason: input.reason,
            });
            const authority = await mandate(tx, reservation, current);
            if (mission.mode !== "co_advice")
              await tx.query(
                "update partner_leads set market_mandate_id=$2,market_valid_until=$3 where id=$1",
                [current.lead.id, authority.id, mission.validUntil],
              );
            await tx.query(
              "update partner_contributors set market_mandate_id=$2,market_valid_until=$3 where collaboration_id=$1 and revoked_at is null",
              [collaboration, authority.id, mission.validUntil],
            );
            await tx.query(
              "update partner_market_listings set closed_at=clock_timestamp() where id=$1",
              [current.listing.id],
            );
            newlyAccepted = true;
          } else
            await tx.query(
              "update partner_market_reservations set state=$2,decided_at=clock_timestamp(),response=$3 where id=$1",
              [
                reservation.id,
                input.decision === "decline" ? "declined" : "cancelled",
                input.reason,
              ],
            );
          await event(
            tx,
            actor,
            current.lead.id,
            `market.${input.decision}.v1`,
            "",
            "private",
            reservation.id,
          );
          return reservation.id;
        },
        async (tx, target) => {
          const reservation = await reservationRow(tx, target),
            current = await load(tx, actor, reservation.listingId, reservation.targetId);
          const result = await reservationProjection(tx, actor, reservation, current);
          await lockActor(tx, actor);
          if (newlyAccepted) {
            await requireCommercial(
              tx,
              actor,
              reservation.conditionId,
              reservation.publisherId,
              current.lead.category,
            );
            await requireNewEngagement(tx, current.lead, reservation.targetId, {
              ...actor,
              administrator: false,
            });
            if (
              reservation.expiresAt.getTime() <= Date.now() ||
              (await mandate(tx, reservation, current)).state !== "accepted"
            )
              fail("PARTNER_CONFLICT", 409);
          }
          return result;
        },
      );
    },
    async marketMandates(actor: PartnerActor, leadId: string, cursor?: string) {
      return economyRead(pool, actor, async (tx) => {
        if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
        const [at, id] = economyCursor(cursor);
        const rows = (
          await tx.query<Record<string, unknown>>(
            "select r.* from partner_market_reservations r join partner_leads l on l.id=r.lead_id where l.id=$1 and coalesce((select user_id from managed_profiles where id=l.client_profile_id),l.client_user_id)=$2 and ($3::timestamptz is null or (r.created_at,r.id)<($3,$4)) order by r.created_at desc,r.id desc limit 21",
            [leadId, actor.userId, at, id],
          )
        ).rows.map((r) => camel<Reservation>(r));
        const items = [];
        for (const r of rows.slice(0, 20))
          items.push(await reservationProjection(tx, actor, r, await load(tx, actor, r.listingId)));
        return marketMandatesSchema.parse({
          items,
          nextCursor:
            rows.length > 20
              ? economyNext({ id: rows[19]!.id, created_at: rows[19]!.createdAt })
              : null,
        });
      });
    },
    async decideMarketMandate(
      actor: PartnerActor,
      reservationId: string,
      raw: z.infer<typeof marketMandateInputSchema>,
      key: string,
    ) {
      const input = marketMandateInputSchema.parse(raw);
      let newlyAccepted = false;
      return mutate(
        actor,
        "market.mandated.v1",
        key,
        { reservationId, input },
        async (tx) => {
          if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
          const reservation = await reservationRow(tx, reservationId),
            current = await load(tx, actor, reservation.listingId, reservation.targetId);
          const view = await reservationProjection(tx, actor, reservation, current);
          if (
            !view.canMandate ||
            (input.decision === "withdraw"
              ? view.mandate !== "accepted"
              : view.state !== "reserved" || view.mandate !== "pending")
          )
            fail("PARTNER_CONFLICT", 409);
          await tx.query(
            "insert into partner_market_mandates(id,reservation_id,owner_id,profile_revision,decision,reason) values($1,$2,$3,$4,$5,$6)",
            [
              newId("pmand"),
              reservationId,
              actor.userId,
              current.owner.revision,
              input.decision,
              input.reason,
            ],
          );
          if (input.decision !== "accept" && reservation.state === "reserved")
            await tx.query(
              "update partner_market_reservations set state='cancelled',decided_at=clock_timestamp(),response=$2 where id=$1",
              [reservationId, input.reason],
            );
          if (input.decision === "withdraw" && reservation.state === "accepted") {
            await tx.query(
              "update partner_contributors set revoked_at=clock_timestamp() where collaboration_id=$1 and revoked_at is null",
              [reservation.collaborationId],
            );
            await tx.query(
              "update partner_leads set responsible_id=null,assignment='reassign',revision=revision+1 where id=$1 and responsible_id=$2",
              [current.lead.id, reservation.targetId],
            );
            await handoffWork(
              tx,
              actor,
              current.lead.id,
              current.lead.responsibleId === reservation.targetId
                ? null
                : current.lead.responsibleId,
            );
            await syncLeadNotifications(tx, current.lead.id);
            await reconcileCollaborations(tx, current.lead.id, actor);
          }
          await event(
            tx,
            actor,
            current.lead.id,
            "market.mandate_changed.v1",
            "",
            "client",
            reservationId,
          );
          newlyAccepted = input.decision === "accept";
          return reservationId;
        },
        async (tx, target) => {
          const r = await reservationRow(tx, target),
            current = await load(tx, actor, r.listingId);
          const result = await reservationProjection(tx, actor, r, current);
          if (newlyAccepted && (result.state !== "reserved" || result.mandate !== "accepted"))
            fail("PARTNER_CONFLICT", 409);
          return result;
        },
      );
    },
    async withdrawMarket(actor: PartnerActor, id: string, reason: string, key: string) {
      const input = z.string().trim().min(10).max(2000).parse(reason);
      return mutate(
        actor,
        "market.withdrawn.v1",
        key,
        { id, input },
        async (tx) => {
          const current = await load(tx, actor, id);
          if (!current.manages) fail("PARTNER_ACCESS_DENIED", 403);
          const accepted = await tx.query(
            "select id from partner_market_reservations where listing_id=$1 and state='accepted'",
            [id],
          );
          if (accepted.rowCount || current.listing.closedAt) fail("PARTNER_CONFLICT", 409);
          await tx.query(
            "update partner_market_listings set closed_at=clock_timestamp() where id=$1",
            [id],
          );
          await tx.query(
            "update partner_market_reservations set state='cancelled',decided_at=clock_timestamp(),response=$2 where listing_id=$1 and state='reserved'",
            [id, input],
          );
          await event(tx, actor, current.lead.id, "market.withdrawn.v1", input, "assigned", id);
          return id;
        },
        (tx, target) => detail(tx, actor, target),
      );
    },
  };
}
