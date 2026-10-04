import { z } from "zod";
import type { Pool, PoolClient } from "pg";
import {
  partnerApplicationSchema,
  type PartnerApplication,
  type PartnerContext,
  partnerErrors,
} from "@coverview/contracts/partner";

export type PartnerActor = { userId: string; id: string; administrator: boolean; wallet?: boolean };
export type Executor = Pick<Pool | PoolClient, "query">;
export class PartnerError extends Error {
  constructor(
    readonly code: (typeof partnerErrors)[number],
    readonly statusCode = 422,
  ) {
    super(code);
  }
}
export function fail(code: (typeof partnerErrors)[number], status = 422): never {
  throw new PartnerError(code, status);
}
export const date = (value: Date | string | null) => (value ? new Date(value).toISOString() : null);
export function camel<T>(row: Record<string, unknown>): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/gu, (_, letter: string) => letter.toUpperCase()),
      value,
    ]),
  ) as T;
}
export async function membership(
  db: Executor,
  userId: string,
  lock = false,
): Promise<PartnerApplication | null> {
  const row = (
    await db.query<Record<string, unknown>>(
      `select m.*, o.state organization_state from partner_members m join partner_organizations o on o.id=m.organization_id where m.user_id=$1 ${lock ? "for share of m,o" : ""}`,
      [userId],
    )
  ).rows[0];
  if (!row) return null;
  return partnerApplicationSchema.parse({
    ...z.record(z.string(), z.unknown()).parse(row.application),
    userId: row.user_id,
    organizationId: row.organization_id,
    state: row.state,
    organizationState: row.organization_state,
    grantedRoles: row.roles,
    revision: row.revision,
    reviewReason: row.review_reason,
    reviewedAt: date(row.reviewed_at as Date | null),
    reviewDueAt: date(row.review_due_at as Date | null),
  });
}
export async function context(
  db: Executor,
  actor: PartnerActor,
  lock = false,
): Promise<PartnerContext> {
  const application = await membership(db, actor.userId, lock);
  const operational =
    actor.administrator ||
    !!(
      application?.state === "approved" &&
      application.organizationState === "approved" &&
      (!application.reviewDueAt || new Date(application.reviewDueAt).getTime() > Date.now())
    );
  return {
    administrator: actor.administrator,
    operational,
    application,
    canCreate:
      operational &&
      (actor.administrator ||
        !!application?.grantedRoles.some((r) => r === "referrer" || r === "advisor")),
    canAdvise:
      operational && (actor.administrator || !!application?.grantedRoles.includes("advisor")),
    canManage:
      operational && (actor.administrator || !!application?.grantedRoles.includes("manager")),
  };
}
export const ownedClient = `(l.client_profile_id is null and l.client_user_id=$1 or exists(select 1 from managed_profiles cp where cp.id=l.client_profile_id and cp.user_id=$1))`;
export const assigned = `(exists(select 1 from partner_members am where am.user_id=$1 and am.roles ? 'advisor') and (l.responsible_id=$1 or exists(select 1 from partner_contributors pc where pc.lead_id=l.id and pc.user_id=$1 and pc.revoked_at is null)))`;
export const managed = `exists(select 1 from partner_members me join partner_members colleague on colleague.organization_id=me.organization_id where me.user_id=$1 and me.roles ? 'manager' and colleague.user_id=l.responsible_id)`;
export function visible(actor: PartnerActor) {
  if (actor.wallet) return ownedClient;
  if (actor.administrator) return "($1::text is not null)";
  return `exists(select 1 from partner_members vm join partner_organizations vo on vo.id=vm.organization_id where vm.user_id=$1 and vm.state='approved' and vo.state='approved' and (vm.review_due_at is null or vm.review_due_at>now())) and (${assigned} or l.creator_id=$1 or ${managed})`;
}
export async function lockActor(db: Executor, actor: PartnerActor) {
  const user = await db.query<Record<string, unknown>>(
    "select id from identity_users where id=$1 and global_revocation_pending=false for no key update",
    [actor.userId],
  );
  const session = await db.query<Record<string, unknown>>(
    "select id,mfa_verified_at from identity_sessions where id=$1 and user_id=$2 and revoked_at is null and expires_at>clock_timestamp() for update",
    [actor.id, actor.userId],
  );
  if (!user.rowCount || !session.rowCount) fail("PARTNER_ACCESS_DENIED", 403);
  if (actor.administrator) {
    const permission = await db.query<Record<string, unknown>>(
      "select id from identity_admin_permissions where user_id=$1 and permission='administration.access' and revoked_at is null for share",
      [actor.userId],
    );
    const mfa = session.rows[0]?.mfa_verified_at as Date | null;
    if (
      !permission.rowCount ||
      !mfa ||
      mfa.getTime() > Date.now() ||
      Date.now() - mfa.getTime() >= 86400000
    )
      fail("PARTNER_ACCESS_DENIED", 403);
  }
}
