import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import {
  adminDataRequestSchema,
  adminDataRequestsSchema,
  completeAccessDays,
  dataRequestAnswerSchema,
  dataRequestRevisionSchema,
  dataRequestSchema,
  manualOutcomes,
  openDataRequestLimit,
  professionalDataRequestInputSchema,
  walletDataRequestInputSchema,
  type AdminDataRequestsQuery,
  type DataRequestKind,
} from "@coverview/contracts/partner-data";
import {
  fail,
  failOnConcurrentAbort,
  lockActor,
  visible,
  type Executor,
  type PartnerActor,
} from "./partner.policy.js";
import { newId } from "./partner.audit.js";

type Row = Record<string, unknown>;
const iso = (value: unknown) => (value ? (value as Date).toISOString() : null);
const own = `select r.*,mp.display_name profile_name,l.title lead_title,l.category lead_category
  from partner_data_requests r left join managed_profiles mp on mp.id=r.profile_id left join partner_leads l on l.id=r.lead_id`;
const administered = `select r.*,mp.display_name profile_name,l.title lead_title,l.category lead_category,
  ru.email requester_email,rm.application->>'name' requester_name,
  tu.email taken_email,tm.application->>'name' taken_name,au.email answered_email,am.application->>'name' answered_name
  from partner_data_requests r left join managed_profiles mp on mp.id=r.profile_id left join partner_leads l on l.id=r.lead_id
  join identity_users ru on ru.id=r.requester_id left join partner_members rm on rm.user_id=r.requester_id
  left join identity_users tu on tu.id=r.taken_by left join partner_members tm on tm.user_id=r.taken_by
  left join identity_users au on au.id=r.answered_by left join partner_members am on am.user_id=r.answered_by`;

function project(row: Row) {
  return {
    id: row.id,
    surface: row.surface,
    kind: row.kind,
    state: row.state,
    outcome: row.outcome ?? null,
    subject:
      row.surface === "partner"
        ? { kind: "member", profileId: null, name: null }
        : row.profile_id
          ? { kind: "profile", profileId: row.profile_id, name: row.profile_name ?? null }
          : { kind: "self", profileId: null, name: null },
    category: row.category ?? null,
    lead: row.lead_id
      ? { id: row.lead_id, title: row.lead_title, category: row.lead_category }
      : null,
    message: row.message,
    answer: row.answer ?? null,
    accessUntil: iso(row.access_until),
    erasure: row.erasure ?? null,
    createdAt: iso(row.created_at),
    takenAt: iso(row.taken_at),
    answeredAt: iso(row.answered_at),
    withdrawnAt: iso(row.withdrawn_at),
    revision: row.revision,
  };
}
const person = (id: unknown, email: unknown, name: unknown) =>
  id ? { id, email, name: name ?? null } : null;
function administer(row: Row) {
  const final = row.state === "answered" || row.state === "withdrawn";
  return adminDataRequestSchema.parse({
    ...project(row),
    requester: person(row.requester_id, row.requester_email, row.requester_name),
    takenBy: person(row.taken_by, row.taken_email, row.taken_name),
    answeredBy: person(row.answered_by, row.answered_email, row.answered_name),
    allowedOutcomes: final
      ? []
      : (manualOutcomes[row.surface as "wallet" | "partner"][row.kind as DataRequestKind] ?? []),
  });
}

// The person's own requests, newest first (C7b).
export async function ownRequests(db: Executor, actor: PartnerActor) {
  const rows = (
    await db.query<Row>(
      `${own} where r.requester_id=$1 and r.surface=$2 order by r.created_at desc,r.id desc limit 20`,
      [actor.userId, actor.wallet ? "wallet" : "partner"],
    )
  ).rows;
  return rows.map((row) => dataRequestSchema.parse(project(row)));
}
// Subjects whose internal notes and tasks a granted complete access opens to this person now.
export async function completeAccessSubjects(db: Executor, actor: PartnerActor) {
  const rows = (
    await db.query<{ subject_key: string }>(
      `select distinct subject_key from partner_data_requests where requester_id=$1 and surface='wallet'
       and kind='complete_access' and outcome='granted' and access_until>clock_timestamp()`,
      [actor.userId],
    )
  ).rows;
  return new Set(rows.map((row) => row.subject_key));
}

// Short transactions on a locked, live session; a command is replayed by its idempotency key.
export function requestTransactions(pool: Pool) {
  async function command<T>(
    actor: PartnerActor,
    operation: string,
    key: string,
    input: unknown,
    action: (tx: PoolClient) => Promise<string>,
    view: (tx: PoolClient, id: string) => Promise<T>,
  ) {
    if (!z.uuid().safeParse(key).success) fail("PARTNER_ACCESS_DENIED", 400);
    const tx = await pool.connect();
    try {
      await tx.query("begin");
      await lockActor(tx, actor);
      const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      const existing = (
        await tx.query<Row>("select * from partner_commands where user_id=$1 and key=$2", [
          actor.userId,
          key,
        ])
      ).rows[0];
      let target: string;
      if (existing) {
        if (existing.operation !== operation || existing.hash !== hash)
          fail("PARTNER_IDEMPOTENCY_REUSED", 422);
        target = String(existing.target_id);
      } else {
        target = await action(tx);
        await tx.query(
          "insert into partner_commands(id,user_id,key,operation,hash,target_id) values($1,$2,$3,$4,$5,$6)",
          [newId("pcmd"), actor.userId, key, operation, hash, target],
        );
      }
      const result = await view(tx, target);
      await tx.query("commit");
      return result;
    } catch (cause) {
      await tx.query("rollback");
      failOnConcurrentAbort(cause);
      throw cause;
    } finally {
      tx.release();
    }
  }
  async function read<T>(actor: PartnerActor, work: (tx: PoolClient) => Promise<T>) {
    const tx = await pool.connect();
    try {
      await tx.query("begin");
      await lockActor(tx, actor);
      const result = await work(tx);
      await tx.query("commit");
      return result;
    } catch (cause) {
      await tx.query("rollback");
      failOnConcurrentAbort(cause);
      throw cause;
    } finally {
      tx.release();
    }
  }
  return { command, read };
}
// One request as Admin sees it, optionally locked for a decision.
export async function administeredRequest(db: Executor, id: string, lock = false) {
  const row = (
    await db.query<Row>(`${administered} where r.id=$1 ${lock ? "for update of r" : ""}`, [id])
  ).rows[0];
  if (!row) return fail("PARTNER_NOT_FOUND", 404);
  return row;
}
export { administer };

// Requests about one's data (brief I.20, C7b): filed by the person, answered by CoverView.
export function createDataRequestOperations(pool: Pool) {
  const { command, read } = requestTransactions(pool);
  const mine = async (tx: PoolClient, actor: PartnerActor, id: string) => {
    const row = (
      await tx.query<Row>(`${own} where r.id=$1 and r.requester_id=$2`, [id, actor.userId])
    ).rows[0];
    if (!row) return fail("PARTNER_NOT_FOUND", 404);
    return dataRequestSchema.parse(project(row));
  };
  const administered$ = administeredRequest;
  // One person's open requests are bounded; an identical open request is not filed twice. The
  // actor row lock taken first serialises two concurrent filings by the same person.
  async function file(
    tx: PoolClient,
    actor: PartnerActor,
    values: {
      surface: "wallet" | "partner";
      subjectKey: string;
      profileId: string | null;
      kind: string;
      category: string | null;
      leadId: string | null;
      message: string;
    },
  ) {
    const open = (
      await tx.query<{ total: number; same: number }>(
        `select count(*)::int total,count(*) filter(where kind=$2 and subject_key=$3 and lead_id is not distinct from $4)::int same
         from partner_data_requests where requester_id=$1 and state in ('received','in_progress')`,
        [actor.userId, values.kind, values.subjectKey, values.leadId],
      )
    ).rows[0]!;
    if (open.same) fail("PARTNER_CONFLICT", 409);
    if (open.total >= openDataRequestLimit) fail("PARTNER_RATE_LIMITED", 429);
    const id = newId("pdreq");
    await tx.query(
      `insert into partner_data_requests(id,requester_id,surface,subject_key,profile_id,kind,category,lead_id,message)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        actor.userId,
        values.surface,
        values.subjectKey,
        values.profileId,
        values.kind,
        values.category,
        values.leadId,
        values.message,
      ],
    );
    return id;
  }
  function admin(actor: PartnerActor) {
    if (!actor.administrator || actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
  }

  return {
    fileWalletDataRequest: (actor: PartnerActor, raw: unknown, key: string) => {
      const input = walletDataRequestInputSchema.parse(raw);
      return command(
        actor,
        "data_request.wallet",
        key,
        input,
        async (tx) => {
          if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
          if (
            input.profileId &&
            !(
              await tx.query(
                "select 1 from managed_profiles where id=$1 and user_id=$2 for share",
                [input.profileId, actor.userId],
              )
            ).rowCount
          )
            fail("PARTNER_NOT_FOUND", 404);
          if (input.leadId) {
            // The request concerned must be one the person sees, and of the same subject.
            const lead = (
              await tx.query<{ client_profile_id: string | null }>(
                `select l.client_profile_id from partner_leads l where l.id=$2 and (${visible(actor)})`,
                [actor.userId, input.leadId],
              )
            ).rows[0];
            if (!lead || lead.client_profile_id !== input.profileId) fail("PARTNER_NOT_FOUND", 404);
          }
          return file(tx, actor, {
            surface: "wallet",
            subjectKey: input.profileId ? `profile:${input.profileId}` : `self:${actor.userId}`,
            profileId: input.profileId,
            kind: input.kind,
            category: input.category,
            leadId: input.leadId,
            message: input.message,
          });
        },
        (tx, id) => mine(tx, actor, id),
      );
    },
    fileProfessionalDataRequest: (actor: PartnerActor, raw: unknown, key: string) => {
      const input = professionalDataRequestInputSchema.parse(raw);
      return command(
        actor,
        "data_request.partner",
        key,
        input,
        (tx) => {
          if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
          return file(tx, actor, {
            surface: "partner",
            subjectKey: `member:${actor.userId}`,
            profileId: null,
            kind: input.kind,
            category: input.category,
            leadId: null,
            message: input.message,
          });
        },
        (tx, id) => mine(tx, actor, id),
      );
    },
    withdrawDataRequest: (actor: PartnerActor, id: string, raw: unknown, key: string) => {
      const input = dataRequestRevisionSchema.parse(raw);
      return command(
        actor,
        "data_request.withdraw",
        key,
        { id, ...input },
        async (tx) => {
          const row = (
            await tx.query<Row>(
              "select state,revision,surface from partner_data_requests where id=$1 and requester_id=$2 for update",
              [id, actor.userId],
            )
          ).rows[0];
          if (!row || row.surface !== (actor.wallet ? "wallet" : "partner"))
            fail("PARTNER_NOT_FOUND", 404);
          if (row.revision !== input.revision) fail("PARTNER_CONFLICT", 409);
          if (!["received", "in_progress"].includes(String(row.state)))
            fail("PARTNER_INVALID_TRANSITION", 422);
          await tx.query(
            "update partner_data_requests set state='withdrawn',withdrawn_at=clock_timestamp(),revision=revision+1 where id=$1",
            [id],
          );
          return id;
        },
        (tx, target) => mine(tx, actor, target),
      );
    },
    adminDataRequests: (actor: PartnerActor, query: AdminDataRequestsQuery) =>
      read(actor, async (tx) => {
        admin(actor);
        const open = query.state === "open";
        const values: unknown[] = [];
        const clauses = [
          query.state === "open"
            ? "r.state in ('received','in_progress')"
            : query.state === "closed"
              ? "r.state in ('answered','withdrawn')"
              : "true",
        ];
        if (query.cursor) {
          const cursor = z
            .object({ at: z.iso.datetime({ offset: true }), id: z.string().max(100) })
            .safeParse(
              ((): unknown => {
                try {
                  return JSON.parse(
                    Buffer.from(query.cursor, "base64url").toString("utf8"),
                  ) as unknown;
                } catch {
                  return null;
                }
              })(),
            );
          if (!cursor.success) fail("PARTNER_CONFLICT", 409);
          values.push(cursor.data.at, cursor.data.id);
          clauses.push(`(r.created_at,r.id) ${open ? ">" : "<"} ($1::timestamptz,$2)`);
        }
        // The oldest open request first: it waits the longest.
        const rows = (
          await tx.query<Row>(
            `${administered} where ${clauses.join(" and ")} order by r.created_at ${open ? "asc" : "desc"},r.id ${open ? "asc" : "desc"} limit 51`,
            values,
          )
        ).rows;
        const last = rows[49];
        return adminDataRequestsSchema.parse({
          items: rows.slice(0, 50).map(administer),
          nextCursor:
            rows.length > 50 && last
              ? Buffer.from(
                  JSON.stringify({ at: (last.created_at as Date).toISOString(), id: last.id }),
                ).toString("base64url")
              : null,
          open: (
            await tx.query<{ open: number }>(
              "select count(*)::int open from partner_data_requests where state in ('received','in_progress')",
            )
          ).rows[0]!.open,
        });
      }),
    adminDataRequest: (actor: PartnerActor, id: string) =>
      read(actor, async (tx) => {
        admin(actor);
        return administer(await administered$(tx, id));
      }),
    takeDataRequest: (actor: PartnerActor, id: string, raw: unknown, key: string) => {
      const input = dataRequestRevisionSchema.parse(raw);
      return command(
        actor,
        "data_request.take",
        key,
        { id, ...input },
        async (tx) => {
          admin(actor);
          const row = await administered$(tx, id, true);
          if (row.revision !== input.revision) fail("PARTNER_CONFLICT", 409);
          if (row.state !== "received") fail("PARTNER_INVALID_TRANSITION", 422);
          await tx.query(
            "update partner_data_requests set state='in_progress',taken_by=$2,taken_at=clock_timestamp(),revision=revision+1 where id=$1",
            [id, actor.userId],
          );
          return id;
        },
        async (tx, target) => administer(await administered$(tx, target)),
      );
    },
    answerDataRequest: (actor: PartnerActor, id: string, raw: unknown, key: string) => {
      const input = dataRequestAnswerSchema.parse(raw);
      return command(
        actor,
        "data_request.answer",
        key,
        { id, ...input },
        async (tx) => {
          admin(actor);
          const row = await administered$(tx, id, true);
          if (row.revision !== input.revision) fail("PARTNER_CONFLICT", 409);
          if (!["received", "in_progress"].includes(String(row.state)))
            fail("PARTNER_INVALID_TRANSITION", 422);
          const allowed =
            manualOutcomes[row.surface as "wallet" | "partner"][row.kind as DataRequestKind] ?? [];
          if (!allowed.includes(input.outcome)) fail("PARTNER_INVALID_TRANSITION", 422);
          await tx.query(
            `update partner_data_requests set state='answered',outcome=$2,answer=$3,answered_by=$4,answered_at=clock_timestamp(),
             access_until=case when $2='granted' then clock_timestamp()+make_interval(days=>$5) end,revision=revision+1 where id=$1`,
            [id, input.outcome, input.answer, actor.userId, completeAccessDays],
          );
          return id;
        },
        async (tx, target) => administer(await administered$(tx, target)),
      );
    },
  };
}
