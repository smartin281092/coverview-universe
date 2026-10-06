import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import { partnerApplicationInputSchema } from "@coverview/contracts/partner";
import { createDatabase } from "./db/database.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";
import { createDocumentRepository } from "../modules/document-intelligence/document.repository.js";
import { createDocumentService } from "../modules/document-intelligence/document.service.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
let files: ReturnType<typeof createDocumentRepository>;
let service: ReturnType<typeof createDocumentService>;
let admin: PartnerActor;
const stored = new Map<string, Buffer>();
const key = () => randomUUID();
const reason = "Décision motivée dans un test isolé";
const presentation =
  "Conseillère en assurances dans un test isolé, sans aucune donnée réelle de personne.";
// A 1×1 PNG and a PDF: only magic bytes matter to the type detection.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const pdf = Buffer.from("%PDF-1.7\nIsolated document, never an image");
const image = (bytes: Buffer, name = "photo.png") => ({
  name,
  mime: "image/png" as const,
  size: bytes.length,
  checksum: createHash("sha256").update(bytes).digest("hex"),
});

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_pictures_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  await migrate(database.db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle/", import.meta.url)),
  });
  repository = createPartnerRepository(database.pool);
  files = createDocumentRepository(database.db);
  service = createDocumentService(files, {
    put: (objectKey, value) => {
      stored.set(objectKey, value);
      return Promise.resolve();
    },
    get: (objectKey) => Promise.resolve(stored.get(objectKey)!),
    remove: (objectKey) => {
      stored.delete(objectKey);
      return Promise.resolve();
    },
    close: () => {},
  });
  admin = await actor({ administrator: true });
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});

async function actor(
  options: { administrator?: boolean; email?: string } = {},
): Promise<PartnerActor> {
  const administrator = options.administrator ?? false;
  const value = { userId: `user_${key()}`, id: `session_${key()}`, administrator };
  await database.pool.query(
    "insert into identity_users(id,workos_user_id,email) values($1,$2,$3)",
    [value.userId, key(), options.email ?? `${key()}@pictures.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    value.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated pictures',now()+interval '1 hour',now()-interval '1 second')",
    [value.id, value.userId, key(), createHash("sha256").update(key()).digest("hex")],
  );
  if (administrator)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated test')",
      [key(), value.userId],
    );
  return value;
}
const application = (name: string) =>
  partnerApplicationInputSchema.parse({
    name,
    organization: `Cabinet ${name}`,
    phone: "",
    roles: ["advisor"],
    categories: ["vehicle"],
    languages: "fr",
    regions: "GE",
    qualifications: "Test",
  });
async function approve(person: PartnerActor, roles: ("advisor" | "manager")[] = ["advisor"]) {
  const current = (await repository.context(person)).application!;
  await repository.review(
    admin,
    person.userId,
    {
      revision: current.revision,
      state: "approved",
      roles,
      reason: "Validation dans un test isolé",
      reviewDueAt: null,
      ...(current.organizationState === "approved" ? {} : { organizationState: "approved" }),
    },
    key(),
  );
}
async function professional(name: string, roles: ("advisor" | "manager")[] = ["advisor"]) {
  const person = await actor();
  await repository.apply(person, application(name), key());
  await approve(person, roles);
  return person;
}
// Sends the bytes through the same checks as the HTTP route, then the scanner finds them clean.
async function uploadPhoto(person: PartnerActor, bytes: Buffer, scan = true) {
  const authorize = () => repository.profilePhotoSource(person, person.userId, null, true);
  const original = await authorize();
  await service.uploadShared(
    original.userId,
    original.documentId,
    bytes,
    async () => {
      await authorize();
    },
    (mime) => repository.completeProfilePhotoUpload(person, person.userId, mime),
  );
  if (scan)
    await database.pool.query(
      "update files set state='ready',scan_version='isolated',revision=revision+1 where id=$1",
      [original.documentId],
    );
  return original.documentId;
}
async function submitProfile(
  person: PartnerActor,
  photo: "keep" | "remove" | ReturnType<typeof image>,
) {
  const dossier = await repository.profileDossier(person, person.userId);
  return repository.submitProfile(
    person,
    person.userId,
    { revision: dossier.current?.revision ?? 0, presentation, photo, confirmed: true },
    key(),
  );
}
const decideProfile = async (person: PartnerActor, decision: "published" | "rejected") =>
  repository.reviewProfile(
    admin,
    person.userId,
    {
      revision: (await repository.profileDossier(admin, person.userId)).current!.revision,
      decision,
      reason,
    },
    key(),
  );

it("publishes a scanned profile photo only, to the profile's audience, and keeps it across versions", async () => {
  const person = await professional("Pia Photo");
  const colleague = await professional("Carl Confrère");
  const stranger = { ...(await actor()), wallet: true };

  // A file that is not an image is never queued for scanning nor served.
  await submitProfile(person, image(pdf, "photo.png"));
  const refused = await repository.profilePhotoSource(person, person.userId, null, true);
  await expect(uploadPhoto(person, pdf, false)).rejects.toMatchObject({
    code: "PARTNER_INVALID_DOCUMENT",
  });
  expect((await files.original(person.userId, refused.documentId)).state).toBe("pending");
  expect(
    (
      await database.pool.query("select 1 from document_outbox where document_id=$1", [
        refused.documentId,
      ])
    ).rowCount,
  ).toBe(0);
  await decideProfile(person, "rejected");

  let dossier = await submitProfile(person, image(png));
  expect(dossier.current?.photo).toMatchObject({ state: "awaiting_upload", canUpload: true });
  await expect(
    repository.profilePhotoSource(colleague, person.userId, null, true),
  ).rejects.toMatchObject({ statusCode: 403 });
  const documentId = await uploadPhoto(person, png, false);
  dossier = await repository.profileDossier(person, person.userId);
  expect(dossier.current?.photo).toMatchObject({ state: "processing", canUpload: false });
  // Not published before the scanner has read it.
  await expect(decideProfile(person, "published")).rejects.toMatchObject({
    code: "PARTNER_ACTION_REQUIRED",
  });
  await database.pool.query(
    "update files set state='ready',scan_version='isolated',revision=revision+1 where id=$1",
    [documentId],
  );
  await decideProfile(person, "published");
  const profile = await repository.publicProfile(colleague, person.userId);
  expect(profile.photo).toEqual({ mime: "image/png" });

  // The audience of the profile reads the bytes; anybody else meets the same absence.
  const source = await repository.publishedPhotoSource(colleague, person.userId);
  const read = await service.downloadShared(source.userId, source.documentId, async () => {
    await repository.publishedPhotoSource(colleague, person.userId);
  });
  expect(Buffer.compare(read.bytes, png)).toBe(0);
  await expect(repository.publishedPhotoSource(stranger, person.userId)).rejects.toMatchObject({
    statusCode: 404,
  });
  // A professional photo never enters the person's Wallet library.
  await expect(files.get(person.userId, documentId)).rejects.toMatchObject({
    code: "DOCUMENT_NOT_FOUND",
  });

  // A new version keeps the photo unless it is removed; the publication changes only on review.
  dossier = await submitProfile(person, "keep");
  expect(dossier.current?.photo).toMatchObject({ state: "ready", canUpload: false });
  dossier = await submitProfile(person, "remove");
  expect(dossier.current?.photo).toBeNull();
  expect((await repository.publicProfile(colleague, person.userId)).photo).toEqual({
    mime: "image/png",
  });
  await decideProfile(person, "published");
  expect((await repository.publicProfile(colleague, person.userId)).photo).toBeNull();
  await expect(repository.publishedPhotoSource(colleague, person.userId)).rejects.toMatchObject({
    statusCode: 404,
  });
});

it("publishes the organisation profile written by its manager, reviewed outside the organisation", async () => {
  const manager = await professional("Mona Manager", ["advisor", "manager"]);
  const organizationId = (await repository.context(manager)).application!.organizationId;
  const email = `${key()}@cabinet-mona.test`;
  const member = await actor({ email });
  const invitation = (await repository.inviteTeamMember(manager, { email }, key())).invitations[0]!;
  await repository.apply(member, application("Max Membre"), key(), invitation.id);
  await approve(member);
  const viewer = await professional("Vera Voisine");
  const logo = image(png, "logo.png");

  // Only the manager writes it.
  await expect(
    repository.submitOrganizationProfile(
      member,
      organizationId,
      { revision: 0, presentation, logo: "remove", confirmed: true },
      key(),
    ),
  ).rejects.toMatchObject({ statusCode: 403 });
  let dossier = await repository.submitOrganizationProfile(
    manager,
    organizationId,
    { revision: 0, presentation, logo, confirmed: true },
    key(),
  );
  expect(dossier.current).toMatchObject({
    status: "submitted",
    logo: { state: "awaiting_upload", canUpload: true },
  });
  const authorize = () => repository.organizationLogoSource(manager, organizationId, null, true);
  const original = await authorize();
  await service.uploadShared(
    original.userId,
    original.documentId,
    png,
    async () => {
      await authorize();
    },
    (mime) => repository.completeOrganizationLogoUpload(manager, organizationId, mime),
  );
  await expect(
    repository.reviewOrganizationProfile(
      admin,
      organizationId,
      { revision: 1, decision: "published", reason },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  await database.pool.query(
    "update files set state='ready',scan_version='isolated',revision=revision+1 where id=$1",
    [original.documentId],
  );
  dossier = await repository.reviewOrganizationProfile(
    admin,
    organizationId,
    { revision: 1, decision: "published", reason },
    key(),
  );
  expect(dossier.published).toMatchObject({
    name: "Cabinet Mona Manager",
    presentation,
    logo: { mime: "image/png" },
  });

  // It travels with each member's published profile, logo included, for the same audience.
  await submitProfile(member, "remove");
  await decideProfile(member, "published");
  expect((await repository.publicProfile(viewer, member.userId)).organizationProfile).toMatchObject(
    { organizationId, logo: { mime: "image/png" } },
  );
  const source = await repository.publishedLogoSource(viewer, member.userId);
  expect(source.documentId).toBe(original.documentId);

  // Nobody reviews their own organisation; a withdrawal hides it at once.
  const insider = await actor({ administrator: true });
  await database.pool.query(
    "insert into partner_members(user_id,organization_id,application,state,roles) values($1,$2,$3,'approved','[\"advisor\"]')",
    [insider.userId, organizationId, JSON.stringify(application("Ilse Interne"))],
  );
  dossier = await repository.submitOrganizationProfile(
    manager,
    organizationId,
    { revision: 1, presentation, logo: "keep", confirmed: true },
    key(),
  );
  // The kept logo is the same, already scanned file.
  expect(dossier.current?.logo).toMatchObject({ state: "ready", canUpload: false });
  await expect(
    repository.reviewOrganizationProfile(
      insider,
      organizationId,
      { revision: 2, decision: "published", reason },
      key(),
    ),
  ).rejects.toMatchObject({ statusCode: 403 });
  await repository.withdrawOrganizationProfile(manager, organizationId, reason, key());
  expect((await repository.publicProfile(viewer, member.userId)).organizationProfile).toBeNull();
  await expect(repository.publishedLogoSource(viewer, member.userId)).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(
    database.pool.query(
      "update partner_organization_profile_versions set presentation='Réécrite' where organization_id=$1",
      [organizationId],
    ),
  ).rejects.toMatchObject({ code: "23514" });
});
