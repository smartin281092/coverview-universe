import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { CurrentContract, LeadOffer } from "@coverview/contracts/partner";
import type { LeadOrientation } from "@coverview/contracts/partner-orientation";
import {
  recommendationInputSchema,
  recommendationSchema,
  recommendationsSchema,
  type Recommendation,
  type RecommendationInput,
} from "@coverview/contracts/partner-recommendations";
import { compareOffers } from "./partner.comparison.js";
import { orientOffers } from "./partner.orientation.js";
import {
  fail,
  failOnConcurrentAbort,
  lockActor,
  membership,
  type Executor,
  type PartnerActor,
} from "./partner.policy.js";
import { event, newId } from "./partner.audit.js";
import { readOffers } from "./partner.offers.js";
import { readCurrentContract } from "./partner.contract.js";
import { notifyAnalysis } from "./partner.notifications.js";
import { analysisGapsSchema, type AnalysisGaps } from "@coverview/contracts/partner-complements";

type Mutation = <T>(
  actor: PartnerActor,
  operation: string,
  key: string,
  input: unknown,
  action: (tx: PoolClient) => Promise<string>,
  project: (tx: PoolClient, id: string) => Promise<T>,
) => Promise<T>;
export type RecommendationContext = {
  canManage: boolean;
  offers: LeadOffer[];
  current: CurrentContract | null;
};
type Row = {
  id: string;
  version: number;
  kind: Recommendation["kind"];
  offer_id: string | null;
  offer_version: number | null;
  rationale: string;
  attention: string;
  orientation_kind: Recommendation["orientationKind"];
  deviation: boolean;
  deviation_reason: string | null;
  basis: string;
  created_by: string;
  created_at: Date;
};

// A recommendation concerns what the client can see: the published, still active versions.
const published = (offers: LeadOffer[]) =>
  offers.filter(
    (offer) =>
      offer.active &&
      !!offer.publishedAt &&
      !["cancelled", "replaced", "expired"].includes(offer.state),
  );
// What the advisor compared: those versions and the current contract review. A change makes an
// existing recommendation "to review" and refuses a recommendation read on an older basis.
function recommendationBasis(offers: LeadOffer[], current: CurrentContract | null) {
  const compared = published(offers)
    .map((offer) => [offer.id, offer.version, offer.reviewedAt])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return createHash("sha256")
    .update(
      JSON.stringify({
        offers: compared,
        current:
          current?.status === "available"
            ? [current.referenceId, current.reviewVersion, current.premiumVerified]
            : null,
      }),
    )
    .digest("hex");
}
// Only a version the client can still compare and choose may be recommended.
const recommendable = (offer: LeadOffer, now = Date.now()) =>
  !!offer.reviewedAt &&
  offer.canCompare === true &&
  (!offer.validUntil || new Date(offer.validUntil).getTime() > now);
// Departing from the orientation's single suggestion, or recommending something while the
// orientation is insufficient, requires a recorded reason.
function deviates(
  orientation: LeadOrientation,
  kind: Recommendation["kind"],
  offerId: string | null,
) {
  const suggestion = orientation.suggestion;
  if (suggestion)
    return !(
      suggestion.kind === kind &&
      (suggestion.kind !== "offer" || suggestion.offerId === offerId)
    );
  return orientation.kind === "insufficient" && kind !== "none";
}

async function project(
  db: Executor,
  rows: Row[],
  offers: LeadOffer[],
  basis: string,
  wallet: boolean,
) {
  const names = new Map<string, string>();
  for (const row of rows)
    if (!names.has(row.created_by)) {
      const member = await membership(db, row.created_by);
      names.set(row.created_by, member ? `${member.name} (${member.organization})` : "CoverView");
    }
  return rows.map((row) => {
    const offer = row.offer_id ? offers.find((item) => item.id === row.offer_id) : undefined;
    const stale =
      row.basis !== basis ||
      (row.kind === "offer" && (!offer || offer.version !== row.offer_version));
    return recommendationSchema.parse({
      id: row.id,
      version: row.version,
      kind: row.kind,
      offerId: row.offer_id,
      offerVersion: row.offer_version,
      company: offer?.company ?? null,
      product: offer?.product ?? null,
      rationale: row.rationale,
      attention: row.attention,
      deviation: wallet ? false : row.deviation,
      deviationReason: wallet ? null : row.deviation_reason,
      orientationKind: row.orientation_kind,
      status: stale ? "to_review" : "current",
      author: names.get(row.created_by)!,
      createdAt: row.created_at.toISOString(),
    });
  });
}

async function rowsOf(db: Executor, leadId: string, limit: number) {
  return (
    await db.query<Row>(
      "select * from partner_offer_recommendations where lead_id=$1 order by version desc limit $2",
      [leadId, limit],
    )
  ).rows;
}

// Latest recommendation for the Lead detail (Partner and Wallet), from the offers the actor sees.
export async function readCurrentRecommendation(
  db: Executor,
  leadId: string,
  offers: LeadOffer[],
  current: CurrentContract | null,
  wallet: boolean,
) {
  const rows = await rowsOf(db, leadId, 1);
  if (!rows.length) return null;
  const visible = published(offers);
  return (await project(db, rows, visible, recommendationBasis(visible, current), wallet))[0]!;
}

type AnalysisLead = {
  id: string;
  responsibleId: string | null;
  clientUserId: string | null;
  clientProfileId: string | null;
};
// The analysis of the reviewed offers, and what it lacks by origin (C8e, brief I.13): the client
// for the reference contract, the professional for the values to verify, the company for the
// benefits absent from an offer.
export async function readAnalysis(tx: PoolClient, lead: AnalysisLead): Promise<AnalysisGaps> {
  // An offer still awaiting its review is work in progress, not an incomplete analysis.
  const offers = (await readOffers(tx, lead.id, false)).items.filter((offer) => !!offer.reviewedAt);
  const current = await readCurrentContract(tx, lead);
  const reviewed = offers.some(
    (offer) => offer.active && !["cancelled", "replaced", "expired"].includes(offer.state),
  );
  const orientation = orientOffers(compareOffers(current, offers), offers, current);
  return analysisGapsSchema.parse({
    incomplete: reviewed && orientation.kind === "insufficient",
    referenceContract: !current
      ? "absent"
      : current.status === "available"
        ? "confirmed"
        : "to_confirm",
    offersToVerify: orientation.offers.filter((item) => item.status === "incomplete").length,
    valuesToVerify: orientation.offers.reduce((sum, item) => sum + item.toVerify.length, 0),
    contractReviewPending:
      current?.status === "available" && (current.reviewVersion === 0 || !current.premiumVerified),
    missingBenefits: orientation.offers.reduce((sum, item) => sum + item.missing.length, 0),
  });
}
// After a change of the analysis inputs, and in the continuity worker since an offer can lapse
// or a source change: an insufficient orientation asks the person following the request to
// complete the analysis (brief I.13).
export async function syncAnalysisNotice(tx: PoolClient, lead: AnalysisLead) {
  await notifyAnalysis(tx, lead, (await readAnalysis(tx, lead)).incomplete);
}

export function createRecommendationOperations(
  pool: Pool,
  transaction: Mutation,
  load: (tx: PoolClient, actor: PartnerActor, id: string) => Promise<RecommendationContext>,
) {
  async function dossier(db: PoolClient, actor: PartnerActor, id: string) {
    if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
    const context = await load(db, actor, id);
    const offers = published(context.offers);
    const orientation = orientOffers(
      compareOffers(context.current, offers),
      offers,
      context.current,
    );
    const basis = recommendationBasis(offers, context.current);
    const history = await project(db, await rowsOf(db, id, 50), offers, basis, false);
    return recommendationsSchema.parse({
      basis,
      orientation,
      canRecommend: context.canManage,
      choices: [
        ...offers
          .filter((offer) => recommendable(offer))
          .map((offer) => ({
            kind: "offer" as const,
            offerId: offer.id,
            deviation: deviates(orientation, "offer", offer.id),
          })),
        {
          kind: "keep_current" as const,
          offerId: null,
          deviation: deviates(orientation, "keep_current", null),
        },
        { kind: "none" as const, offerId: null, deviation: deviates(orientation, "none", null) },
      ],
      current: history[0] ?? null,
      history,
    });
  }
  return {
    async recommendations(actor: PartnerActor, id: string) {
      const tx = await pool.connect();
      try {
        await tx.query("begin isolation level repeatable read");
        await lockActor(tx, actor);
        const result = await dossier(tx, actor, id);
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
    recommend(actor: PartnerActor, id: string, raw: RecommendationInput, key: string) {
      const input = recommendationInputSchema.parse(raw);
      return transaction(
        actor,
        `recommendation:${id}`,
        key,
        input,
        async (tx) => {
          if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
          const context = await load(tx, actor, id);
          if (!context.canManage) fail("PARTNER_ACCESS_DENIED", 403);
          const offers = published(context.offers);
          if (recommendationBasis(offers, context.current) !== input.basis)
            fail("PARTNER_CONFLICT", 409);
          const offer =
            input.kind === "offer" ? offers.find((item) => item.id === input.offerId) : undefined;
          if (input.kind === "offer" && (!offer || !recommendable(offer)))
            fail("PARTNER_OFFER_NOT_READY");
          const orientation = orientOffers(
            compareOffers(context.current, offers),
            offers,
            context.current,
          );
          const deviation = deviates(orientation, input.kind, input.offerId);
          if (deviation && !input.deviationReason) fail("PARTNER_ACTION_REQUIRED");
          const version =
            (
              await tx.query<{ version: number }>(
                "select coalesce(max(version),0)::int version from partner_offer_recommendations where lead_id=$1",
                [id],
              )
            ).rows[0]!.version + 1;
          const recommendation = newId("prec");
          await tx.query(
            `insert into partner_offer_recommendations(id,lead_id,version,kind,offer_id,offer_version,rationale,attention,orientation_kind,deviation,deviation_reason,basis,created_by)
             values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [
              recommendation,
              id,
              version,
              input.kind,
              offer?.id ?? null,
              offer?.version ?? null,
              input.rationale,
              input.attention,
              orientation.kind,
              deviation,
              deviation ? input.deviationReason : null,
              input.basis,
              actor.userId,
            ],
          );
          await event(tx, actor, id, "recommendation.published", "", "client", recommendation);
          return id;
        },
        (tx) => dossier(tx, actor, id),
      );
    },
  };
}
