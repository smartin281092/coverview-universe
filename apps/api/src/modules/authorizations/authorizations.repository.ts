import { createHash, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  authorizationTexts,
  authorizationDocumentSchema,
  authorizationKindSchema,
  authorizationReceiptSchema,
  authorizationSignInputSchema,
  authorizationStatusSchema,
  type AuthorizationDocument,
  type AuthorizationSignInput,
} from "@coverview/contracts";
import type { createDatabase } from "../../platform/db/database.js";
import {
  IdentityError,
  lockProfileActor,
  readDocumentProfile,
  type ProfileActor,
} from "../identity/index.js";
import { assertDocumentProfileTarget, readManagedDocumentProfile } from "../profiles/index.js";
import { authorizationSignatures } from "./authorizations.schema.js";
import { readSignatureNotifications } from "./authorizations.notifications.js";
type Database = ReturnType<typeof createDatabase>["db"];
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const invalid = () => new IdentityError("IDENTITY_ACCESS_DENIED", 422);

export async function readAuthorizationStatus(
  tx: Database | Tx,
  userId: string,
  profileId: string,
) {
  await assertDocumentProfileTarget(tx, userId, profileId);
  const rows = await tx
    .select()
    .from(authorizationSignatures)
    .where(
      and(
        eq(authorizationSignatures.userId, userId),
        eq(authorizationSignatures.profileId, profileId),
        eq(authorizationSignatures.version, authorizationTexts.version),
        isNull(authorizationSignatures.revokedAt),
      ),
    )
    .limit(2);
  const result = (kind: "procuration" | "mandate") => {
    const row = rows.find((item) => item.kind === kind);
    return { id: row?.id ?? null, signedAt: row?.signedAt.toISOString() ?? null };
  };
  return authorizationStatusSchema.parse({
    procuration: result("procuration"),
    mandate: result("mandate"),
  });
}

async function draft(
  tx: Database | Tx,
  userId: string,
  kind: "procuration" | "mandate",
  profileId: string,
) {
  await assertDocumentProfileTarget(tx, userId, profileId);
  let values: Record<string, string>;
  let revision: number;
  let profileKind: "person" | "legal_entity";
  let profileName: string;
  if (profileId === "self") {
    const profile = await readDocumentProfile(tx, userId);
    values = Object.fromEntries(
      Object.entries(profile.fields).flatMap(([key, field]) =>
        field?.value ? [[key, field.value]] : [],
      ),
    );
    revision = profile.revision;
    profileKind = "person";
    profileName = [values.firstName, values.lastName].filter(Boolean).join(" ");
  } else {
    const profile = await readManagedDocumentProfile(tx, userId, profileId);
    values = Object.fromEntries(
      Object.entries(profile.values).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
    revision = profile.revision;
    profileKind = profile.kind;
    profileName =
      profileKind === "legal_entity"
        ? (values.companyName ?? "")
        : [values.firstName, values.lastName].filter(Boolean).join(" ");
  }
  // Keep only the identifying/contact data presented in the document, not AVS or finance/health.
  values = Object.fromEntries(
    [
      "firstName",
      "lastName",
      "companyName",
      "registrationNumber",
      "birthDate",
      "street",
      "postalCode",
      "city",
      "country",
      "contactEmail",
      "phone",
    ].flatMap((key) => (values[key] ? [[key, values[key]]] : [])),
  );
  const content = {
    kind,
    profileId,
    profileName,
    profileKind,
    profileRevision: revision,
    version: authorizationTexts.version,
    title: kind === "mandate" ? "Mandat de gestion" : "Procuration",
    organization:
      "CoverView · Avenue Louis-Casaï 71, 1216 Cointrin · FINMA F01536662 · Sébastien Martin, FINMA F01537001",
    sections: authorizationTexts[kind],
    values,
  };
  const status = (await readAuthorizationStatus(tx, userId, profileId))[kind];
  return authorizationDocumentSchema.parse({
    ...content,
    contentHash: digest(content),
    canSign:
      profileKind === "legal_entity"
        ? !!values.companyName
        : !!values.firstName && !!values.lastName,
    signatureId: status.id,
    signedAt: status.signedAt,
  });
}

export function createAuthorizationRepository(db: Database) {
  return {
    notifications: (cursor?: string) => readSignatureNotifications(db, cursor),
    draft: (userId: string, kind: "procuration" | "mandate", profileId = "self") =>
      draft(db, userId, kind, profileId),
    status: (userId: string, profileId = "self") => readAuthorizationStatus(db, userId, profileId),
    async receipt(userId: string, id: string) {
      const [row] = await db
        .select()
        .from(authorizationSignatures)
        .where(and(eq(authorizationSignatures.id, id), eq(authorizationSignatures.userId, userId)))
        .limit(1);
      if (!row) throw new IdentityError("IDENTITY_ACCESS_DENIED", 404);
      return authorizationReceiptSchema.parse(row.receipt);
    },
    async sign(
      actor: ProfileActor,
      kind: "procuration" | "mandate",
      input: AuthorizationSignInput,
      key: string,
    ) {
      const data = authorizationSignInputSchema.parse(input);
      authorizationKindSchema.parse(kind);
      if (actor.administratorUserId || !z.uuid().safeParse(key).success) throw invalid();
      return db.transaction(async (tx) => {
        await lockProfileActor(tx, actor);
        await assertDocumentProfileTarget(tx, actor.userId, data.profileId);
        const requestHash = digest({ kind, data });
        const [previous] = await tx
          .select()
          .from(authorizationSignatures)
          .where(
            and(
              eq(authorizationSignatures.userId, actor.userId),
              eq(authorizationSignatures.commandKey, key),
            ),
          )
          .limit(1);
        if (previous) {
          if (previous.requestHash !== requestHash || previous.revokedAt) throw invalid();
          return authorizationReceiptSchema.parse(previous.receipt);
        }
        const document: AuthorizationDocument = await draft(tx, actor.userId, kind, data.profileId);
        if (
          document.contentHash !== data.contentHash ||
          document.profileRevision !== data.profileRevision ||
          document.signedAt
        )
          throw new IdentityError("PROFILE_CONFLICT", 409);
        if (!document.canSign || (data.profileId !== "self" && !data.representative))
          throw invalid();
        const normalize = (value: string) =>
          value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("fr");
        if (
          data.profileId === "self" &&
          normalize(data.signerName) !== normalize(document.profileName)
        )
          throw invalid();
        const signedAt = new Date();
        const id = `sig_${randomUUID()}`;
        const content = {
          id,
          document,
          accepted: true as const,
          signerName: data.signerName,
          place: data.place,
          representative: data.representative,
          drawing: data.drawing,
          signedAt: signedAt.toISOString(),
        };
        const receipt = authorizationReceiptSchema.parse({
          ...content,
          integrityHash: digest(content),
        });
        await tx.insert(authorizationSignatures).values({
          id,
          userId: actor.userId,
          managedProfileId: data.profileId === "self" ? null : data.profileId,
          profileId: data.profileId,
          kind,
          version: document.version,
          sessionId: actor.id,
          commandKey: key,
          requestHash,
          receipt,
          signedAt,
        });
        return receipt;
      });
    },
  };
}
