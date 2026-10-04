import type { Pool, PoolClient } from "pg";
import {
  conclusionCandidatesSchema,
  conclusionCorrespondenceInputSchema,
  conclusionCorrespondencesSchema,
  type ConclusionCorrespondenceInput,
} from "@coverview/contracts/partner-conclusion";
import {
  readCorrespondenceDocuments,
  retainContractReference,
} from "../document-intelligence/index.js";
import {
  economyCursor,
  economyNext,
  economyRead,
  type EconomyMutation,
} from "./partner.commercial.js";
import { lockContractSubject } from "./partner.contract.js";
import { fail, type Executor, type PartnerActor } from "./partner.policy.js";
import { event, newId } from "./partner.audit.js";
import type { partnerLeads } from "./partner.schema.js";
type Lead = typeof partnerLeads.$inferSelect;
type Subject = { id: string; clientUserId: string; clientProfileId: string | null };
type Row = {
  id: string;
  document_id: string;
  owner_id: string;
  subject_key: string;
  fingerprint: string;
  shared_at: Date;
  withdrawn_at: Date | null;
  invalidated_at: Date | null;
};
const subject = (lead: Subject) =>
  lead.clientProfileId ? `profile:${lead.clientProfileId}` : `self:${lead.clientUserId}`;
export async function readConclusionCorrespondence(
  db: Executor,
  lead: Subject,
  id: string,
  lock = false,
) {
  const row = (
    await db.query<Row>(
      `select * from partner_conclusion_correspondences where id=$1 and lead_id=$2 ${lock ? "for share" : ""}`,
      [id, lead.id],
    )
  ).rows[0];
  if (!row) return null;
  const same = row.owner_id === lead.clientUserId && row.subject_key === subject(lead);
  const source =
    same && !row.withdrawn_at && !row.invalidated_at
      ? (
          await readCorrespondenceDocuments(db, lead.clientUserId, lead.clientProfileId, {
            documentId: row.document_id,
            lock,
          })
        ).entries[0]
      : null;
  const current = !!source && source.source.fingerprint === row.fingerprint;
  return {
    row,
    source: current ? source : null,
    dto: {
      id: row.id,
      documentId: row.document_id,
      name: current ? source.name : null,
      fingerprint: current ? row.fingerprint : null,
      sharedAt: row.shared_at.toISOString(),
      active: !row.withdrawn_at,
      current,
      canDownload: current,
    },
  };
}
export function createCorrespondenceOperations(
  pool: Pool,
  transaction: EconomyMutation,
  access: (tx: PoolClient, actor: PartnerActor, id: string) => Promise<Lead>,
) {
  async function leadAccess(tx: PoolClient, actor: PartnerActor, id: string) {
    if (
      !(
        await tx.query<{ table: string | null }>(
          "select to_regclass('partner_conclusion_correspondences')::text as table",
        )
      ).rows[0]?.table
    )
      fail("PARTNER_UNAVAILABLE", 503);
    const initial = await access(tx, actor, id),
      lead = { ...initial, ...(await lockContractSubject(tx, initial)) };
    if (actor.wallet && (actor.administrator || actor.userId !== lead.clientUserId))
      fail("PARTNER_NOT_FOUND", 404);
    return lead;
  }
  async function read(tx: PoolClient, actor: PartnerActor, id: string, cursor?: string) {
    const lead = await leadAccess(tx, actor, id),
      [at, key] = economyCursor(cursor);
    const rows = (
      await tx.query<{ id: string; created_at: Date }>(
        `select id,shared_at created_at from partner_conclusion_correspondences
      where lead_id=$1 and owner_id=$2 and subject_key=$3 and ($4::timestamptz is null or (shared_at,id)<($4,$5))
      order by shared_at desc,id desc limit 21`,
        [id, lead.clientUserId, subject(lead), at, key],
      )
    ).rows;
    const items = [];
    for (const row of rows.slice(0, 20))
      items.push((await readConclusionCorrespondence(tx, lead, row.id))!.dto);
    return conclusionCorrespondencesSchema.parse({
      leadRevision: lead.revision,
      canShare: !!actor.wallet,
      items,
      nextCursor: rows.length > 20 ? economyNext(rows[19]!) : null,
    });
  }
  return {
    conclusionCorrespondences: (actor: PartnerActor, id: string, cursor?: string) =>
      economyRead(pool, actor, (tx) => read(tx, actor, id, cursor)),
    conclusionCandidates: (actor: PartnerActor, id: string, cursor?: string) =>
      economyRead(pool, actor, async (tx) => {
        const lead = await leadAccess(tx, actor, id);
        if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
        const { rows, entries } = await readCorrespondenceDocuments(
          tx,
          lead.clientUserId,
          lead.clientProfileId,
          { after: economyCursor(cursor) },
        );
        return conclusionCandidatesSchema.parse({
          items: entries.map((e) => ({
            documentId: e.documentId,
            name: e.name,
            fingerprint: e.source.fingerprint,
          })),
          nextCursor:
            rows.length > 20
              ? economyNext({ id: String(rows[19]!.id), created_at: rows[19]!.created_at as Date })
              : null,
        });
      }),
    shareConclusionCorrespondence: (
      actor: PartnerActor,
      id: string,
      raw: ConclusionCorrespondenceInput,
      key: string,
    ) => {
      const input = conclusionCorrespondenceInputSchema.parse(raw);
      return transaction(
        actor,
        "conclusion.correspondence",
        key,
        { id, input },
        async (tx) => {
          const lead = await leadAccess(tx, actor, id);
          if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
          if (lead.revision !== input.leadRevision) fail("PARTNER_CONFLICT", 409);
          let target: string;
          if (input.action === "share") {
            const source = (
              await readCorrespondenceDocuments(tx, lead.clientUserId, lead.clientProfileId, {
                documentId: input.documentId,
                lock: true,
              })
            ).entries[0];
            if (!source || source.source.fingerprint !== input.fingerprint)
              fail("PARTNER_INVALID_DOCUMENT");
            await retainContractReference(tx, input.documentId);
            target = newId("pcc");
            await tx.query(
              `insert into partner_conclusion_correspondences(id,lead_id,document_id,owner_id,subject_key,fingerprint)
            values($1,$2,$3,$4,$5,$6)`,
              [target, id, input.documentId, lead.clientUserId, subject(lead), input.fingerprint],
            );
          } else {
            const current = await readConclusionCorrespondence(tx, lead, input.id, true);
            if (
              !current ||
              current.row.owner_id !== actor.userId ||
              current.row.subject_key !== subject(lead) ||
              !current.dto.active
            )
              fail("PARTNER_NOT_FOUND", 404);
            target = input.id;
            await tx.query(
              "update partner_conclusion_correspondences set withdrawn_at=clock_timestamp() where id=$1",
              [target],
            );
          }
          await tx.query(
            "update partner_leads set revision=revision+1,updated_at=clock_timestamp() where id=$1",
            [id],
          );
          await event(
            tx,
            actor,
            id,
            input.action === "share" ? "correspondence.shared.v1" : "correspondence.withdrawn.v1",
            input.action === "withdraw" ? input.reason : "",
            "client",
            target,
          );
          return id;
        },
        (tx, target) => read(tx, actor, target),
      );
    },
    conclusionCorrespondenceSource: (
      actor: PartnerActor,
      id: string,
      sourceId: string,
      record = false,
    ) =>
      economyRead(pool, actor, async (tx) => {
        const lead = await leadAccess(tx, actor, id),
          current = await readConclusionCorrespondence(tx, lead, sourceId, true);
        if (!current?.dto.canDownload) return fail("PARTNER_NOT_FOUND", 404);
        if (
          record &&
          !(
            await tx.query(
              `select id from partner_events where lead_id=$1 and actor_id=$2 and subject_id=$3
        and kind='correspondence.viewed.v1' and created_at>now()-interval '30 minutes' limit 1`,
              [id, actor.userId, sourceId],
            )
          ).rowCount
        )
          await event(tx, actor, id, "correspondence.viewed.v1", "", "private", sourceId);
        return current.row.document_id;
      }),
  };
}
