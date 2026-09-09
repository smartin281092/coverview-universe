import { and, desc, eq } from "drizzle-orm";
import type { createDatabase } from "../../platform/db/database.js";
import { assertDocumentProfileTarget } from "../profiles/index.js";
import { authorizationSignatures } from "./authorizations.schema.js";

type Database = ReturnType<typeof createDatabase>["db"];
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

// Bounded audit projection across versions; archived receipts stay behind their
// dedicated owner-scoped endpoint and are never loaded into an activity feed.
export async function readAuthorizationActivity(
  tx: Database | Tx,
  userId: string,
  profileId?: string,
) {
  if (profileId) await assertDocumentProfileTarget(tx, userId, profileId);
  const rows = await tx
    .select({
      id: authorizationSignatures.id,
      profileId: authorizationSignatures.profileId,
      kind: authorizationSignatures.kind,
      signedAt: authorizationSignatures.signedAt,
      version: authorizationSignatures.version,
      revokedAt: authorizationSignatures.revokedAt,
    })
    .from(authorizationSignatures)
    .where(
      and(
        eq(authorizationSignatures.userId, userId),
        profileId ? eq(authorizationSignatures.profileId, profileId) : undefined,
      ),
    )
    .orderBy(desc(authorizationSignatures.signedAt), desc(authorizationSignatures.id))
    .limit(201);
  return {
    entries: rows.slice(0, 200).map((row) => ({
      ...row,
      signedAt: row.signedAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
    })),
    incomplete: rows.length > 200,
  };
}
