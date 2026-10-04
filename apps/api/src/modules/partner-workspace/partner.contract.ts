import type { PoolClient } from "pg";
import {
  currentContractSchema,
  contractReviewInputSchema,
  type CurrentContract,
  type LeadCommand,
  type LeadOffer,
  type ContractComparison,
} from "@coverview/contracts/partner";
import { readContractCandidates, retainContractReference } from "../document-intelligence/index.js";
import { fail, type Executor, type PartnerActor } from "./partner.policy.js";
import { newId, event } from "./partner.audit.js";

type Subject = { id: string; clientUserId: string | null; clientProfileId: string | null };
export async function lockContractSubject(db: Executor, lead: Subject) {
  if (!lead.clientUserId) return fail("PARTNER_INVALID_CLIENT");
  const result = lead.clientProfileId
    ? await db.query<{ user_id: string }>(
        "select user_id from managed_profiles where id=$1 for share",
        [lead.clientProfileId],
      )
    : await db.query<{ user_id: string }>(
        "select user_id from identity_profiles where user_id=$1 for share",
        [lead.clientUserId],
      );
  if (!result.rows[0]) return fail("PARTNER_INVALID_CLIENT");
  return { ...lead, clientUserId: result.rows[0].user_id };
}
export async function readCurrentContract(
  db: Executor,
  lead: Subject,
): Promise<CurrentContract | null> {
  const reference = (
    await db.query<{
      id: string;
      document_id: string;
      fingerprint: string;
      created_at: Date;
    }>(
      "select id,document_id,fingerprint,created_at from partner_contract_references where lead_id=$1 and active",
      [lead.id],
    )
  ).rows[0];
  if (!reference) return null;
  const source = lead.clientUserId
    ? ((
        await readContractCandidates(
          db,
          lead.clientUserId,
          lead.clientProfileId,
          reference.document_id,
        )
      ).entries[0]?.candidate ?? null)
    : null;
  const available = source?.fingerprint === reference.fingerprint;
  const review = available
    ? (
        await db.query<{
          version: number;
          premium_verified: boolean;
          features: unknown;
        }>(
          "select version,premium_verified,features from partner_contract_reviews where reference_id=$1 order by version desc limit 1",
          [reference.id],
        )
      ).rows[0]
    : null;
  return currentContractSchema.parse({
    referenceId: reference.id,
    documentId: reference.document_id,
    fingerprint: reference.fingerprint,
    confirmedAt: reference.created_at.toISOString(),
    status: available ? "available" : source ? "source_changed" : "unavailable",
    source: available ? source : null,
    reviewVersion: review?.version ?? 0,
    premiumVerified: review?.premium_verified ?? false,
    features: review?.features ?? [],
  });
}
export async function executeContractCommand(
  tx: PoolClient,
  actor: PartnerActor,
  rawLead: Subject,
  input: LeadCommand,
) {
  const lead = await lockContractSubject(tx, rawLead);
  if (actor.wallet && actor.userId !== lead.clientUserId) fail("PARTNER_ACCESS_DENIED", 403);
  if (input.action === "contract_link") {
    if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
    const selected = (
      await readContractCandidates(
        tx,
        lead.clientUserId,
        lead.clientProfileId,
        input.documentId,
        true,
      )
    ).entries[0];
    if (!selected) fail("PARTNER_INVALID_DOCUMENT");
    if (selected.candidate.fingerprint !== input.fingerprint) fail("PARTNER_CONFLICT", 409);
    const existing = await readCurrentContract(tx, lead);
    if (existing?.documentId === input.documentId && existing.fingerprint === input.fingerprint)
      return;
    await tx.query(
      "update partner_contract_references set active=false where lead_id=$1 and active",
      [lead.id],
    );
    await retainContractReference(tx, input.documentId);
    await tx.query(
      "insert into partner_contract_references(id,lead_id,document_id,fingerprint,confirmed_by) values($1,$2,$3,$4,$5)",
      [newId("pcref"), lead.id, input.documentId, input.fingerprint, actor.userId],
    );
    await event(tx, actor, lead.id, "contract.linked", "", "client");
  } else if (input.action === "contract_unlink") {
    if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
    const updated = await tx.query(
      "update partner_contract_references set active=false where lead_id=$1 and id=$2 and active returning id",
      [lead.id, input.referenceId],
    );
    if (!updated.rowCount) fail("PARTNER_CONFLICT", 409);
    await event(tx, actor, lead.id, "contract.unlinked", "", "client");
  } else if (input.action === "contract_review") {
    if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
    const review = contractReviewInputSchema.parse(input.review);
    const current = await readCurrentContract(tx, lead);
    if (!current || current.referenceId !== review.referenceId || current.status !== "available")
      fail("PARTNER_CONFLICT", 409);
    const source = (
      await readContractCandidates(
        tx,
        lead.clientUserId,
        lead.clientProfileId,
        current.documentId,
        true,
      )
    ).entries[0];
    if (!source || source.candidate.fingerprint !== current.fingerprint)
      fail("PARTNER_CONFLICT", 409);
    if (review.premiumVerified && !source.candidate.facts.premium) fail("PARTNER_ACTION_REQUIRED");
    // Human annotations must point to a quote actually present in this exact analysis version.
    for (const feature of review.features) {
      if (feature.verification === "missing") {
        if (feature.coverage !== "unknown" || feature.value || feature.quote || feature.limit)
          fail("PARTNER_ACTION_REQUIRED");
      } else if (
        !feature.page ||
        !feature.quote ||
        !source.analysis.pages.some(
          (page) => page.page === feature.page && page.text.includes(feature.quote),
        )
      ) {
        fail("PARTNER_INVALID_DOCUMENT");
      }
    }
    await tx.query(
      "insert into partner_contract_reviews(id,reference_id,version,premium_verified,features,reviewed_by) values($1,$2,$3,$4,$5,$6)",
      [
        newId("pcreview"),
        current.referenceId,
        current.reviewVersion + 1,
        review.premiumVerified,
        JSON.stringify(review.features),
        actor.userId,
      ],
    );
    await event(tx, actor, lead.id, "contract.reviewed", "", "client");
  }
}

// Annual CHF premium of the current contract: month ×12, quarter ×4, half-year ×2, year ×1.
// A single, unknown or foreign-currency premium has no annual amount.
export function currentAnnualFactor(current: CurrentContract) {
  const premium = current.source?.facts.premium;
  return premium && premium.period !== "once" && premium.period !== "unknown"
    ? { month: 12, quarter: 4, half_year: 2, year: 1 }[premium.period]
    : null;
}
export function currentAnnualPremium(current: CurrentContract) {
  const premium = current.source?.facts.premium,
    factor = currentAnnualFactor(current);
  return premium?.currency === "CHF" && factor ? premium.amountMinor * factor : null;
}

export function compareCurrentContract(
  current: CurrentContract | null,
  offers: LeadOffer[],
): ContractComparison[] {
  if (!current) return [];
  return offers
    .filter((offer) => offer.active && !["cancelled", "replaced", "expired"].includes(offer.state))
    .map((offer) => {
      const factor = currentAnnualFactor(current);
      const annual = currentAnnualPremium(current);
      const offerVerified =
        offer.canCompare === true &&
        !!offer.reviewedAt &&
        (!offer.validUntil || new Date(offer.validUntil).getTime() > Date.now());
      const ready = current.status === "available" && current.premiumVerified && offerVerified;
      const featureKey = (feature: { key: string; label: string }) =>
        feature.key === "other" ? `other:${feature.label.trim().toLowerCase()}` : feature.key;
      const keys = [
        ...new Set([...current.features.map(featureKey), ...offer.features.map(featureKey)]),
      ];
      return {
        offerId: offer.id,
        offerVersion: offer.version,
        currentAnnualMinor: annual,
        annualFactor: factor,
        annualDifferenceMinor:
          ready && annual !== null && offer.annualPremiumMinor !== null
            ? offer.annualPremiumMinor - annual
            : null,
        premiumStatus:
          current.status !== "available"
            ? "unavailable"
            : annual === null || offer.annualPremiumMinor === null
              ? "missing"
              : ready
                ? "calculated"
                : "to_verify",
        rows: keys.map((key) => {
          const before = current.features.find((f) => featureKey(f) === key) ?? null;
          const matches = offer.features.filter((f) => featureKey(f) === key);
          const after = matches.length === 1 ? matches[0]! : null;
          const proposed = after
            ? {
                ...after,
                exclusions: after.exclusions ?? "",
                coverage: after.coverage ?? "unknown",
                page: after.sourcePage ?? null,
              }
            : null;
          let change: ContractComparison["rows"][number]["change"] = "missing";
          if (
            before &&
            proposed &&
            before.verification !== "missing" &&
            proposed.verification !== "missing"
          ) {
            change =
              current.status !== "available" ||
              !offerVerified ||
              before.verification !== "verified" ||
              proposed.verification !== "verified" ||
              !proposed.source ||
              proposed.origin === "calculated"
                ? "to_verify"
                : before.coverage === "excluded" && proposed.coverage === "included"
                  ? "gain"
                  : before.coverage === "included" && proposed.coverage === "excluded"
                    ? "loss"
                    : before.value === proposed.value &&
                        before.conditions === proposed.conditions &&
                        before.exclusions === proposed.exclusions &&
                        before.coverage === proposed.coverage
                      ? "same"
                      : "changed";
          }
          return {
            key,
            label: before?.label ?? after?.label ?? key,
            current: before,
            proposed,
            change,
          };
        }),
      };
    });
}
