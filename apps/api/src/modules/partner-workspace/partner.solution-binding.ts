import { createHash } from "node:crypto";
import { documentAnalysisSchema } from "@coverview/contracts";
import {
  solutionBindingDossierSchema,
  solutionBindingFields,
  solutionMentionReferencesSchema,
  type SolutionBindingInput,
  type PartnerApplication,
} from "@coverview/contracts/partner";
import { leadSourceSnapshotSchema } from "../document-intelligence/index.js";
import { readSolutionEvidence } from "./partner.solution-evidence.js";
import {
  readPersonalNeedContext,
  personalNeedSubject,
  type PersonalNeedTarget,
} from "./partner.need-context.js";
import { context, lockActor, fail, type Executor, type PartnerActor } from "./partner.policy.js";
import { event, newId } from "./partner.audit.js";

type Row = {
  revision: number;
  subject_key: string;
  scope_fingerprint: string;
  action: "record" | "withdraw";
  company_id: string | null;
  mentions: unknown;
  source_reference: unknown;
  reason: string;
  valid_until: Date | null;
  created_at: Date;
  scope: unknown;
};

// Caller holds the current personal audience, actor/member/Lead locks. Locking the canonical
// profile precedes the original. A fresh statement after its lock sees committed corrections.
export async function readSolutionBinding(
  db: Executor,
  actor: PartnerActor,
  lead: PersonalNeedTarget,
  member: PartnerApplication | null,
  offerId: string,
  assessedAt: string,
  documentsAvailable: boolean,
  beforeRevision?: number,
  lockSource = false,
  sourcePage?: number,
) {
  const need = await readPersonalNeedContext(db, actor, lead, member);
  const row = (
    await db.query<{ document_id: string; source_snapshot: unknown; version: number }>(
      "select document_id,source_snapshot,version from partner_offers where id=$1 and lead_id=$2",
      [offerId, lead.id],
    )
  ).rows[0];
  if (!row) return fail("PARTNER_NOT_FOUND", 404);
  if (lockSource) await db.query("select id from files where id=$1 for share", [row.document_id]);
  const file = (
    await db.query<{ revision: number }>("select revision from files where id=$1", [
      row.document_id,
    ])
  ).rows[0];
  if (lockSource) {
    assessedAt = (
      await db.query<{ at: Date }>("select clock_timestamp() at")
    ).rows[0]!.at.toISOString();
    await lockActor(db, actor);
    if (!(await context(db, actor)).canAdvise) fail("PARTNER_ACCESS_DENIED", 403);
  }
  const evidence = await readSolutionEvidence(
    db,
    actor,
    lead,
    member,
    offerId,
    {},
    assessedAt,
    documentsAvailable,
  );
  const stored = leadSourceSnapshotSchema.safeParse(row.source_snapshot);
  const source =
    stored.success && file
      ? {
          documentId: row.document_id,
          generation: stored.data.generation,
          documentRevision: file.revision,
          reviewRevision: stored.data.reviewRevision,
          fingerprint: stored.data.fingerprint,
        }
      : null;
  const analysis = documentAnalysisSchema.safeParse(stored.success ? stored.data.analysis : null);
  const canReadMentions =
    documentsAvailable && evidence.offer.sourceStatus === "current" && analysis.success;
  const canRecord =
    !!source &&
    canReadMentions &&
    analysis.success &&
    analysis.data.pages.some((page) => page.text.trim().length > 0) &&
    !need.changeRequested &&
    evidence.offer.active &&
    evidence.offer.validity !== "expired" &&
    !["cancelled", "replaced", "expired", "refused"].includes(evidence.offer.state);
  const scopeFingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        ...need.fingerprintBasis,
        source,
        offer: [offerId, row.version, evidence.offer.active],
      }),
    )
    .digest("hex");
  const previous = (
    await db.query<Row>(
      "select * from partner_solution_bindings where user_id=$1 and offer_id=$2 order by revision desc limit 1",
      [actor.userId, offerId],
    )
  ).rows[0];
  const current = previous?.subject_key === personalNeedSubject(lead) ? previous : null;
  const history = (
    await db.query<Row>(
      `select * from partner_solution_bindings where user_id=$1 and offer_id=$2 and subject_key=$3
     and ($4::int is null or revision<$4) order by revision desc limit 21`,
      [actor.userId, offerId, personalNeedSubject(lead), beforeRevision ?? null],
    )
  ).rows;
  const record = (entry: Row) => {
    const reference = solutionBindingDossierSchema.shape.source.parse(entry.source_reference);
    const references =
      entry.mentions === null ? null : solutionMentionReferencesSchema.parse(entry.mentions);
    const available =
      !!references &&
      canReadMentions &&
      !!source &&
      !!reference &&
      source.fingerprint === reference.fingerprint &&
      source.documentId === reference.documentId &&
      source.documentRevision === reference.documentRevision;
    // Resolve only the exact still-authorized source; never expose a copied stale excerpt.
    const mentions = available
      ? Object.fromEntries(
          solutionBindingFields.map((field) => {
            const pointer = references[field];
            const page =
              pointer && analysis.success
                ? analysis.data.pages.find((p) => p.page === pointer.page)
                : null;
            if (pointer && (!page || pointer.end > page.text.length))
              return fail("PARTNER_INVALID_DOCUMENT");
            return [
              field,
              pointer && page
                ? { page: pointer.page, quote: page.text.slice(pointer.start, pointer.end) }
                : null,
            ];
          }),
        )
      : null;
    return {
      revision: entry.revision,
      action: entry.action,
      companyId: entry.company_id,
      reason: entry.reason,
      validUntil: entry.valid_until?.toISOString() ?? null,
      recordedAt: entry.created_at.toISOString(),
      scope: entry.scope,
      source: reference,
      mentionsAvailable: available,
      mentions,
    };
  };
  const status = !current
    ? "missing"
    : current.action === "withdraw"
      ? "withdrawn"
      : current.scope_fingerprint !== scopeFingerprint || !canRecord
        ? "review_required"
        : current.valid_until! <= new Date(assessedAt)
          ? "expired"
          : "recorded";
  return {
    dossier: solutionBindingDossierSchema.parse({
      leadId: lead.id,
      advisorId: actor.userId,
      assessedAt,
      scope: evidence.scope,
      scopeFingerprint,
      changeRequested: need.changeRequested,
      offer: evidence.offer,
      source,
      sourcePages:
        canReadMentions && analysis.success ? analysis.data.pages.map((p) => p.page) : [],
      sourcePage:
        canReadMentions && analysis.success
          ? (analysis.data.pages.find(
              (p) => p.page === (sourcePage ?? analysis.data.pages[0]?.page),
            ) ?? null)
          : null,
      revision: previous?.revision ?? 0,
      canRecord,
      canWithdraw: current?.action === "record",
      status,
      current: current ? record(current) : null,
      history: history.slice(0, 20).map(record),
      nextBeforeRevision: history.length > 20 ? history[19]!.revision : null,
      legalIdentity: "unverified",
      productIdentity: "unverified",
      assessment: "human_review_required",
    }),
    analysis: canReadMentions && analysis.success ? analysis.data : null,
  };
}

export async function recordSolutionBinding(
  db: Executor,
  actor: PartnerActor,
  lead: PersonalNeedTarget,
  member: PartnerApplication | null,
  offerId: string,
  input: SolutionBindingInput,
  documentsAvailable: boolean,
) {
  const { dossier: current, analysis } = await readSolutionBinding(
    db,
    actor,
    lead,
    member,
    offerId,
    new Date().toISOString(),
    documentsAvailable,
    undefined,
    true,
  );
  if (input.revision !== current.revision || input.scopeFingerprint !== current.scopeFingerprint)
    fail("PARTNER_CONFLICT", 409);
  if (input.action === "withdraw" ? !current.canWithdraw : !current.canRecord)
    fail("PARTNER_ACTION_REQUIRED");
  if (
    input.validUntil &&
    current.offer.validUntil &&
    Date.parse(input.validUntil) > Date.parse(current.offer.validUntil)
  )
    fail("PARTNER_ACTION_REQUIRED");
  const references = input.mentions
    ? Object.fromEntries(
        solutionBindingFields.map((field) => {
          const mention = input.mentions![field];
          if (!mention) return [field, null];
          const page = analysis?.pages.find((p) => p.page === mention.page);
          const start = page?.text.indexOf(mention.quote) ?? -1;
          if (!page || start < 0 || page.text.indexOf(mention.quote, start + 1) !== -1)
            return fail("PARTNER_INVALID_DOCUMENT");
          return [field, { page: mention.page, start, end: start + mention.quote.length }];
        }),
      )
    : null;
  if (references) solutionMentionReferencesSchema.parse(references);
  const id = newId("psolution");
  const inserted = await db.query(
    `insert into partner_solution_bindings
     (id,lead_id,offer_id,user_id,organization_id,subject_key,revision,scope_fingerprint,scope,source_reference,action,company_id,mentions,reason,valid_until,created_at)
     select $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,clock_timestamp()
     where $11='withdraw' or $15::timestamptz>clock_timestamp() returning id`,
    [
      id,
      lead.id,
      offerId,
      actor.userId,
      member?.organizationId ?? null,
      personalNeedSubject(lead),
      input.revision + 1,
      current.scopeFingerprint,
      JSON.stringify(current.scope),
      current.source ? JSON.stringify(current.source) : null,
      input.action,
      input.companyId,
      references ? JSON.stringify(references) : null,
      input.reason,
      input.validUntil,
    ],
  );
  if (!inserted.rowCount) fail("PARTNER_ACTION_REQUIRED");
  await event(
    db,
    actor,
    null,
    input.action === "record" ? "solution_binding.recorded.v1" : "solution_binding.withdrawn.v1",
    "",
    "private",
    id,
  );
  return lead.id;
}
