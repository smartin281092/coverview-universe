import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import {
  goalInputSchema,
  goalSchema,
  goalsQuerySchema,
  goalsSchema,
  pilotageScopeSchema,
  type PilotageQuery,
  type PilotageScope,
} from "@coverview/contracts/partner-pilotage";
import { context, fail, type PartnerActor } from "./partner.policy.js";
import {
  economyRead,
  economyCursor,
  economyNext,
  type EconomyMutation,
} from "./partner.commercial.js";
import { resolvePilotageScope } from "./partner.pilotage-scope.js";
import { pilotageMeasures } from "./partner.pilotage.js";
import { event, newId } from "./partner.audit.js";

type GoalRow = {
  id: string;
  creator_id: string;
  scope_kind: "individual" | "team" | "organization" | "network";
  organization_id: string | null;
  user_ids: unknown;
  created_at: Date;
};
type Version = { revision: number; input: unknown; author_name: string; created_at: Date };
const scopeOf = (row: GoalRow) =>
  pilotageScopeSchema.parse({
    kind: row.scope_kind,
    organizationId: row.organization_id,
    userIds: row.user_ids,
  });
const sameScope = (a: PilotageScope, b: PilotageScope) =>
  a.kind === b.kind &&
  a.organizationId === b.organizationId &&
  [...a.userIds].sort().join("\0") === [...b.userIds].sort().join("\0");
const queryOf = (input: z.infer<typeof goalInputSchema>): PilotageQuery => ({
  from: input.from,
  to: input.to,
  scope: input.scope.kind,
  ...(input.scope.organizationId ? { organizationId: input.scope.organizationId } : {}),
  ...(input.scope.userIds.length ? { members: input.scope.userIds.join(",") } : {}),
  ...input.filters,
});

export function createGoalOperations(pool: Pool, transaction: EconomyMutation) {
  async function access(tx: PoolClient, actor: PartnerActor, id: string, write = false) {
    const row = (
      await tx.query<GoalRow>("select * from partner_goals where id=$1 for update", [id])
    ).rows[0];
    if (!row) fail("PARTNER_NOT_FOUND", 404);
    const scope = await resolvePilotageScope(tx, actor, scopeOf(row), write);
    if (
      write &&
      scope.kind === "individual" &&
      !actor.administrator &&
      row.creator_id !== actor.userId
    )
      fail("PARTNER_ACCESS_DENIED", 403);
    return { row, scope };
  }
  async function read(tx: PoolClient, actor: PartnerActor, id: string, before?: number) {
    const { row, scope } = await access(tx, actor, id),
      ctx = await context(tx, actor, true);
    const versionSql = `select v.*,coalesce(nullif(m.application->>'name',''),nullif(trim(concat_ws(' ',p.fields->'firstName'->>'value',p.fields->'lastName'->>'value')),''),'CoverView') author_name from partner_goal_versions v left join partner_members m on m.user_id=v.author_id left join identity_profiles p on p.user_id=v.author_id where goal_id=$1`;
    const latest = (await tx.query<Version>(`${versionSql} order by v.revision desc limit 1`, [id]))
      .rows[0];
    if (!latest) fail("PARTNER_NOT_FOUND", 404);
    const input = goalInputSchema.parse(latest.input);
    if (!sameScope(input.scope, scope)) fail("PARTNER_ACTION_REQUIRED");
    const { measures } = await pilotageMeasures(tx, actor, queryOf(input), scope, input.metric),
      actual = measures[0]!,
      value = actual.value;
    const history = (
      await tx.query<Version>(
        `${versionSql} and ($2::int is null or v.revision<$2) order by v.revision desc limit 21`,
        [id, before ?? null],
      )
    ).rows;
    const project = (v: Version) => ({
      revision: v.revision,
      input: goalInputSchema.parse(v.input),
      authorName: v.author_name,
      createdAt: v.created_at.toISOString(),
    });
    const canEdit =
      actor.administrator ||
      (scope.kind === "individual" &&
        scope.userIds[0] === actor.userId &&
        row.creator_id === actor.userId) ||
      (["team", "organization"].includes(scope.kind) &&
        ctx.canManage &&
        ctx.application?.organizationId === scope.organizationId);
    return goalSchema.parse({
      id,
      createdAt: row.created_at.toISOString(),
      current: project(latest),
      actual,
      gap: value === null ? null : value - input.target,
      progressPercent:
        value === null
          ? null
          : input.direction === "at_least"
            ? input.target === 0
              ? value >= 0
                ? 100
                : 0
              : Math.max(0, (value / input.target) * 100)
            : value <= input.target
              ? 100
              : (input.target / value) * 100,
      attained:
        value === null
          ? null
          : input.direction === "at_least"
            ? value >= input.target
            : value <= input.target,
      canEdit,
      history: history.slice(0, 20).map(project),
      nextRevision: history.length > 20 ? history[19]!.revision : null,
    });
  }
  return {
    goal: (actor: PartnerActor, id: string, before?: number) =>
      economyRead(pool, actor, (tx) => read(tx, actor, id, before)),
    goals: (actor: PartnerActor, raw: unknown) =>
      economyRead(pool, actor, async (tx) => {
        if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
        const query = goalsQuerySchema.parse(raw),
          ctx = await context(tx, actor, true),
          cursor = economyCursor(query.cursor);
        if (!ctx.operational) fail("PARTNER_ACCESS_DENIED", 403);
        const rows = (
          await tx.query<GoalRow>(
            `select g.* from partner_goals g where ($1::boolean or g.scope_kind='individual' and (g.user_ids ? $2 or $3::boolean and exists(select 1 from partner_members m where g.user_ids ? m.user_id and m.organization_id=$4)) or g.scope_kind in ('team','organization') and $3::boolean and g.organization_id=$4) and ($5::text='all' or (select v.input->>'state' from partner_goal_versions v where v.goal_id=g.id order by revision desc limit 1)=$5) and ($6::timestamptz is null or (g.created_at,g.id)<($6::timestamptz,$7::text)) order by g.created_at desc,g.id desc limit 21`,
            [
              actor.administrator,
              actor.userId,
              ctx.canManage,
              ctx.application?.organizationId ?? null,
              query.state,
              ...cursor,
            ],
          )
        ).rows;
        const items = [];
        for (const row of rows.slice(0, 20)) items.push(await read(tx, actor, row.id));
        return goalsSchema.parse({
          items,
          nextCursor: rows.length > 20 ? economyNext(rows[19]!) : null,
        });
      }),
    saveGoal(actor: PartnerActor, id: string | null, raw: unknown, key: string) {
      const supplied = goalInputSchema.parse(raw);
      const input = {
        ...supplied,
        scope:
          supplied.scope.kind === "self"
            ? { kind: "individual" as const, organizationId: null, userIds: [actor.userId] }
            : supplied.scope,
      };
      return transaction(
        actor,
        "pilotage.goal",
        key,
        { id, input },
        async (tx) => {
          const scope = await resolvePilotageScope(tx, actor, input.scope, true);
          let target = id;
          if (target) {
            const current = await access(tx, actor, target, true);
            if (!sameScope(current.scope, scope)) fail("PARTNER_INVALID_TRANSITION");
            const latest = (
              await tx.query<{ revision: number }>(
                "select revision from partner_goal_versions where goal_id=$1 order by revision desc limit 1",
                [target],
              )
            ).rows[0];
            if (latest?.revision !== input.expectedRevision) fail("PARTNER_CONFLICT", 409);
          } else {
            if (input.expectedRevision !== 0) fail("PARTNER_CONFLICT", 409);
            target = newId("pg");
            await tx.query(
              "insert into partner_goals(id,creator_id,scope_kind,organization_id,user_ids) values($1,$2,$3,$4,$5)",
              [
                target,
                actor.userId,
                scope.kind,
                scope.organizationId,
                JSON.stringify(scope.userIds),
              ],
            );
          }
          await tx.query(
            "insert into partner_goal_versions(id,goal_id,revision,author_id,input) values($1,$2,$3,$4,$5)",
            [newId("pgv"), target, input.expectedRevision + 1, actor.userId, input],
          );
          await event(tx, actor, null, "pilotage.goal_saved.v1", "", "private", target);
          return target;
        },
        (tx, target) => read(tx, actor, target),
      );
    },
  };
}
