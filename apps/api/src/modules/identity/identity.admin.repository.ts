import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, ilike, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  adminUserSchema,
  adminUserIdSchema,
  adminUsersSchema,
  adminUsersQuerySchema,
  type AdminUsersQuery,
} from "@coverview/contracts";
import type { createDatabase } from "../../platform/db/database.js";
import { identityAuditEvents, identityProfiles, identityUsers } from "./identity.schema.js";
import { IdentityError } from "./identity.security.js";

type Database = ReturnType<typeof createDatabase>["db"];
const cursorSchema = z
  .object({
    id: adminUserIdSchema,
    createdAt: z.iso.datetime(),
    queryHash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();
const displayName = sql<
  string | null
>`nullif(trim(concat_ws(' ', ${identityProfiles.fields}->'firstName'->>'value', ${identityProfiles.fields}->'lastName'->>'value')), '')`;
const columns = {
  id: identityUsers.id,
  email: identityUsers.email,
  createdAt: identityUsers.createdAt,
  displayName,
};
const dto = (row: { id: string; email: string; createdAt: Date; displayName: string | null }) =>
  adminUserSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });

export function createAdminUserRepository(db: Database) {
  return {
    async list(supplied: AdminUsersQuery) {
      const input = adminUsersQuerySchema.parse(supplied);
      const query = input.q?.toLowerCase() ?? "";
      const queryHash = createHash("sha256").update(query).digest("hex");
      let cursor: z.infer<typeof cursorSchema> | undefined;
      if (input.cursor) {
        try {
          cursor = cursorSchema.parse(
            JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")) as unknown,
          );
          if (cursor.queryHash !== queryHash) throw new Error("Cursor search mismatch");
        } catch {
          throw new IdentityError("IDENTITY_ACCESS_DENIED", 400);
        }
      }
      // Search characters are literals, not caller-controlled SQL LIKE wildcards.
      const pattern = `%${query.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
      const rows = await db
        .select(columns)
        .from(identityUsers)
        .leftJoin(identityProfiles, eq(identityProfiles.userId, identityUsers.id))
        .where(
          and(
            query
              ? or(ilike(identityUsers.email, pattern), ilike(displayName, pattern))
              : undefined,
            cursor
              ? or(
                  lt(identityUsers.createdAt, new Date(cursor.createdAt)),
                  and(
                    eq(identityUsers.createdAt, new Date(cursor.createdAt)),
                    lt(identityUsers.id, cursor.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(identityUsers.createdAt), desc(identityUsers.id))
        .limit(input.limit + 1);
      const users = rows.slice(0, input.limit).map(dto);
      const last = users.at(-1);
      return adminUsersSchema.parse({
        users,
        nextCursor:
          rows.length > input.limit && last
            ? Buffer.from(
                JSON.stringify({ id: last.id, createdAt: last.createdAt, queryHash }),
              ).toString("base64url")
            : null,
      });
    },
    async get(userId: string) {
      const [row] = await db
        .select(columns)
        .from(identityUsers)
        .leftJoin(identityProfiles, eq(identityProfiles.userId, identityUsers.id))
        .where(eq(identityUsers.id, userId))
        .limit(1);
      if (!row) throw new IdentityError("IDENTITY_NOT_FOUND", 404);
      return dto(row);
    },
    async audit(
      actor: { id: string; userId: string },
      requestId: string,
      targetUserId: string | null,
      resource: string,
      operation: string,
    ) {
      await db.insert(identityAuditEvents).values({
        id: `audit_${randomUUID()}`,
        userId: actor.userId,
        sessionId: actor.id,
        action: "administration.access",
        requestId,
        // Existing durable audit context: JSON is queryable with ::jsonb for this action.
        // No contact details, search term, profile values, or document contents are retained.
        deduplicationKey: JSON.stringify({
          version: 1,
          nonce: randomUUID(),
          targetUserId,
          resource,
          operation,
        }),
      });
    },
  };
}
