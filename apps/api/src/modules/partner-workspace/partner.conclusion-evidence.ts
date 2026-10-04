import { finalPolicyFields, finalPolicyReviewSchema } from "@coverview/contracts/partner";
import { conclusionHistory } from "./partner.conclusion-history.js";
import { readConclusionCorrespondence } from "./partner.correspondence.js";
import { readContractCandidates } from "../document-intelligence/index.js";
import { lockContractSubject } from "./partner.contract.js";
import { readOffers, requireOfferSource } from "./partner.offers.js";
import type { Executor } from "./partner.policy.js";

type Subject = { id: string; clientUserId: string | null; clientProfileId: string | null };
// Legacy catalogues cannot contain this proof. Absence is never converted into success.
export async function readConclusionEvidence(
  db: Executor,
  rawLead: Subject,
  offerId: string,
  lock = false,
) {
  const absent = {
    signatureEvidence: "missing" as const,
    insurerAcceptanceEvidence: "missing" as const,
    issued: false,
    settled: false,
  };
  if (
    !(
      await db.query<{ table: string | null }>(
        "select to_regclass('partner_conclusions')::text as table",
      )
    ).rows[0]?.table
  )
    return absent;
  const lead = await lockContractSubject(db, rawLead);
  const row = (
    await db.query<{ id: string; invalidated_at: Date | null; content_hash: string }>(
      `select c.* from partner_conclusions c join partner_offer_signatures s on s.conclusion_id=c.id
     where c.lead_id=$1 and c.offer_id=$2 and c.owner_id=$3 and c.subject_key=$4 order by c.created_at desc,c.id desc limit 1`,
      [
        lead.id,
        offerId,
        lead.clientUserId,
        lead.clientProfileId ? `profile:${lead.clientProfileId}` : `self:${lead.clientUserId}`,
      ],
    )
  ).rows[0];
  if (!row) return absent;
  const invalid = {
    signatureEvidence: "invalidated" as const,
    insurerAcceptanceEvidence: "invalidated" as const,
    issued: false,
    settled: false,
  };
  const offer = (await readOffers(db, lead.id, true, { offerId })).items[0];
  if (row.invalidated_at || !offer || offer.sourceStatus !== "current" || !offer.active)
    return invalid;
  if (lock) {
    const source = (
      await db.query<{ source_snapshot: unknown }>(
        "select source_snapshot from partner_offers where id=$1 for share",
        [offerId],
      )
    ).rows[0]!;
    await requireOfferSource(db, offer.documentId, source.source_snapshot);
  }
  const signed = { ...absent, signatureEvidence: "traced" as const };
  const rows = (
    await db.query<{ id: string; input: unknown }>(
      "select id,input from partner_conclusion_actions where conclusion_id=$1 order by revision limit 101",
      [row.id],
    )
  ).rows;
  if (rows.length > 100) return invalid;
  const actions = conclusionHistory(rows).active.map((r) => r.input);
  const decisions = actions.filter(
    (a) => a.action === "accepted" || a.action === "declined" || a.action === "issued",
  );
  if (!decisions.length) return signed;
  for (const action of decisions) {
    if (!("fingerprint" in action)) continue;
    if (action.correspondenceId) {
      const proof = await readConclusionCorrespondence(db, lead, action.correspondenceId, lock);
      if (
        !proof?.source ||
        proof.source.source.fingerprint !== action.fingerprint ||
        action.action === "issued"
      )
        return { ...signed, insurerAcceptanceEvidence: "invalidated" as const };
      continue;
    }
    const policy = (
      await db.query<{ document_id: string; fingerprint: string }>(
        "select document_id,fingerprint from partner_final_policies where id=$1 and lead_id=$2 and offer_id=$3 and active",
        [action.policyId, lead.id, offerId],
      )
    ).rows[0];
    if (!policy || policy.fingerprint !== action.fingerprint)
      return { ...signed, insurerAcceptanceEvidence: "invalidated" as const };
    const source = (
      await readContractCandidates(
        db,
        lead.clientUserId,
        lead.clientProfileId,
        policy.document_id,
        lock,
      )
    ).entries[0];
    if (!source || source.candidate.fingerprint !== action.fingerprint)
      return { ...signed, insurerAcceptanceEvidence: "invalidated" as const };
    if (action.action === "issued") {
      const review = (
        await db.query<{ checks: unknown }>(
          "select checks from partner_final_policy_reviews where policy_id=$1 order by version desc limit 1",
          [action.policyId],
        )
      ).rows[0];
      const checks = review
        ? finalPolicyReviewSchema.parse({ policyId: action.policyId, checks: review.checks }).checks
        : [];
      if (checks.length !== finalPolicyFields.length || checks.some((c) => c.result !== "same"))
        return { ...signed, insurerAcceptanceEvidence: "invalidated" as const };
      const premium = source.candidate.facts.premium;
      const factors: Partial<Record<string, number>> = {
        month: 12,
        quarter: 4,
        half_year: 2,
        year: 1,
      };
      const factor = premium ? factors[premium.period] : undefined;
      if (
        !premium ||
        !factor ||
        premium.currency !== "CHF" ||
        premium.amountMinor * factor !== offer.annualPremiumMinor
      )
        return { ...signed, insurerAcceptanceEvidence: "invalidated" as const };
    }
  }
  return {
    ...signed,
    insurerAcceptanceEvidence: "documented" as const,
    issued: decisions.at(-1)?.action === "issued",
    settled: ["issued", "declined"].includes(decisions.at(-1)?.action ?? ""),
  };
}

export async function conclusionClosureReady(db: Executor, rawLead: Subject) {
  if (
    !(
      await db.query<{ table: string | null }>(
        "select to_regclass('partner_conclusions')::text as table",
      )
    ).rows[0]?.table
  )
    return false;
  const lead = await lockContractSubject(db, rawLead);
  const rows = (
    await db.query<{ offer_id: string }>(
      `select offer_id from partner_conclusions c
    where lead_id=$1 and owner_id=$2 and subject_key=$3 and withdrawn_at is null and invalidated_at is null
    and (valid_until>now() or exists(select 1 from partner_offer_signatures s where s.conclusion_id=c.id))
    order by c.id limit 101 for share of c`,
      [
        lead.id,
        lead.clientUserId,
        lead.clientProfileId ? `profile:${lead.clientProfileId}` : `self:${lead.clientUserId}`,
      ],
    )
  ).rows;
  if (!rows.length || rows.length > 100) return false;
  let issued = false;
  for (const row of rows) {
    const proof = await readConclusionEvidence(db, lead, row.offer_id, true);
    if (!proof.settled) return false;
    issued ||= proof.issued;
  }
  return issued;
}
