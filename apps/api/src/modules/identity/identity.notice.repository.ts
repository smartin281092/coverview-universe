import { and, desc, eq } from "drizzle-orm";
import { authorizationNoticeSchema, lsa45NoticeVersion } from "@coverview/contracts";
import type { createDatabase } from "../../platform/db/database.js";
import { lockProfileOwner } from "./identity.profile.repository.js";
import { identityNoticeOpenings } from "./identity.notice.schema.js";

type Database = ReturnType<typeof createDatabase>["db"];

// Read-only module boundary for authenticated owner-scoped projections.
// This never records an opening or treats a notice as a signature.
export async function readAuthorizationNotice(
  connection: Pick<Database, "select">,
  userId: string,
) {
  const [row] = await connection
    .select({ firstOpenedAt: identityNoticeOpenings.firstOpenedAt })
    .from(identityNoticeOpenings)
    .where(
      and(
        eq(identityNoticeOpenings.userId, userId),
        eq(identityNoticeOpenings.version, lsa45NoticeVersion),
      ),
    )
    .limit(1);
  return authorizationNoticeSchema.parse({
    version: lsa45NoticeVersion,
    firstOpenedAt: row?.firstOpenedAt.toISOString() ?? null,
  });
}

export async function readAuthorizationNoticeActivity(
  connection: Pick<Database, "select">,
  userId: string,
) {
  const rows = await connection
    .select({
      version: identityNoticeOpenings.version,
      firstOpenedAt: identityNoticeOpenings.firstOpenedAt,
    })
    .from(identityNoticeOpenings)
    .where(eq(identityNoticeOpenings.userId, userId))
    .orderBy(desc(identityNoticeOpenings.firstOpenedAt), desc(identityNoticeOpenings.version))
    .limit(201);
  return {
    entries: rows
      .slice(0, 200)
      .map((row) => ({ ...row, firstOpenedAt: row.firstOpenedAt.toISOString() })),
    incomplete: rows.length > 200,
  };
}

export function createNoticeRepository(db: Database) {
  const get = (userId: string, connection: Pick<Database, "select"> = db) =>
    readAuthorizationNotice(connection, userId);
  return {
    get,
    opened: (userId: string, sessionId: string) =>
      db.transaction(async (tx) => {
        await lockProfileOwner(tx, userId, sessionId);
        // Monotone et idempotent par utilisateur/version, même avec plusieurs clés de retry.
        await tx
          .insert(identityNoticeOpenings)
          .values({ userId, sessionId, version: lsa45NoticeVersion })
          .onConflictDoNothing();
        return get(userId, tx);
      }),
  };
}
