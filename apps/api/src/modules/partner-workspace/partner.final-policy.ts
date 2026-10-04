import type { PoolClient } from "pg";
import { z } from "zod";
import { documentAnalysisSchema } from "@coverview/contracts";
import {
  finalPolicyFields,
  finalPolicySchema,
  finalPolicyReviewSchema,
  contractCandidateSchema,
  type LeadCommand,
} from "@coverview/contracts/partner";
import { readContractCandidates, retainContractReference } from "../document-intelligence/index.js";
import { lockContractSubject } from "./partner.contract.js";
import { readOffers, requireOfferSource } from "./partner.offers.js";
import { fail, date, type Executor, type PartnerActor } from "./partner.policy.js";
import { event, newId } from "./partner.audit.js";
import { readConclusionEvidence } from "./partner.conclusion-evidence.js";

type Subject = { id: string; clientUserId: string | null; clientProfileId: string | null };
const snapshotSchema = z.object({
  candidate: contractCandidateSchema,
  analysis: documentAnalysisSchema,
});
type PolicyRow = {
  id: string;
  offer_id: string;
  document_id: string;
  fingerprint: string;
  source_snapshot: unknown;
  active: boolean;
  created_at: Date;
  withdrawn_at: Date | null;
};

export async function readFinalPolicies(
  db: Executor,
  rawLead: Subject,
  canReview: boolean,
  options: { id?: string; cursor?: string } = {},
) {
  const lead = await lockContractSubject(db, rawLead);
  const values: unknown[] = [lead.id];
  let clause = "";
  if (options.id) {
    values.push(options.id);
    clause += ` and p.id=$${values.length}`;
  }
  if (options.cursor) {
    let cursor;
    try {
      cursor = z
        .object({ leadId: z.literal(lead.id), at: z.iso.datetime(), id: z.string().max(100) })
        .parse(JSON.parse(Buffer.from(options.cursor, "base64url").toString("utf8")));
    } catch {
      return fail("PARTNER_NOT_FOUND", 400);
    }
    values.push(cursor.at, cursor.id);
    clause += ` and (p.created_at,p.id)<($${values.length - 1}::timestamptz,$${values.length})`;
  }
  const rows = (
    await db.query<PolicyRow>(
      `select p.* from partner_final_policies p where p.lead_id=$1${clause} order by p.created_at desc,p.id desc limit ${options.id ? 1 : 21}`,
      values,
    )
  ).rows;
  const items = [];
  for (const row of rows.slice(0, 20)) {
    const offer = (await readOffers(db, lead.id, true, { offerId: row.offer_id })).items[0];
    if (!offer) return fail("PARTNER_NOT_FOUND", 404);
    const current = row.active
      ? (await readContractCandidates(db, lead.clientUserId, lead.clientProfileId, row.document_id))
          .entries[0]
      : null;
    const status = !row.active
      ? "withdrawn"
      : !current
        ? "unavailable"
        : current.candidate.fingerprint !== row.fingerprint
          ? "source_changed"
          : "available";
    const valid = status === "available" && offer.sourceStatus === "current";
    const reviewRow = (
      await db.query<{ version: number; checks: unknown; created_at: Date }>(
        "select version,checks,created_at from partner_final_policy_reviews where policy_id=$1 order by version desc limit 1",
        [row.id],
      )
    ).rows[0];
    // Revoked/changed sources must not continue disclosing excerpts through old review results.
    const review =
      valid && reviewRow
        ? {
            version: reviewRow.version,
            reviewedAt: date(reviewRow.created_at),
            checks: finalPolicyReviewSchema.parse({ policyId: row.id, checks: reviewRow.checks })
              .checks,
          }
        : null;
    const missingChecks = finalPolicyFields.filter(
      (field) => !review?.checks.some((check) => check.field === field),
    );
    const premium = valid ? current?.candidate.facts.premium : null;
    const factor =
      premium && !["once", "unknown"].includes(premium.period)
        ? (({ month: 12, quarter: 4, half_year: 2, year: 1 } as Partial<Record<string, number>>)[
            premium.period
          ] ?? null)
        : null;
    const annual = premium?.currency === "CHF" && factor ? premium.amountMinor * factor : null;
    const difference =
      valid && !!offer.reviewedAt && annual !== null && offer.annualPremiumMinor !== null
        ? annual - offer.annualPremiumMinor
        : null;
    const conclusion = await readConclusionEvidence(db, lead, row.offer_id);
    items.push(
      finalPolicySchema.parse({
        id: row.id,
        offer: {
          id: offer.id,
          version: offer.version,
          company: offer.company,
          product: offer.product,
          active: offer.active,
          sourceStatus: offer.sourceStatus,
        },
        documentId: row.document_id,
        linkedAt: date(row.created_at),
        withdrawnAt: date(row.withdrawn_at),
        active: row.active,
        status,
        source: status === "available" ? current!.candidate : null,
        review,
        reviewState: !valid
          ? "invalidated"
          : (difference !== null && difference !== 0) ||
              review?.checks.some((check) => check.result === "difference")
            ? "differences"
            : !review ||
                missingChecks.length ||
                review.checks.some((check) => check.result === "to_verify")
              ? "to_verify"
              : "checked",
        missingChecks,
        premium: {
          offerAnnualMinor: valid ? offer.annualPremiumMinor : null,
          policyAnnualMinor: annual,
          factor,
          differenceMinor: difference,
        },
        signatureEvidence: conclusion.signatureEvidence,
        insurerAcceptanceEvidence: conclusion.insurerAcceptanceEvidence,
        canDownload: status === "available",
        canReview: valid && canReview,
      }),
    );
  }
  const last = rows[19];
  return {
    items,
    nextCursor:
      rows.length > 20 && last
        ? Buffer.from(
            JSON.stringify({ leadId: lead.id, at: date(last.created_at), id: last.id }),
          ).toString("base64url")
        : null,
  };
}

export async function executeFinalPolicyCommand(
  tx: PoolClient,
  actor: PartnerActor,
  rawLead: Subject,
  input: LeadCommand,
) {
  const lead = await lockContractSubject(tx, rawLead);
  if (actor.wallet && actor.userId !== lead.clientUserId) fail("PARTNER_ACCESS_DENIED", 403);
  if (input.action === "final_policy_link") {
    if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
    const offer = (
      await tx.query<{ document_id: string; source_snapshot: unknown }>(
        "select document_id,source_snapshot from partner_offers where id=$1 and lead_id=$2 and published_at is not null for share",
        [input.offerId, lead.id],
      )
    ).rows[0];
    if (!offer) return fail("PARTNER_NOT_FOUND", 404);
    await requireOfferSource(tx, offer.document_id, offer.source_snapshot);
    // Serialize sharing of one canonical original even across different Leads.
    await tx.query("select id from files where id=$1 for update", [input.documentId]);
    const source = (
      await readContractCandidates(
        tx,
        lead.clientUserId,
        lead.clientProfileId,
        input.documentId,
        true,
      )
    ).entries[0];
    if (!source || input.documentId === offer.document_id) fail("PARTNER_INVALID_DOCUMENT");
    if (source.candidate.fingerprint !== input.fingerprint) fail("PARTNER_CONFLICT", 409);
    const prior = (
      await tx.query<PolicyRow>(
        "select * from partner_final_policies where active and (offer_id=$1 or document_id=$2) for update",
        [input.offerId, input.documentId],
      )
    ).rows;
    if (prior.some((row) => row.offer_id !== input.offerId)) fail("PARTNER_CONFLICT", 409);
    if (
      prior.some(
        (row) => row.document_id === input.documentId && row.fingerprint === input.fingerprint,
      )
    )
      return;
    for (const row of prior) {
      await tx.query(
        "update partner_final_policies set active=false,withdrawn_at=now() where id=$1",
        [row.id],
      );
      await event(tx, actor, lead.id, "policy.withdrawn", "", "client", row.id);
    }
    await retainContractReference(tx, input.documentId);
    const id = newId("pfp");
    await tx.query(
      "insert into partner_final_policies(id,lead_id,offer_id,document_id,fingerprint,source_snapshot,confirmed_by) values($1,$2,$3,$4,$5,$6,$7)",
      [
        id,
        lead.id,
        input.offerId,
        input.documentId,
        input.fingerprint,
        JSON.stringify(source),
        actor.userId,
      ],
    );
    await event(tx, actor, lead.id, "policy.linked", "", "client", id);
  } else if (input.action === "final_policy_unlink") {
    if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
    if (
      !(
        await tx.query(
          "update partner_final_policies set active=false,withdrawn_at=now() where id=$1 and lead_id=$2 and active returning id",
          [input.policyId, lead.id],
        )
      ).rowCount
    )
      fail("PARTNER_CONFLICT", 409);
    await event(tx, actor, lead.id, "policy.withdrawn", "", "client", input.policyId);
  } else if (input.action === "final_policy_review") {
    if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
    const review = finalPolicyReviewSchema.parse(input.review);
    const row = (
      await tx.query<PolicyRow>(
        "select * from partner_final_policies where id=$1 and lead_id=$2 and active for update",
        [review.policyId, lead.id],
      )
    ).rows[0];
    if (!row) return fail("PARTNER_CONFLICT", 409);
    const source = (
      await readContractCandidates(
        tx,
        lead.clientUserId,
        lead.clientProfileId,
        row.document_id,
        true,
      )
    ).entries[0];
    if (!source || source.candidate.fingerprint !== row.fingerprint)
      return fail("PARTNER_CONFLICT", 409);
    const offer = (
      await tx.query<{ document_id: string; source_snapshot: unknown }>(
        "select document_id,source_snapshot from partner_offers where id=$1 and lead_id=$2 for share",
        [row.offer_id, lead.id],
      )
    ).rows[0]!;
    const offerSource = await requireOfferSource(tx, offer.document_id, offer.source_snapshot);
    const policySnapshot = snapshotSchema.parse(row.source_snapshot);
    const offerAnalysis = documentAnalysisSchema.safeParse(offerSource.analysis);
    for (const check of review.checks) {
      for (const [citation, analysis] of [
        [check.offerSource, offerAnalysis.success ? offerAnalysis.data : null],
        [check.policySource, policySnapshot.analysis],
      ] as const) {
        if (
          citation &&
          !analysis?.pages.some(
            (page) => page.page === citation.page && page.text.includes(citation.quote),
          )
        )
          fail("PARTNER_INVALID_DOCUMENT");
      }
    }
    const version = (
      await tx.query<{ next: number }>(
        "select coalesce(max(version),0)+1 next from partner_final_policy_reviews where policy_id=$1",
        [row.id],
      )
    ).rows[0]!.next;
    await tx.query(
      "insert into partner_final_policy_reviews(id,policy_id,version,checks,reviewed_by) values($1,$2,$3,$4,$5)",
      [newId("pfpr"), row.id, version, JSON.stringify(review.checks), actor.userId],
    );
    await event(tx, actor, lead.id, "policy.reviewed", "", "client", row.id);
  }
}
