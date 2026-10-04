import {
  solutionEvidenceSchema,
  type SolutionEvidenceQuery,
  type PartnerApplication,
} from "@coverview/contracts/partner";
import { readOffers } from "./partner.offers.js";
import { readSolutionConventionEvidence } from "./partner.convention.js";
import { readPersonalNeedContext, type PersonalNeedTarget } from "./partner.need-context.js";
import { fail, type Executor, type PartnerActor } from "./partner.policy.js";

// Read-only evidence: exact offer, explicit exploratory company, no identity matching.
export async function readSolutionEvidence(
  db: Executor,
  actor: PartnerActor,
  lead: PersonalNeedTarget,
  member: PartnerApplication | null,
  offerId: string,
  query: SolutionEvidenceQuery,
  assessedAt: string,
  documentsAvailable: boolean,
) {
  const context = await readPersonalNeedContext(db, actor, lead, member);
  const offer = (
    await readOffers(db, lead.id, false, { offerId, assessedAt: Date.parse(assessedAt) })
  ).items[0];
  if (!offer) return fail("PARTNER_NOT_FOUND", 404);
  return solutionEvidenceSchema.parse({
    version: 1,
    leadId: lead.id,
    advisorId: actor.userId,
    assessedAt,
    scope: context.preferences.scope,
    scopeRevision: lead.adviceScopeRevision,
    changeRequested: context.changeRequested,
    assessment: "human_review_required",
    offer: {
      id: offer.id,
      version: offer.version,
      company: offer.company,
      product: offer.product,
      reference: offer.reference,
      active: offer.active,
      state: offer.state,
      reviewedAt: offer.reviewedAt,
      createdAt: offer.createdAt,
      validUntil: offer.validUntil,
      sourceStatus: documentsAvailable ? offer.sourceStatus : "disabled",
      sourceGeneration: offer.sourceGeneration ?? null,
      validity: !offer.validUntil
        ? "undated"
        : Date.parse(offer.validUntil) <= Date.parse(assessedAt)
          ? "expired"
          : "unexpired",
      canDownload: documentsAvailable && !!offer.canDownload,
    },
    companyId: query.companyId ?? null,
    companyMatch: "unconfirmed",
    remainingChecks: [
      "company_identity",
      "product_scope",
      "client_admission",
      "distribution_rights",
      "economic_agreement",
    ],
    convention: query.companyId
      ? await readSolutionConventionEvidence(
          db,
          actor.userId,
          lead.category,
          query.companyId,
          member,
          assessedAt,
          documentsAvailable,
        )
      : null,
  });
}
