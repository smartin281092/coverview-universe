import { and, eq } from "drizzle-orm";
import { authorizationNoticeSchema, lsa45NoticeVersion } from "@coverview/contracts";
import type { createDatabase } from "../../platform/db/database.js";
import { lockProfileOwner } from "./identity.profile.repository.js";
import { identityNoticeOpenings } from "./identity.notice.schema.js";

type Database = ReturnType<typeof createDatabase>["db"];

export function createNoticeRepository(db: Database) {
  async function get(userId: string, connection: Pick<Database, "select"> = db) {
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
