import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  adminProfileDirectoryQuerySchema,
  adminProfileDirectorySchema,
  adminProfileTransferInputSchema,
  adminProfileTransferResultSchema,
  type AdminProfileTransferInput,
} from "@coverview/contracts";
import type { createDatabase } from "./db/database.js";
import { identityUsers } from "../modules/identity/identity.schema.js";
import {
  lockProfileActor,
  type ProfileActor,
} from "../modules/identity/identity.profile.repository.js";
import { IdentityError } from "../modules/identity/identity.security.js";
import { managedProfiles } from "../modules/profiles/profiles.schema.js";
import { actionCenterIdentity } from "../modules/document-intelligence/document.action-center.projection.js";
import { adminProfileTransfers } from "./admin-profile-transfer.schema.js";

type Database = ReturnType<typeof createDatabase>["db"];
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export class ProfileTransferError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
  ) {
    super(code);
    this.name = "ProfileTransferError";
  }
}
const conflict = () => new ProfileTransferError("PROFILE_TRANSFER_CONFLICT", 409);
const cursorSchema = z
  .object({ id: z.string().max(450), at: z.iso.datetime(), queryHash: z.string().length(64) })
  .strict();
const receipt = (row: typeof adminProfileTransfers.$inferSelect) =>
  adminProfileTransferResultSchema.parse({
    transferId: row.id,
    profileId: row.profileId,
    sourceUserId: row.sourceUserId,
    destinationUserId: row.destinationUserId,
    revision: row.revision,
    transferredAt: row.createdAt.toISOString(),
  });

export function createAdminProfileTransferRepository(db: Database) {
  return {
    async directory(supplied: z.input<typeof adminProfileDirectoryQuerySchema>) {
      const input = adminProfileDirectoryQuerySchema.parse(supplied);
      const query = input.q?.toLocaleLowerCase("fr") ?? "";
      const queryHash = hash(query);
      let cursor: z.infer<typeof cursorSchema> | undefined;
      if (input.cursor) {
        try {
          cursor = cursorSchema.parse(
            JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")) as unknown,
          );
          if (cursor.queryHash !== queryHash) throw new Error("Mismatched search");
        } catch {
          throw new IdentityError("IDENTITY_ACCESS_DENIED", 400);
        }
      }
      const pattern = `%${query.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
      const rows = await db.execute<{
        row_id: string;
        profile_id: string;
        user_id: string;
        kind: string;
        is_self: boolean;
        display_name: string;
        account_email: string;
        account_display_name: string | null;
        created_at: string;
      }>(sql`
        with accounts as (
          select u.id, u.email, u.created_at,
            nullif(trim(concat_ws(' ', p.fields->'firstName'->>'value', p.fields->'lastName'->>'value')), '') as display_name
          from identity_users u left join identity_profiles p on p.user_id = u.id
        ), directory as (
          select a.id || ':self' as row_id, 'self' as profile_id, a.id as user_id, 'person' as kind,
            true as is_self, coalesce(a.display_name, a.email) as display_name, a.email as account_email,
            a.display_name as account_display_name, a.created_at from accounts a
          union all
          select p.user_id || ':' || p.id, p.id, p.user_id, p.kind, false, p.display_name, a.email,
            a.display_name, p.created_at from managed_profiles p join accounts a on a.id = p.user_id
        )
        select * from directory
        where ${query ? sql`(display_name ilike ${pattern} or account_email ilike ${pattern} or account_display_name ilike ${pattern})` : sql`true`}
          and ${cursor ? sql`(created_at, row_id) < (${cursor.at}::timestamptz, ${cursor.id})` : sql`true`}
        order by created_at desc, row_id desc limit ${input.limit + 1}
      `);
      const page = rows.rows.slice(0, input.limit);
      const last = page.at(-1);
      return adminProfileDirectorySchema.parse({
        profiles: page.map((row) => ({
          profileId: row.profile_id,
          userId: row.user_id,
          kind: row.kind,
          isSelf: row.is_self,
          displayName: row.display_name,
          accountEmail: row.account_email,
          accountDisplayName: row.account_display_name,
          createdAt: new Date(row.created_at).toISOString(),
        })),
        nextCursor:
          rows.rows.length > input.limit && last
            ? Buffer.from(
                JSON.stringify({
                  id: last.row_id,
                  at: new Date(last.created_at).toISOString(),
                  queryHash,
                }),
              ).toString("base64url")
            : null,
      });
    },
    async transfer(
      actor: ProfileActor,
      profileId: string,
      supplied: AdminProfileTransferInput,
      suppliedKey: string,
    ) {
      if (!actor.administratorUserId) throw new IdentityError("IDENTITY_ACCESS_DENIED", 403);
      const administratorUserId = actor.administratorUserId;
      const input = adminProfileTransferInputSchema.parse(supplied);
      const key = z.uuid().parse(suppliedKey).toLowerCase();
      if (profileId === "self")
        throw new ProfileTransferError("PROFILE_TRANSFER_SELF_UNAVAILABLE", 422);
      if (input.destinationUserId === actor.userId)
        throw new ProfileTransferError("PROFILE_TRANSFER_SAME_ACCOUNT", 422);
      const requestHash = hash({ sourceUserId: actor.userId, profileId, input });
      return db.transaction(async (tx) => {
        // Same ordering as every owner command and worker. Locks include both accounts before
        // rechecking the actual administrator session, permission and fresh MFA under lock.
        const owners = await tx
          .select({ id: identityUsers.id, pending: identityUsers.globalRevocationPending })
          .from(identityUsers)
          .where(
            inArray(identityUsers.id, [
              ...new Set([actor.userId, input.destinationUserId, administratorUserId]),
            ]),
          )
          .orderBy(asc(identityUsers.id))
          .for("no key update");
        await lockProfileActor(tx, actor);
        if (!owners.some((owner) => owner.id === input.destinationUserId))
          throw new IdentityError("IDENTITY_NOT_FOUND", 404);
        if (owners.some((owner) => owner.pending))
          throw new IdentityError("IDENTITY_UNAUTHENTICATED", 401);
        const [previous] = await tx
          .select()
          .from(adminProfileTransfers)
          .where(
            and(
              eq(adminProfileTransfers.administratorUserId, administratorUserId),
              eq(adminProfileTransfers.commandKey, key),
            ),
          )
          .limit(1);
        if (previous) {
          if (previous.requestHash !== requestHash)
            throw new ProfileTransferError("PROFILE_TRANSFER_IDEMPOTENCY_REUSED", 422);
          return receipt(previous);
        }
        const [profile] = await tx
          .select()
          .from(managedProfiles)
          .where(and(eq(managedProfiles.userId, actor.userId), eq(managedProfiles.id, profileId)))
          .limit(1)
          .for("update");
        if (!profile || profile.revision !== input.revision) throw conflict();
        // Worker transitions lock the document directly, so owner locks alone are insufficient.
        // Lock the bounded live set before inspecting states; waiting workers recheck ownership.
        const locked = await tx.execute<{ id: string }>(sql`select id from files
          where user_id = ${actor.userId} and managed_profile_id = ${profileId} and deleted_at is null
          order by id limit 201 for update`);
        if (locked.rows.length > 200)
          throw new ProfileTransferError("PROFILE_TRANSFER_DESTINATION_LIMIT", 422);
        const counts = await tx.execute<{ profiles: number; files: number; busy: boolean }>(sql`
          select (select count(*)::int from managed_profiles where user_id = ${input.destinationUserId}) as profiles,
            (select count(*)::int from files where deleted_at is null and (user_id = ${input.destinationUserId}
              or (user_id = ${actor.userId} and managed_profile_id = ${profileId}))) as files,
            exists(select 1 from files f where f.user_id = ${actor.userId} and f.managed_profile_id = ${profileId}
              and (f.state in ('pending','queued','scanning','reading','deleting')
                or exists(select 1 from document_outbox o where o.document_id = f.id and o.published_at is null))) as busy
        `);
        const count = counts.rows[0];
        if (!count || count.profiles >= 49 || count.files > 200)
          throw new ProfileTransferError("PROFILE_TRANSFER_DESTINATION_LIMIT", 422);
        if (count.busy) throw new ProfileTransferError("PROFILE_TRANSFER_BUSY", 409);
        // Migration makes only dossier composite FKs deferrable. They are rechecked at commit;
        // no invalid ownership can become visible to another transaction, even on failure.
        await tx.execute(sql`set constraints all deferred`);
        const destination = input.destinationUserId;
        const source = actor.userId;
        const ownDocuments = sql`select id from files where user_id = ${source} and managed_profile_id = ${profileId}`;
        for (const table of [
          "document_change_requests",
          "document_field_corrections",
          "document_decisions",
        ])
          await tx.execute(
            sql`update ${sql.identifier(table)} set user_id = ${destination} where user_id = ${source} and document_id in (${ownDocuments})`,
          );
        // Old response snapshots must never replay personal data to the previous account.
        await tx.execute(
          sql`delete from document_commands where user_id = ${source} and document_id in (${ownDocuments})`,
        );
        await tx.execute(sql`delete from managed_profile_commands where user_id = ${source}
          and coalesce(response->>'profileId', response->>'id') = ${profileId}`);
        await tx.execute(
          sql`delete from company_action_commands where user_id = ${source} and response->>'profileId' = ${profileId}`,
        );
        await tx.execute(sql`delete from action_center_commands where user_id = ${source}
          and coalesce(response->>'profileId', response->'action'->>'profileId', response->'resolution'->>'profileId') = ${profileId}`);
        await tx.execute(
          sql`delete from client_activity_commands where user_id = ${source} and profile_id = ${profileId}`,
        );
        // No profile target is stored in legacy identity command receipts; clear only their
        // transient keys. Revision checks still protect commands for unrelated profiles.
        await tx.execute(
          sql`delete from document_identity_attachment_commands where user_id = ${source}`,
        );
        const requests = sql`select id from company_service_requests where user_id = ${source} and managed_profile_id = ${profileId}`;
        for (const table of ["company_action_evidence", "company_action_audit"])
          await tx.execute(
            sql`update ${sql.identifier(table)} set user_id = ${destination} where user_id = ${source} and request_id in (${requests})`,
          );
        const topics = await tx.execute<{
          topic: string;
        }>(sql`select distinct topic from action_center_resolutions
          where user_id = ${source} and profile_id = ${profileId} order by topic limit 101`);
        if (topics.rows.length > 100) throw conflict();
        for (const { topic } of topics.rows) {
          const actionId = actionCenterIdentity(destination, profileId, topic);
          await tx.execute(sql`update action_center_manual_reviews set user_id = ${destination}, action_id = ${actionId}
            where user_id = ${source} and profile_id = ${profileId} and topic = ${topic}`);
          await tx.execute(sql`update action_center_resolutions set user_id = ${destination}, action_id = ${actionId},
            history = jsonb_set(history, '{actionId}', ${JSON.stringify(actionId)}::jsonb)
            where user_id = ${source} and profile_id = ${profileId} and topic = ${topic}`);
        }
        const now = new Date();
        // Signer identity, session and signed receipt remain historical evidence. A new
        // account receives the dossier, never a consent attributed to its own identity.
        await tx.execute(sql`update authorization_signatures set user_id = ${destination}, revoked_at = coalesce(revoked_at, ${now})
          where user_id = ${source} and managed_profile_id = ${profileId}`);
        for (const table of [
          "managed_profile_sections",
          "managed_document_identity_attachments",
          "company_service_requests",
          "client_activities",
        ])
          await tx.execute(
            sql`update ${sql.identifier(table)} set user_id = ${destination} where user_id = ${source} and managed_profile_id = ${profileId}`,
          );
        // object_key is intentionally immutable: the storage adapter uses it as AES-GCM AAD.
        // Ownership is checked in SQL on every download, not inferred from the object's key.
        await tx.execute(sql`update files set user_id = ${destination}, revision = revision + 1, updated_at = ${now}
          where user_id = ${source} and managed_profile_id = ${profileId}`);
        await tx
          .update(managedProfiles)
          .set({ userId: destination, revision: profile.revision + 1, updatedAt: now })
          .where(and(eq(managedProfiles.userId, source), eq(managedProfiles.id, profileId)));
        const [event] = await tx
          .insert(adminProfileTransfers)
          .values({
            id: `ptransfer_${randomUUID()}`,
            profileId,
            sourceUserId: source,
            destinationUserId: destination,
            administratorUserId,
            sessionId: actor.id,
            commandKey: key,
            requestHash,
            revision: profile.revision + 1,
            createdAt: now,
          })
          .returning();
        if (!event) throw conflict();
        return receipt(event);
      });
    },
  };
}
