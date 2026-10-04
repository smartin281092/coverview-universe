import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { adminNotificationsSchema, authorizationIdSchema } from "@coverview/contracts";
import type { createDatabase } from "../../platform/db/database.js";
import { identityUsers, IdentityError } from "../identity/index.js";
import { authorizationSignatures as signatures } from "./authorizations.schema.js";

// The signature itself is the durable notification: commit and idempotence are shared.
// Select metadata only, never the drawing or the full signed document for this list.
export async function readSignatureNotifications(
  db: ReturnType<typeof createDatabase>["db"],
  encoded?: string,
) {
  const cursorSchema = z.object({ at: z.iso.datetime(), id: authorizationIdSchema }).strict();
  let cursor: z.infer<typeof cursorSchema> | undefined;
  if (encoded) {
    try {
      cursor = cursorSchema.parse(
        JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown,
      );
    } catch {
      throw new IdentityError("IDENTITY_ACCESS_DENIED", 400);
    }
  }
  const rows = await db
    .select({
      id: signatures.id,
      userId: signatures.userId,
      profileId: signatures.profileId,
      profileName: sql<string>`${signatures.receipt}->'document'->>'profileName'`,
      accountEmail: identityUsers.email,
      kind: signatures.kind,
      signedAt: signatures.signedAt,
      revokedAt: signatures.revokedAt,
    })
    .from(signatures)
    .innerJoin(identityUsers, eq(identityUsers.id, signatures.userId))
    .where(
      cursor
        ? or(
            lt(signatures.signedAt, new Date(cursor.at)),
            and(eq(signatures.signedAt, new Date(cursor.at)), lt(signatures.id, cursor.id)),
          )
        : undefined,
    )
    .orderBy(desc(signatures.signedAt), desc(signatures.id))
    .limit(21);
  const page = rows.slice(0, 20);
  const last = page.at(-1);
  return adminNotificationsSchema.parse({
    notifications: page.map((row) => ({
      ...row,
      signedAt: row.signedAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
    })),
    nextCursor:
      rows.length > 20 && last
        ? Buffer.from(JSON.stringify({ at: last.signedAt.toISOString(), id: last.id })).toString(
            "base64url",
          )
        : null,
  });
}
