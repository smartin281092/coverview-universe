import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { documentAnalysisSchema } from "@coverview/contracts";
import {
  conclusionActionSchema,
  conclusionArchiveSchema,
  conclusionPrepareSchema,
  conclusionSchema,
  conclusionSignSchema,
  conclusionsSchema,
  type ConclusionAction,
  type ConclusionPrepare,
  type ConclusionSign,
} from "@coverview/contracts/partner-conclusion";
import { readContractCandidates } from "../document-intelligence/index.js";
import { contextForApplication, membership, fail, type PartnerActor } from "./partner.policy.js";
import {
  economyCursor,
  economyNext,
  economyRead,
  type EconomyMutation,
} from "./partner.commercial.js";
import { lockContractSubject } from "./partner.contract.js";
import { readOffers, requireOfferSource } from "./partner.offers.js";
import { readFinalPolicies } from "./partner.final-policy.js";
import { readConclusionCorrespondence } from "./partner.correspondence.js";
import { conclusionHistory } from "./partner.conclusion-history.js";
import { event, newId } from "./partner.audit.js";
import type { partnerLeads } from "./partner.schema.js";

type Lead = typeof partnerLeads.$inferSelect;
type Access = (
  tx: PoolClient,
  actor: PartnerActor,
  id: string,
) => Promise<{ lead: Lead; canManage: boolean }>;
type Row = {
  id: string;
  lead_id: string;
  offer_id: string;
  owner_id: string;
  subject_key: string;
  author_id: string;
  context: string;
  archive: unknown;
  content_hash: string;
  valid_until: Date;
  withdrawn_at: Date | null;
  invalidated_at: Date | null;
  created_at: Date;
};
type ActionRow = {
  id: string;
  actor_id: string;
  revision: number;
  input: unknown;
  created_at: Date;
};
const subject = (lead: Lead) =>
  lead.clientProfileId ? `profile:${lead.clientProfileId}` : `self:${lead.clientUserId}`;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function cited(analysis: unknown, citation: { page: number; quote: string }) {
  const parsed = documentAnalysisSchema.safeParse(analysis);
  return (
    parsed.success &&
    parsed.data.pages.some((p) => p.page === citation.page && p.text.includes(citation.quote))
  );
}

export function createConclusionOperations(
  pool: Pool,
  transaction: EconomyMutation,
  access: Access,
) {
  async function storage(tx: PoolClient) {
    if (
      !(
        await tx.query<{ table: string | null }>(
          "select to_regclass('partner_conclusions')::text as table",
        )
      ).rows[0]?.table
    )
      fail("PARTNER_UNAVAILABLE", 503);
  }
  async function leadAccess(tx: PoolClient, actor: PartnerActor, id: string) {
    await storage(tx);
    const initial = await access(tx, actor, id);
    const lead = { ...initial.lead, ...(await lockContractSubject(tx, initial.lead)) };
    if (actor.wallet && (actor.administrator || lead.clientUserId !== actor.userId))
      fail("PARTNER_NOT_FOUND", 404);
    return { ...initial, lead };
  }
  async function contextHash(tx: PoolClient, lead: Lead, authorId: string) {
    const member = await membership(tx, authorId, true);
    const administration = (
      await tx.query(
        "select id,revoked_at from identity_admin_permissions where user_id=$1 and permission='administration.access' order by id for share",
        [authorId],
      )
    ).rows;
    const mandate = (
      await tx.query(
        `select id,access_scope,can_edit,can_contact,revoked_at,to_jsonb(c)->>'market_valid_until' valid_until
       from partner_contributors c where lead_id=$1 and user_id=$2 order by id limit 100`,
        [lead.id, authorId],
      )
    ).rows;
    const decision = (
      await tx.query<{ id: string }>(
        `select id from partner_events where lead_id=$1 and kind in ('client.select','client.refuse','client.keep_current','client.modification')
       order by created_at desc,id desc limit 1`,
        [lead.id],
      )
    ).rows[0]?.id;
    // Internal policy data only; no synthetic actor or session is used to impersonate the author.
    return digest({
      subject: subject(lead),
      owner: lead.clientUserId,
      scope: lead.adviceScopeRevision,
      administration,
      assignment: [lead.responsibleId, lead.assignment, lead.notificationCycle],
      decision,
      mandate,
      member: member && [
        member.organizationId,
        member.professionalRevision,
        member.revision,
        contextForApplication(member).canAdvise,
      ],
    });
  }
  async function currentEvidence(
    tx: PoolClient,
    lead: Lead,
    offerId: string,
    input: ConclusionAction,
    lock = false,
  ) {
    if (!("fingerprint" in input)) return null;
    if (input.correspondenceId) {
      if (input.action === "issued") return null;
      const source = (
        await readConclusionCorrespondence(
          tx,
          { ...lead, clientUserId: lead.clientUserId! },
          input.correspondenceId,
          lock,
        )
      )?.source;
      return source?.source.fingerprint === input.fingerprint ? source : null;
    }
    if (!input.policyId) return null;
    const policy = (await readFinalPolicies(tx, lead, false, { id: input.policyId })).items[0];
    if (
      !policy ||
      policy.offer.id !== offerId ||
      policy.status !== "available" ||
      policy.source?.fingerprint !== input.fingerprint
    )
      return null;
    if (input.action === "issued" && policy.reviewState !== "checked") return null;
    const source = (
      await readContractCandidates(
        tx,
        lead.clientUserId!,
        lead.clientProfileId,
        policy.documentId,
        lock,
      )
    ).entries[0];
    return source?.candidate.fingerprint === input.fingerprint ? source : null;
  }
  async function read(tx: PoolClient, actor: PartnerActor, id: string) {
    await storage(tx);
    const found = (await tx.query<Row>("select * from partner_conclusions where id=$1", [id]))
      .rows[0];
    if (!found) return fail("PARTNER_NOT_FOUND", 404);
    const { lead, canManage } = await leadAccess(tx, actor, found.lead_id);
    const row = (
      await tx.query<Row>("select * from partner_conclusions where id=$1 for update", [id])
    ).rows[0]!;
    const sameSubject = row.owner_id === lead.clientUserId && row.subject_key === subject(lead);
    if (actor.wallet && !sameSubject) fail("PARTNER_NOT_FOUND", 404);
    const offer = (await readOffers(tx, lead.id, true, { offerId: row.offer_id })).items[0];
    const signature = (
      await tx.query<{ id: string; input: unknown; integrity_hash: string; created_at: Date }>(
        "select * from partner_offer_signatures where conclusion_id=$1",
        [id],
      )
    ).rows[0];
    const rows = (
      await tx.query<ActionRow>(
        "select * from partner_conclusion_actions where conclusion_id=$1 order by revision limit 101",
        [id],
      )
    ).rows;
    if (rows.length > 100) fail("PARTNER_ACTION_REQUIRED");
    const sourceCurrent = sameSubject && !row.invalidated_at && offer?.sourceStatus === "current";
    const scopeCurrent =
      sourceCurrent && (signature || row.context === (await contextHash(tx, lead, row.author_id)));
    const actions = [];
    const { active, history } = conclusionHistory(rows);
    for (const entry of history) {
      const input = entry.input;
      const proof = await currentEvidence(tx, lead, row.offer_id, input);
      const needsProof = "fingerprint" in input;
      const valid = sourceCurrent && (!needsProof || !!proof);
      actions.push({
        id: entry.id,
        actorId: entry.actor_id,
        recordedAt: entry.created_at.toISOString(),
        input: valid ? input : null,
        sourceCurrent: needsProof ? !!(valid && proof) : null,
        superseded: entry.superseded,
        canCorrect: !!(
          canManage &&
          sourceCurrent &&
          signature &&
          !row.withdrawn_at &&
          rows.length < 100 &&
          !entry.superseded &&
          input.action !== "correct" &&
          input.action !== "withdraw"
        ),
      });
    }
    const last = rows.at(-1),
      lastInput = active.at(-1)?.input;
    const proofInvalid = actions.some((a) => !a.superseded && a.sourceCurrent === false);
    const expired =
      !signature &&
      (row.valid_until.getTime() <= Date.now() ||
        (!!offer?.validUntil && Date.parse(offer.validUntil) <= Date.now()));
    const state = row.withdrawn_at
      ? "withdrawn"
      : !scopeCurrent || proofInvalid
        ? "review_required"
        : expired
          ? "expired"
          : lastInput?.action && lastInput.action !== "withdraw" && lastInput.action !== "correct"
            ? lastInput.action
            : signature
              ? "signed"
              : "awaiting_signature";
    const signable =
      state === "awaiting_signature" &&
      offer?.state === "selected" &&
      offer.canChoose &&
      !["draft", "completed"].includes(lead.stage);
    const signed = signature && sourceCurrent ? conclusionSignSchema.parse(signature.input) : null;
    return conclusionSchema.parse({
      id,
      leadId: lead.id,
      offerId: row.offer_id,
      revision: last?.revision ?? 0,
      createdAt: row.created_at.toISOString(),
      state,
      sourceStatus: offer?.sourceStatus ?? "unavailable",
      contentHash: row.content_hash,
      archive: sourceCurrent ? conclusionArchiveSchema.parse(row.archive) : null,
      receipt:
        signed && signature
          ? {
              ...signed,
              id: signature.id,
              signedAt: signature.created_at.toISOString(),
              integrityHash: signature.integrity_hash,
            }
          : null,
      actions,
      canSign: !!(actor.wallet && !actor.administrator && signable),
      canManage: canManage && !row.withdrawn_at && !!sourceCurrent,
      availableActions:
        !canManage || !sourceCurrent || row.withdrawn_at || rows.length >= 100
          ? []
          : !signature
            ? ["withdraw"]
            : state === "signed"
              ? ["transmitted"]
              : state === "transmitted"
                ? ["accepted", "declined"]
                : state === "accepted"
                  ? ["issued"]
                  : [],
      insurerEvidence: proofInvalid
        ? "review_required"
        : actions.some(
              (a) =>
                !a.superseded &&
                a.input &&
                ["accepted", "declined", "issued"].includes(a.input.action),
            )
          ? "documented"
          : "missing",
    });
  }
  async function stage(tx: PoolClient, leadId: string, value?: string) {
    await tx.query(
      `update partner_leads set revision=revision+1,updated_at=clock_timestamp(),
      stage=coalesce($2,stage),stage_changed_at=case when $2::text is not null and stage<>$2 then clock_timestamp() else stage_changed_at end where id=$1`,
      [leadId, value ?? null],
    );
  }
  return {
    conclusions: (actor: PartnerActor, leadId: string, cursor?: string) =>
      economyRead(pool, actor, async (tx) => {
        const { lead, canManage } = await leadAccess(tx, actor, leadId);
        const [at, id] = economyCursor(cursor);
        const rows = (
          await tx.query<Row>(
            `select * from partner_conclusions where lead_id=$1
        and ($2::timestamptz is null or (created_at,id)<($2,$3))
        and ($4::text is null or owner_id=$4) order by created_at desc,id desc limit 21`,
            [leadId, at, id, actor.wallet ? actor.userId : null],
          )
        ).rows;
        const items = [];
        for (const row of rows.slice(0, 20)) items.push(await read(tx, actor, row.id));
        return conclusionsSchema.parse({
          leadRevision: lead.revision,
          canPrepare: canManage,
          items,
          nextCursor: rows.length > 20 ? economyNext(rows[19]!) : null,
        });
      }),
    conclusion: (actor: PartnerActor, id: string) =>
      economyRead(pool, actor, (tx) => read(tx, actor, id)),
    prepareConclusion: (
      actor: PartnerActor,
      leadId: string,
      raw: ConclusionPrepare,
      key: string,
    ) => {
      const input = conclusionPrepareSchema.parse(raw);
      return transaction(
        actor,
        "conclusion.prepare",
        key,
        { leadId, input },
        async (tx) => {
          const { lead, canManage } = await leadAccess(tx, actor, leadId);
          if (actor.wallet || !canManage) fail("PARTNER_ACCESS_DENIED", 403);
          if (lead.revision !== input.leadRevision) fail("PARTNER_CONFLICT", 409);
          const offer = (await readOffers(tx, leadId, true, { offerId: input.offerId })).items[0];
          if (
            !offer ||
            !offer.canChoose ||
            offer.state !== "selected" ||
            offer.sourceFingerprint !== input.sourceFingerprint
          )
            fail("PARTNER_OFFER_NOT_READY");
          const stored = (
            await tx.query<{ source_snapshot: unknown }>(
              "select source_snapshot from partner_offers where id=$1 for update",
              [offer.id],
            )
          ).rows[0]!;
          const source = await requireOfferSource(tx, offer.documentId, stored.source_snapshot);
          if (!cited(source.analysis, input.procedure)) fail("PARTNER_INVALID_DOCUMENT");
          const now = (await tx.query<{ at: Date }>("select clock_timestamp() at")).rows[0]!.at;
          if (
            Date.parse(input.validUntil) <= now.getTime() ||
            (offer.validUntil && Date.parse(input.validUntil) > Date.parse(offer.validUntil))
          )
            fail("PARTNER_OFFER_EXPIRED");
          const previous = (
            await tx.query<{ id: string }>(
              "select id from partner_conclusions where offer_id=$1 and withdrawn_at is null and invalidated_at is null for update",
              [offer.id],
            )
          ).rows[0];
          if (previous) {
            const current = await read(tx, actor, previous.id);
            if (!["expired", "review_required"].includes(current.state) || current.receipt)
              fail("PARTNER_CONFLICT", 409);
            await tx.query(
              "update partner_conclusions set invalidated_at=clock_timestamp() where id=$1",
              [previous.id],
            );
          }
          const archive = conclusionArchiveSchema.parse({
            leadId,
            subjectKey: subject(lead),
            ownerId: lead.clientUserId,
            clientName: lead.clientName,
            offer,
            checksum: source.checksum,
            procedure: input.procedure,
            explanation: input.explanation,
            preparedBy: actor.userId,
            preparedAt: now.toISOString(),
            validUntil: new Date(input.validUntil).toISOString(),
            method: "native_trace",
          });
          const id = newId("pconc");
          await tx.query(
            `insert into partner_conclusions(id,lead_id,offer_id,owner_id,subject_key,author_id,context,archive,content_hash,valid_until,created_at)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              id,
              leadId,
              offer.id,
              lead.clientUserId,
              subject(lead),
              actor.userId,
              await contextHash(tx, lead, actor.userId),
              JSON.stringify(archive),
              digest(archive),
              input.validUntil,
              now,
            ],
          );
          await stage(tx, leadId, "signing");
          await event(tx, actor, leadId, "conclusion.prepared.v1", "", "client", id);
          return id;
        },
        (tx, id) => read(tx, actor, id),
      );
    },
    signConclusion: (actor: PartnerActor, id: string, raw: ConclusionSign, key: string) => {
      const input = conclusionSignSchema.parse(raw);
      return transaction(
        actor,
        "conclusion.sign",
        key,
        { id, input },
        async (tx) => {
          const current = await read(tx, actor, id);
          if (!current.canSign || input.contentHash !== current.contentHash)
            fail("PARTNER_CONFLICT", 409);
          if (current.archive!.subjectKey.startsWith("profile:") && !input.representative)
            fail("PARTNER_ACTION_REQUIRED");
          const stored = (
            await tx.query<{ document_id: string; source_snapshot: unknown }>(
              "select document_id,source_snapshot from partner_offers where id=$1 for update",
              [current.offerId],
            )
          ).rows[0]!;
          await requireOfferSource(tx, stored.document_id, stored.source_snapshot);
          const now = (await tx.query<{ at: Date }>("select clock_timestamp() at")).rows[0]!.at;
          if (
            Date.parse(current.archive!.validUntil) <= now.getTime() ||
            (current.archive!.offer.validUntil &&
              Date.parse(current.archive!.offer.validUntil) <= now.getTime())
          )
            fail("PARTNER_OFFER_EXPIRED");
          const signatureId = newId("psig");
          await tx.query(
            "insert into partner_offer_signatures(id,conclusion_id,actor_id,input,integrity_hash,created_at) values($1,$2,$3,$4,$5,$6)",
            [
              signatureId,
              id,
              actor.userId,
              JSON.stringify(input),
              digest({
                id: signatureId,
                conclusionId: id,
                actorId: actor.userId,
                input,
                signedAt: now.toISOString(),
              }),
              now,
            ],
          );
          await tx.query("update partner_offers set state='signed' where id=$1", [current.offerId]);
          await stage(tx, current.leadId, "signed");
          await event(tx, actor, current.leadId, "conclusion.signed.v1", "", "client", id);
          return id;
        },
        (tx, target) => read(tx, actor, target),
      );
    },
    actConclusion: (actor: PartnerActor, id: string, raw: ConclusionAction, key: string) => {
      const input = conclusionActionSchema.parse(raw);
      return transaction(
        actor,
        "conclusion.action",
        key,
        { id, input },
        async (tx) => {
          const current = await read(tx, actor, id);
          const { lead } = await leadAccess(tx, actor, current.leadId);
          if (!current.canManage || actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
          if (input.revision !== current.revision || current.revision >= 100)
            fail("PARTNER_CONFLICT", 409);
          if (input.action === "withdraw") {
            if (current.receipt) fail("PARTNER_INVALID_TRANSITION");
            await tx.query(
              "update partner_conclusions set withdrawn_at=clock_timestamp() where id=$1",
              [id],
            );
          } else if (input.action === "correct") {
            if (!current.actions.some((a) => a.id === input.targetActionId && a.canCorrect))
              fail("PARTNER_INVALID_TRANSITION");
          } else {
            if (
              !current.receipt ||
              Date.parse(input.occurredAt) > Date.now() ||
              Date.parse(input.occurredAt) < Date.parse(current.receipt.signedAt)
            )
              fail("PARTNER_INVALID_TRANSITION");
            const required =
              input.action === "transmitted"
                ? "signed"
                : input.action === "issued"
                  ? "accepted"
                  : "transmitted";
            if (current.state !== required) fail("PARTNER_INVALID_TRANSITION");
            const previous = current.actions
              .filter((a) => !a.superseded && a.input && "occurredAt" in a.input)
              .at(-1)?.input;
            if (
              previous &&
              "occurredAt" in previous &&
              Date.parse(input.occurredAt) < Date.parse(previous.occurredAt)
            )
              fail("PARTNER_INVALID_TRANSITION");
            if (input.action !== "transmitted") {
              const source = await currentEvidence(tx, lead, current.offerId, input, true);
              if (!source || !cited(source.analysis, input.source))
                fail("PARTNER_INVALID_DOCUMENT");
            }
          }
          const actionId = newId("pca");
          await tx.query(
            "insert into partner_conclusion_actions(id,conclusion_id,actor_id,revision,input) values($1,$2,$3,$4,$5)",
            [actionId, id, actor.userId, input.revision + 1, JSON.stringify(input)],
          );
          if (input.action === "declined")
            await tx.query("update partner_offers set state='refused' where id=$1", [
              current.offerId,
            ]);
          if (input.action === "correct")
            await tx.query("update partner_offers set state='signed' where id=$1", [
              current.offerId,
            ]);
          const corrected = input.action === "correct" ? await read(tx, actor, id) : null;
          await stage(
            tx,
            current.leadId,
            corrected
              ? corrected.state === "signed"
                ? "signed"
                : "awaiting_insurer"
              : input.action === "transmitted"
                ? "awaiting_insurer"
                : input.action === "issued"
                  ? "contract_issued"
                  : input.action === "withdraw" || input.action === "declined"
                    ? "client_decision"
                    : undefined,
          );
          await event(tx, actor, current.leadId, `conclusion.${input.action}.v1`, "", "client", id);
          return id;
        },
        (tx, target) => read(tx, actor, target),
      );
    },
  };
}
