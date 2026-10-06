import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import {
  commercialInputSchema,
  commercialReviewSchema,
  commercialTermsSchema,
  commercialConditionSchema,
  commercialListSchema,
} from "@coverview/contracts/partner-economy";
import { context, fail, lockActor, membership, type PartnerActor } from "./partner.policy.js";
import { newId, event } from "./partner.audit.js";

export type EconomyMutation = <T>(
  actor: PartnerActor,
  operation: string,
  key: string,
  input: unknown,
  action: (tx: PoolClient) => Promise<string>,
  project: (tx: PoolClient, id: string) => Promise<T>,
) => Promise<T>;
export function economyCursor(value?: string): [string | null, string | null] {
  if (!value) return [null, null];
  try {
    return z
      .tuple([z.iso.datetime({ offset: true }), z.string().min(1).max(100)])
      .parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
  } catch {
    return fail("PARTNER_NOT_FOUND", 400);
  }
}
export const economyNext = (row: { created_at: Date; id: string }) =>
  Buffer.from(JSON.stringify([row.created_at.toISOString(), row.id])).toString("base64url");
export async function economyRead<T>(
  pool: Pool,
  actor: PartnerActor,
  action: (tx: PoolClient) => Promise<T>,
) {
  const tx = await pool.connect();
  try {
    await tx.query("begin isolation level repeatable read");
    await lockActor(tx, actor);
    const result = await action(tx);
    await lockActor(tx, actor);
    await tx.query("commit");
    return result;
  } catch (error) {
    await tx.query("rollback");
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      ["40001", "40P01"].includes(String(error.code))
    )
      fail("PARTNER_CONFLICT", 409);
    throw error;
  } finally {
    tx.release();
  }
}
export async function commercialCondition(
  tx: PoolClient,
  actor: PartnerActor,
  id: string,
  restricted = true,
) {
  const row = (
    await tx.query<{
      id: string;
      owner_id: string;
      organization_id: string;
      professional_revision: number;
      declared_name: string;
      declared_organization: string;
      terms: unknown;
      created_at: Date;
    }>("select * from partner_commercial_conditions where id=$1 for share", [id])
  ).rows[0];
  if (!row || (restricted && !actor.administrator && row.owner_id !== actor.userId) || actor.wallet)
    fail("PARTNER_NOT_FOUND", 404);
  const member = await membership(tx, row.owner_id, true);
  const terms = commercialTermsSchema.parse(row.terms);
  const reviews = (
    await tx.query<{
      author_id: string;
      decision: "approve" | "reject" | "withdraw";
      reason: string;
      validation_reference: string;
      created_at: Date;
    }>(
      "select * from partner_commercial_reviews where condition_id=$1 order by created_at desc,id desc limit 3",
      [id],
    )
  ).rows;
  if (reviews.length > 2) fail("PARTNER_ACTION_REQUIRED");
  const review = reviews[0];
  const state =
    review?.decision === "withdraw"
      ? "withdrawn"
      : review?.decision === "reject"
        ? "rejected"
        : !member ||
            member.organizationId !== row.organization_id ||
            member.professionalRevision !== row.professional_revision
          ? "scope_changed"
          : Date.parse(terms.validUntil) <= Date.now()
            ? "expired"
            : review?.decision === "approve"
              ? "approved"
              : "pending";
  return commercialConditionSchema.parse({
    id,
    ownerId: row.owner_id,
    organizationId: row.organization_id,
    name: row.declared_name,
    organization: row.declared_organization,
    createdAt: row.created_at.toISOString(),
    terms,
    state,
    reviews: reviews.map((r) => ({
      authorId: r.author_id,
      decision: r.decision,
      reason: r.reason,
      validationReference: r.validation_reference,
      at: r.created_at.toISOString(),
    })),
    review: review
      ? {
          authorId: review.author_id,
          decision: review.decision,
          reason: review.reason,
          validationReference: review.validation_reference,
          at: review.created_at.toISOString(),
        }
      : null,
    canReview: actor.administrator && actor.userId !== row.owner_id && state === "pending",
    canWithdraw:
      (actor.administrator || actor.userId === row.owner_id) &&
      !["withdrawn", "rejected"].includes(state),
  });
}
export async function requireCommercial(
  tx: PoolClient,
  actor: PartnerActor,
  id: string,
  ownerId: string,
  category: string,
) {
  const value = await commercialCondition(tx, actor, id, false);
  const member = await membership(tx, ownerId, true);
  if (
    value.ownerId !== ownerId ||
    value.state !== "approved" ||
    Date.parse(value.terms.validFrom) > Date.now() ||
    !value.terms.categories.some((c) => c === category) ||
    !member ||
    member.state !== "approved" ||
    member.organizationState !== "approved" ||
    (member.reviewDueAt && Date.parse(member.reviewDueAt) <= Date.now())
  )
    fail("PARTNER_ACTION_REQUIRED");
  return value;
}
export function createCommercialOperations(pool: Pool, mutate: EconomyMutation) {
  return {
    async commercialConditions(actor: PartnerActor, cursor?: string) {
      return economyRead(pool, actor, async (tx) => {
        if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
        const [at, id] = economyCursor(cursor);
        const rows = (
          await tx.query<{ id: string; created_at: Date }>(
            `select id,created_at from partner_commercial_conditions where (owner_id=$1 or $2) and ($3::timestamptz is null or (created_at,id)<($3,$4)) order by created_at desc,id desc limit 21`,
            [actor.userId, actor.administrator, at, id],
          )
        ).rows;
        const items = [];
        for (const r of rows.slice(0, 20)) items.push(await commercialCondition(tx, actor, r.id));
        return commercialListSchema.parse({
          items,
          nextCursor: rows.length > 20 ? economyNext(rows[19]!) : null,
        });
      });
    },
    async createCommercialCondition(
      actor: PartnerActor,
      raw: z.infer<typeof commercialInputSchema>,
      key: string,
    ) {
      const input = commercialInputSchema.parse(raw);
      return mutate(
        actor,
        "commercial.declared.v1",
        key,
        input,
        async (tx) => {
          if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
          const ctx = await context(tx, actor, true),
            member = ctx.application;
          // Terms stay declarable when CoverView restricts the transmission of requests (C8a).
          if (
            !ctx.operational ||
            !member ||
            !(
              ctx.administrator ||
              member.grantedRoles.some((r) => r === "referrer" || r === "advisor")
            ) ||
            member.state !== "approved" ||
            member.organizationState !== "approved" ||
            !input.terms.categories.every((c) => member.categories.includes(c))
          )
            fail("PARTNER_ACCESS_DENIED", 403);
          if (Date.parse(input.terms.validUntil) <= Date.now()) fail("PARTNER_ACTION_REQUIRED");
          for (const person of [...input.terms.contributors].sort((a, b) =>
            a.userId.localeCompare(b.userId),
          )) {
            const contributor = await membership(tx, person.userId, true);
            if (
              person.userId === actor.userId ||
              person.userId === "coverview" ||
              !contributor ||
              contributor.state !== "approved" ||
              contributor.organizationState !== "approved"
            )
              fail("PARTNER_ACTION_REQUIRED");
          }
          const id = newId("pterms");
          await tx.query(
            "insert into partner_commercial_conditions(id,owner_id,organization_id,professional_revision,declared_name,declared_organization,terms) values($1,$2,$3,$4,$5,$6,$7)",
            [
              id,
              actor.userId,
              member.organizationId,
              member.professionalRevision,
              member.name,
              member.organization,
              JSON.stringify(input.terms),
            ],
          );
          await event(tx, actor, null, "commercial.declared.v1", "", "private", id);
          return id;
        },
        (tx, id) => commercialCondition(tx, actor, id),
      );
    },
    async reviewCommercialCondition(
      actor: PartnerActor,
      id: string,
      raw: z.infer<typeof commercialReviewSchema>,
      key: string,
    ) {
      const input = commercialReviewSchema.parse(raw);
      return mutate(
        actor,
        "commercial.reviewed.v1",
        key,
        { id, input },
        async (tx) => {
          await tx.query("select id from partner_commercial_conditions where id=$1 for update", [
            id,
          ]);
          const current = await commercialCondition(tx, actor, id);
          if (input.decision === "withdraw" ? !current.canWithdraw : !current.canReview)
            fail("PARTNER_ACCESS_DENIED", 403);
          await tx.query(
            "insert into partner_commercial_reviews(id,condition_id,author_id,decision,reason,validation_reference) values($1,$2,$3,$4,$5,$6)",
            [
              newId("pcrev"),
              id,
              actor.userId,
              input.decision,
              input.reason,
              input.validationReference,
            ],
          );
          await event(tx, actor, null, "commercial.reviewed.v1", "", "private", id);
          return id;
        },
        (tx, target) => commercialCondition(tx, actor, target),
      );
    },
  };
}
