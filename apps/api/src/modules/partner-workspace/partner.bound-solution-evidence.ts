import {
  boundSolutionEvidenceSchema,
  type PartnerApplication,
  type SolutionEvidenceQuery,
} from "@coverview/contracts/partner";
import { readSolutionBinding } from "./partner.solution-binding.js";
import { readSolutionConventionEvidence } from "./partner.convention.js";
import type { PersonalNeedTarget } from "./partner.need-context.js";
import type { Executor, PartnerActor } from "./partner.policy.js";

// The caller supplies one authorized repeatable-read snapshot and its timestamp.
// A human commercial association is evidence of a choice, never verified legal identity.
export async function readBoundSolutionEvidence(
  db: Executor,
  actor: PartnerActor,
  lead: PersonalNeedTarget,
  member: PartnerApplication | null,
  offerId: string,
  query: SolutionEvidenceQuery,
  assessedAt: string,
  documentsAvailable: boolean,
) {
  const { dossier } = await readSolutionBinding(
    db,
    actor,
    lead,
    member,
    offerId,
    assessedAt,
    documentsAvailable,
  );
  const current = dossier.status === "recorded" ? dossier.current : null;
  const companyId = query.companyId ?? null;
  return boundSolutionEvidenceSchema.parse({
    version: 2,
    leadId: lead.id,
    advisorId: actor.userId,
    assessedAt,
    scope: dossier.scope,
    scopeRevision: lead.adviceScopeRevision,
    changeRequested: dossier.changeRequested,
    assessment: "human_review_required",
    offer: dossier.offer,
    companyId,
    companyMatch: "unconfirmed",
    selection: !companyId
      ? "not_selected"
      : !current
        ? "no_current_binding"
        : !current.companyId
          ? "binding_without_company"
          : companyId === current.companyId
            ? "human_match"
            : "different_company",
    binding: { status: dossier.status, revision: dossier.revision, current },
    legalIdentity: "unverified",
    productIdentity: "unverified",
    clauseEvidence: "not_structured",
    remainingChecks: [
      "company_identity",
      "product_scope",
      "client_admission",
      "distribution_rights",
      "economic_agreement",
    ],
    convention: companyId
      ? await readSolutionConventionEvidence(
          db,
          actor.userId,
          lead.category,
          companyId,
          member,
          assessedAt,
          documentsAvailable,
        )
      : null,
  });
}
