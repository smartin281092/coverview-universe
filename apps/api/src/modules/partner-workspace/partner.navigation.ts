import type { Pool, PoolClient } from "pg";
import {
  leadViewInputSchema,
  leadViewSchema,
  leadViewsSchema,
  type LeadViewInput,
} from "@coverview/contracts/partner-navigation";
import { context, fail, type PartnerActor } from "./partner.policy.js";
import { economyRead, type EconomyMutation } from "./partner.commercial.js";
import { event, newId } from "./partner.audit.js";
type Row = {
  id: string;
  user_id: string;
  name: string;
  revision: number;
  filters: unknown;
  active: boolean;
  updated_at: Date;
};
const dto = (r: Row) => leadViewSchema.parse({ ...r, updatedAt: r.updated_at.toISOString() });
export function createNavigationOperations(pool: Pool, transaction: EconomyMutation) {
  async function access(tx: PoolClient, actor: PartnerActor) {
    if (actor.wallet || !(await context(tx, actor, true)).operational)
      fail("PARTNER_ACCESS_DENIED", 403);
    if (
      !(
        await tx.query<{ table: string | null }>(
          "select to_regclass('partner_lead_views')::text as table",
        )
      ).rows[0]?.table
    )
      fail("PARTNER_UNAVAILABLE", 503);
  }
  async function read(tx: PoolClient, actor: PartnerActor, id: string) {
    await access(tx, actor);
    const row = (
      await tx.query<Row>(
        "select * from partner_lead_views where id=$1 and user_id=$2 for update",
        [id, actor.userId],
      )
    ).rows[0];
    if (!row) return fail("PARTNER_NOT_FOUND", 404);
    return dto(row);
  }
  return {
    leadViews: (actor: PartnerActor) =>
      economyRead(pool, actor, async (tx) => {
        await access(tx, actor);
        const rows = (
          await tx.query<Row>(
            "select * from partner_lead_views where user_id=$1 and active order by updated_at desc,id desc limit 21",
            [actor.userId],
          )
        ).rows;
        if (rows.length > 20) fail("PARTNER_ACTION_REQUIRED");
        return leadViewsSchema.parse({ items: rows.map(dto) });
      }),
    saveLeadView: (actor: PartnerActor, raw: LeadViewInput, key: string) => {
      const input = leadViewInputSchema.parse(raw);
      return transaction(
        actor,
        "navigation.view",
        key,
        input,
        async (tx) => {
          await access(tx, actor);
          const current = input.id ? await read(tx, actor, input.id) : null;
          if (
            current ? current.revision !== input.revision || !current.active : input.revision !== 0
          )
            fail("PARTNER_CONFLICT", 409);
          if (
            input.action === "save" &&
            input.filters.createdFrom &&
            input.filters.createdTo &&
            Date.parse(input.filters.createdFrom) >= Date.parse(input.filters.createdTo)
          )
            fail("PARTNER_ACTION_REQUIRED");
          const id = input.id ?? newId("pview");
          if (!current) {
            if (input.action !== "save") fail("PARTNER_NOT_FOUND", 404);
            const rows = await tx.query(
              "select id from partner_lead_views where user_id=$1 and active limit 20",
              [actor.userId],
            );
            if (rows.rowCount === 20) fail("PARTNER_ACTION_REQUIRED");
            await tx.query(
              "insert into partner_lead_views(id,user_id,name,revision,filters) values($1,$2,$3,1,$4)",
              [id, actor.userId, input.name, JSON.stringify(input.filters)],
            );
          } else if (input.action === "remove")
            await tx.query(
              "update partner_lead_views set active=false,revision=revision+1,updated_at=clock_timestamp() where id=$1 and user_id=$2",
              [id, actor.userId],
            );
          else
            await tx.query(
              "update partner_lead_views set name=$3,filters=$4,revision=revision+1,updated_at=clock_timestamp() where id=$1 and user_id=$2",
              [id, actor.userId, input.name, JSON.stringify(input.filters)],
            );
          await event(
            tx,
            actor,
            null,
            input.action === "save" ? "navigation.view_saved.v1" : "navigation.view_removed.v1",
            "",
            "private",
            id,
          );
          return id;
        },
        (tx, id) => read(tx, actor, id),
      );
    },
  };
}
