import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  competenceDeclarationSchema,
  competenceDecisionSchema,
  conventionDeclarationSchema,
  conventionDecisionSchema,
  partnerApplicationInputSchema,
  type CompetenceDossier,
} from "@coverview/contracts/partner";
import { createDatabase } from "./db/database.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import { readCompetenceSummary } from "../modules/partner-workspace/partner.competence.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
let administrator: PartnerActor;
const key = () => randomUUID();
const application = partnerApplicationInputSchema.parse({
  name: "Intervenant synthétique",
  organization: "Organisation synthétique",
  phone: "",
  roles: ["advisor"],
  categories: ["vehicle", "health"],
  languages: "fr",
  regions: "Genève",
  qualifications: "Preuve isolée sans qualification réelle",
});
const file = {
  name: "Preuve-isolée.pdf",
  mime: "application/pdf",
  size: 20,
  checksum: createHash("sha256").update("Isolated professional proof").digest("hex"),
};
type Kind = "competence" | "convention";
type ProofSnapshot = Pick<
  CompetenceDossier,
  "current" | "professionalRevision" | "name" | "organization"
>;
function operations(kind: Kind, person: PartnerActor) {
  const read = (actor = person) =>
    kind === "competence"
      ? repository.competence(actor, person.userId, "vehicle")
      : repository.convention(actor, person.userId, "vehicle", "axa");
  const declare = (snapshot: ProofSnapshot, attempt = key()) => {
    const input = {
      revision: snapshot.current?.revision ?? 0,
      professionalRevision: snapshot.professionalRevision,
      declaration: "Déclaration synthétique",
      file,
      confirmed: true,
    };
    return kind === "competence"
      ? repository.declareCompetence(
          person,
          person.userId,
          "vehicle",
          competenceDeclarationSchema.parse(input),
          attempt,
        )
      : repository.declareConvention(
          person,
          person.userId,
          "vehicle",
          "axa",
          conventionDeclarationSchema.parse({
            ...input,
            subjectName: snapshot.name,
            subjectOrganization: snapshot.organization,
          }),
          attempt,
        );
  };
  const decide = (snapshot: ProofSnapshot, attempt = key(), withdrawal = false) => {
    const input = {
      revision: snapshot.current!.revision,
      documentRevision: snapshot.current!.documentRevision,
      decision: withdrawal ? "withdrawn" : "reviewed",
      reason: "Examen synthétique isolé",
      scope: withdrawal ? "" : "Catégorie véhicule",
      coverage: withdrawal ? null : "category",
      validUntil: withdrawal ? null : new Date(Date.now() + 86400000).toISOString(),
      originalChecked: true,
    };
    return kind === "competence"
      ? repository.decideCompetence(
          administrator,
          person.userId,
          "vehicle",
          competenceDecisionSchema.parse(input),
          attempt,
        )
      : repository.decideConvention(
          administrator,
          person.userId,
          "vehicle",
          "axa",
          conventionDecisionSchema.parse({
            ...input,
            memberCovered: !withdrawal,
            validFrom: withdrawal ? null : new Date(0).toISOString(),
          }),
          attempt,
        );
  };
  const upload = (snapshot: ProofSnapshot) =>
    kind === "competence"
      ? repository.completeCompetenceUpload(
          person,
          person.userId,
          "vehicle",
          snapshot.current!.id,
          "application/pdf",
        )
      : repository.completeConventionUpload(
          person,
          person.userId,
          "vehicle",
          "axa",
          snapshot.current!.id,
          "application/pdf",
        );
  const retry = (snapshot: ProofSnapshot, attempt = key()) =>
    kind === "competence"
      ? repository.retryCompetenceUpload(
          person,
          person.userId,
          "vehicle",
          snapshot.current!.id,
          snapshot.current!.documentRevision,
          attempt,
        )
      : repository.retryConventionUpload(
          person,
          person.userId,
          "vehicle",
          "axa",
          snapshot.current!.id,
          snapshot.current!.documentRevision,
          attempt,
        );
  const source = (snapshot: ProofSnapshot, write = false, actor = person) =>
    kind === "competence"
      ? repository.competenceSource(actor, person.userId, "vehicle", snapshot.current!.id, write)
      : repository.conventionSource(
          actor,
          person.userId,
          "vehicle",
          "axa",
          snapshot.current!.id,
          write,
        );
  const prepare = async () => {
    const declared = await declare(await read());
    await upload(declared);
    await database.pool.query(
      "update files set state='ready',scan_version='isolated',revision=revision+1 where id=$1",
      [declared.current!.documentId],
    );
    return read();
  };
  return { read, declare, decide, upload, retry, source, prepare };
}
async function resubmit(
  person: PartnerActor,
  next = application,
  state: "needs_information" | "rejected" = "needs_information",
) {
  const member = (await repository.context(person)).application!;
  await repository.review(
    administrator,
    person.userId,
    {
      revision: member.revision,
      state,
      roles: [],
      reason: "Clarifier la candidature",
      reviewDueAt: null,
    },
    key(),
  );
  return repository.apply(person, next, key());
}

describe.each(["competence", "convention"] as const)("professional scope / %s", (kind) => {
  it("preserves the examined source and professional revision when structured languages and cantons change", async () => {
    const person = await actor();
    await repository.apply(person, application, key());
    const ops = operations(kind, person);
    const examined = await ops.decide(await ops.prepare());
    const member = (await repository.context(person)).application!;
    for (const languageCodes of [["fr", "de"], ["it"], []] as const) {
      const previous = await repository.practice(person, person.userId);
      await repository.declarePractice(
        person,
        person.userId,
        {
          revision: previous.current?.revision ?? 0,
          professionalRevision: previous.professionalRevision,
          languageCodes: [...languageCodes],
          cantons: languageCodes.length ? ["GE", "VD"] : [],
          confirmed: true,
        },
        key(),
      );
      expect(await ops.read(administrator)).toEqual(examined);
      expect((await repository.context(person)).application).toEqual(member);
      expect((await ops.source(examined)).documentId).toBe(examined.current!.documentId);
    }
  });
  it("preserves evidence across round trips, rejects stale declarations and requires a fresh examination", async () => {
    const person = await actor();
    await repository.apply(person, application, key());
    const ops = operations(kind, person),
      first = await ops.prepare();
    const reviewed = await ops.decide(first);
    const originalMember = (await repository.context(person)).application!;
    const immutable = (
      await database.pool.query(
        `select * from partner_${kind}_decisions where user_id=$1 order by revision`,
        [person.userId],
      )
    ).rows;
    // Neither Admin decisions nor order-only / contact changes invalidate a professional scope.
    await resubmit(person, { ...application, phone: "0123", categories: ["health", "vehicle"] });
    expect((await ops.read()).summary.status).toBe("reviewed");
    expect((await ops.read()).professionalRevision).toBe(originalMember.professionalRevision);
    let revision = originalMember.professionalRevision!;
    for (const next of [
      { ...application, name: "Autre intervenant" },
      application,
      { ...application, organization: "Autre organisation" },
      application,
      { ...application, categories: ["health"] as ("health" | "vehicle")[] },
      application,
    ]) {
      await resubmit(person, next, revision % 2 ? "rejected" : "needs_information");
      const current = await ops.read(administrator);
      expect(current.professionalRevision).toBe(++revision);
      expect(current.summary.status).toBe("unavailable");
      expect(current.current).toMatchObject({
        id: reviewed.current!.id,
        professionalScope: "changed",
        declaredName: application.name,
        declaredOrganization: application.organization,
      });
      expect(current.canReview).toBe(false);
      expect(current.canResume).toBe(false);
      await expect(ops.decide(current)).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
      expect((await ops.source(current)).documentId).toBe(first.current!.documentId);
      if (kind === "competence")
        expect((await readCompetenceSummary(database.pool, person.userId, "vehicle")).status).toBe(
          "unavailable",
        );
    }
    const current = await ops.read();
    await expect(
      ops.declare({ ...current, professionalRevision: originalMember.professionalRevision }),
    ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
    await expect(ops.declare({ ...current, professionalRevision: null })).rejects.toMatchObject({
      code: "PARTNER_CONFLICT",
    });
    const attempt = key();
    const [replacement, replay] = await Promise.all([
      ops.declare(current, attempt),
      ops.declare(current, attempt),
    ]);
    expect(replay).toEqual(replacement);
    expect(replacement.summary.status).toBe("submitted");
    expect(replacement.current!.documentId).toBe(first.current!.documentId);
    const final = await ops.decide(replacement);
    expect(final.summary.status).toBe("reviewed");
    expect(final.current!.professionalScope).toBe("current");
    expect(final.history.find((item) => item.id === reviewed.current!.id)?.professionalScope).toBe(
      "changed",
    );
    expect(
      (
        await database.pool.query(
          `select * from partner_${kind}_decisions where user_id=$1 and revision<=2 order by revision`,
          [person.userId],
        )
      ).rows,
    ).toEqual(immutable);
    expect((await repository.context(person)).application!.organizationId).toBe(
      originalMember.organizationId,
    );
    expect((await repository.context(person)).operational).toBe(false);
    expect(
      (
        await database.pool.query<{ count: number }>(
          "select count(*)::int count from files where user_id=$1",
          [person.userId],
        )
      ).rows[0]?.count,
    ).toBe(1);
    expect(
      (
        await database.pool.query<{ count: number }>(
          "select count(*)::int count from partner_leads where creator_id=$1",
          [person.userId],
        )
      ).rows[0]?.count,
    ).toBe(0);
  });

  it("serializes a concurrent application change and examination, and does not revive upload/retry rights on replay", async () => {
    const person = await actor();
    await repository.apply(person, application, key());
    const ops = operations(kind, person),
      original = await ops.prepare();
    const member = (await repository.context(person)).application!;
    await repository.review(
      administrator,
      person.userId,
      {
        revision: member.revision,
        state: "needs_information",
        roles: [],
        reason: "Clarifier les parties",
        reviewDueAt: null,
      },
      key(),
    );
    const outcomes = await Promise.allSettled([
      ops.decide(original),
      repository.apply(person, { ...application, name: "Autre partie" }, key()),
    ]);
    expect(outcomes[1].status).toBe("fulfilled");
    if (outcomes[0].status === "rejected")
      expect(outcomes[0].reason).toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
    expect((await ops.read()).summary.status).toBe("unavailable");
    const snapshot = await ops.read(),
      attempt = key();
    const replacement = await ops.declare(snapshot, attempt);
    const fileId = replacement.current!.documentId;
    await database.pool.query("update files set state='failed',revision=revision+1 where id=$1", [
      fileId,
    ]);
    const failed = await ops.read(),
      retryKey = key();
    await ops.retry(failed, retryKey);
    await resubmit(person, application);
    await resubmit(person, { ...application, name: "Autre partie" });
    const replay = await ops.declare(snapshot, attempt);
    expect(replay.current!.id).toBe(replacement.current!.id);
    expect(replay.summary.status).toBe("unavailable");
    expect(replay.canResume).toBe(false);
    for (const operation of [
      () => ops.upload(replacement),
      () => ops.source(replacement, true),
      () => ops.retry(failed, retryKey),
    ])
      await expect(operation()).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
    const stranger = await actor();
    await expect(ops.source(replacement, false, stranger)).rejects.toMatchObject({
      code: "PARTNER_ACCESS_DENIED",
    });
    const withdrawn = await ops.decide(await ops.read(), key(), true);
    expect(withdrawn.summary.status).toBe("withdrawn");
  });

  it("keeps legacy scope unknown and catches organization-id round trips without fabricating historical parties", async () => {
    const person = await actor();
    await repository.apply(person, application, key());
    const ops = operations(kind, person),
      first = await ops.prepare();
    const reviewed = await ops.decide(first);
    const other = await actor();
    await repository.apply(other, application, key());
    const initial = (await repository.context(person)).application!;
    const otherOrg = (await repository.context(other)).application!.organizationId;
    for (const org of [otherOrg, initial.organizationId]) {
      await database.pool.query("update partner_members set organization_id=$2 where user_id=$1", [
        person.userId,
        org,
      ]);
      expect((await ops.read()).summary.status).toBe("unavailable");
    }
    expect((await repository.context(other)).application!.professionalRevision).toBe(1);
    // Model a row written by the pre-0042 API: no revision or fabricated name backfill.
    await database.pool.query(
      `update partner_${kind}_declarations set professional_revision=null,declared_name='',declared_organization='' where user_id=$1`,
      [person.userId],
    );
    const legacy = await ops.read(administrator);
    expect(legacy.current).toMatchObject({
      id: reviewed.current!.id,
      professionalScope: "unknown",
      declaredName: "",
      declaredOrganization: "",
    });
    expect(legacy.summary.status).toBe("unavailable");
    expect(legacy.canReview).toBe(false);
    expect(legacy.current!.canDownload).toBe(true);
    await expect(ops.decide(legacy)).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
    expect((await ops.source(legacy)).documentId).toBe(first.current!.documentId);
  });
});

async function actor(admin = false): Promise<PartnerActor> {
  const person = { userId: `user_${key()}`, id: `session_${key()}`, administrator: admin };
  await database.pool.query(
    "insert into identity_users(id,workos_user_id,email) values($1,$2,$3)",
    [person.userId, key(), `${key()}@scope.test`],
  );
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated scope test',now()+interval '1 hour',now()-interval '1 second')",
    [person.id, person.userId, key(), createHash("sha256").update(key()).digest("hex")],
  );
  if (admin)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated Testcontainers permission')",
      [key(), person.userId],
    );
  return person;
}
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_scope_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  const migrationsFolder = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  await migrate(database.db, { migrationsFolder });
  await migrate(database.db, { migrationsFolder });
  repository = createPartnerRepository(database.pool);
  administrator = await actor(true);
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});
