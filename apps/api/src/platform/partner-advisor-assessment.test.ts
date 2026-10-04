import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, expect, it } from "vitest";
import {
  advicePreferencesInputSchema,
  leadCreateInputSchema,
  partnerApplicationInputSchema,
  competenceDeclarationSchema,
  competenceDecisionSchema,
  sharedModesInputSchema,
  sharedReferentAssessmentSchema,
  referentAssessmentSchema,
  advisorAssessmentSchema,
  needExpertiseEvidenceSchema,
  capacityAdvisorAssessmentSchema,
  capacityInputSchema,
  type CapacityInput,
  type SharedModesInput,
  type LeadDetail,
} from "@coverview/contracts/partner";
import { createDatabase } from "./db/database.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";
import { createManagedProfileRepository } from "../modules/profiles/profiles.repository.js";
import { createAdminProfileTransferRepository } from "./admin-profile-transfer.repository.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
let admin: PartnerActor;
const key = () => randomUUID();
async function actor(administrator = false): Promise<PartnerActor> {
  const value = { userId: `user_${key()}`, id: `session_${key()}`, administrator };
  await database.pool.query(
    "insert into identity_users(id,workos_user_id,email) values($1,$2,$3)",
    [value.userId, key(), `${key()}@assessment.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    value.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated assessment',now()+interval '1 hour',now()-interval '1 second')",
    [value.id, value.userId, key(), createHash("sha256").update(key()).digest("hex")],
  );
  if (administrator)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated test')",
      [key(), value.userId],
    );
  return value;
}
async function professional() {
  const person = await actor();
  await repository.apply(
    person,
    partnerApplicationInputSchema.parse({
      name: "Conseiller isolé",
      organization: "Organisation isolée",
      phone: "",
      roles: ["advisor"],
      categories: ["vehicle"],
      languages: "fr",
      regions: "GE",
      qualifications: "Test",
    }),
    key(),
  );
  const member = (await repository.context(person)).application!;
  await repository.review(
    admin,
    person.userId,
    {
      revision: member.revision,
      state: "approved",
      roles: ["advisor"],
      reason: "Test isolé",
      reviewDueAt: null,
      organizationState: "approved",
    },
    key(),
  );
  return person;
}
async function assigned(
  owner: PartnerActor,
  advisor: PartnerActor,
  profileId: string | null = null,
) {
  let lead = await repository.create(
    owner,
    leadCreateInputSchema.parse({
      title: "Conseil isolé véhicule",
      category: "vehicle",
      object: "Voiture",
      context: "Besoin isolé",
      clientUserId: owner.userId,
      clientProfileId: profileId,
      clientName: "Personne isolée",
      email: "client@assessment.test",
      phone: "",
      language: "fr",
      source: "Test",
      transmissionAuthorized: true,
      priority: "normal",
      draft: false,
      nextAction: "Qualifier",
      dueAt: new Date(Date.now() + 86400000).toISOString(),
    }),
    key(),
  );
  lead = await repository.command(
    admin,
    lead.id,
    {
      action: "assign",
      revision: lead.revision,
      responsibleId: advisor.userId,
      reason: "Test isolé",
    },
    key(),
  );
  return repository.command(advisor, lead.id, { action: "accept", revision: lead.revision }, key());
}
async function preferences(owner: PartnerActor, lead: LeadDetail, mode: "home" | "phone" = "home") {
  const current = await repository.advicePreferences(owner, lead.id);
  return repository.confirmAdvicePreferences(
    owner,
    lead.id,
    advicePreferencesInputSchema.parse({
      revision: current.revision,
      scopeRevision: current.scopeRevision,
      profileRevision: current.profileRevision,
      languageCode: "fr",
      mode,
      canton: mode === "home" ? "GE" : null,
      confirmed: true,
    }),
    key(),
  );
}
async function declarations(advisor: PartnerActor, empty = false) {
  const practice = await repository.practice(advisor, advisor.userId);
  await repository.declarePractice(
    advisor,
    advisor.userId,
    {
      revision: practice.current?.revision ?? 0,
      professionalRevision: practice.professionalRevision,
      languageCodes: empty ? [] : ["fr"],
      cantons: empty ? [] : ["GE"],
      confirmed: true,
    },
    key(),
  );
  const availability = await repository.availability(advisor, advisor.userId);
  await repository.declareAvailability(
    advisor,
    advisor.userId,
    {
      revision: availability.current?.revision ?? 0,
      professionalRevision: availability.professionalRevision,
      modes: empty ? [] : ["home", "phone"],
      timezone: "Europe/Zurich",
      periods: [],
      confirmed: true,
    },
    key(),
  );
}
async function unchanged(id: string) {
  const tables = [
    "partner_leads",
    "partner_events",
    "partner_notifications",
    "partner_appointments",
    "partner_tasks",
  ];
  return Promise.all(
    tables.map(
      async (table) =>
        (
          await database.pool.query<Record<string, unknown>>(
            `select * from ${table} where ${table === "partner_leads" ? "id" : "lead_id"}=$1 order by id`,
            [id],
          )
        ).rows,
    ),
  );
}
async function proof(advisor: PartnerActor) {
  const current = await repository.competence(advisor, advisor.userId, "vehicle");
  const dossier = await repository.declareCompetence(
    advisor,
    advisor.userId,
    "vehicle",
    competenceDeclarationSchema.parse({
      revision: 0,
      professionalRevision: current.professionalRevision,
      declaration: "Déclaration privée isolée",
      file: {
        name: "Preuve-privée.pdf",
        mime: "application/pdf",
        size: 20,
        checksum: createHash("sha256").update(key()).digest("hex"),
      },
      confirmed: true,
    }),
    key(),
  );
  await repository.completeCompetenceUpload(
    advisor,
    advisor.userId,
    "vehicle",
    dossier.current!.id,
    "application/pdf",
  );
  await database.pool.query(
    "update files set state='ready',scan_version='isolated',revision=revision+1 where id=$1",
    [dossier.current!.documentId],
  );
  const ready = await repository.competence(advisor, advisor.userId, "vehicle");
  await repository.decideCompetence(
    admin,
    advisor.userId,
    "vehicle",
    competenceDecisionSchema.parse({
      revision: ready.current!.revision,
      decision: "reviewed",
      reason: "Motif privé isolé",
      scope: "Catégorie véhicule",
      coverage: "category",
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      documentRevision: ready.current!.documentRevision,
      originalChecked: true,
    }),
    key(),
  );
  return ready.current!.documentId;
}

it.each([false, true])(
  "compares current structured sources without inferring preferences, writing or exposing private originals and periods (capacity=%s)",
  async (includeCapacity) => {
    const owner = { ...(await actor()), wallet: true },
      advisor = await professional(),
      lead = await assigned(owner, advisor);
    const missing = await repository.advisorAssessment(advisor, lead.id, includeCapacity);
    expect(missing.criteria.language).toEqual({ status: "unknown", reason: "preferences_unset" });
    expect(missing.practice).toMatchObject({ status: "unset", languageCodes: [], cantons: [] });
    await preferences(owner, lead);
    expect(
      (await repository.advisorAssessment(advisor, lead.id, includeCapacity)).criteria.language
        .reason,
    ).toBe("declaration_missing");
    await declarations(advisor);
    const before = await unchanged(lead.id);
    const value = await repository.advisorAssessment(advisor, lead.id, includeCapacity);
    for (const criterion of Object.values(value.criteria))
      expect(criterion).toEqual({ status: "matches", reason: "declared_match" });
    expect(value.competence.status).toBe("missing");
    expect(value.remainingChecks).toEqual([
      "conventions",
      "availability",
      "capacity",
      "conflicts",
      "need_expertise",
      "quality",
    ]);
    expect(value.preferences.current?.confirmedAt).toBeTruthy();
    expect(value.practice.declaredAt).toBeTruthy();
    expect(Object.keys(value.modes).sort()).toEqual(["declaredAt", "revision", "status", "values"]);
    for (const forbidden of [
      "periods",
      "documentId",
      "declaration",
      "history",
      "score",
      "eligible",
    ])
      expect(value).not.toHaveProperty(forbidden);
    expect(await unchanged(lead.id)).toEqual(before);
    expect(await repository.detail(owner, lead.id)).not.toHaveProperty("advisorAssessment");
  },
);

it.each([false, true])(
  "keeps missing values unknown, identifies declared differences and scopes territory only to physical preferences (capacity=%s)",
  async (includeCapacity) => {
    const owner = { ...(await actor()), wallet: true },
      advisor = await professional(),
      lead = await assigned(owner, advisor);
    await preferences(owner, lead);
    await declarations(advisor, true);
    let value = await repository.advisorAssessment(advisor, lead.id, includeCapacity);
    for (const criterion of Object.values(value.criteria))
      expect(criterion.reason).toBe("declaration_unspecified");
    const p = await repository.practice(advisor, advisor.userId);
    await repository.declarePractice(
      advisor,
      advisor.userId,
      {
        revision: p.current!.revision,
        professionalRevision: p.professionalRevision,
        languageCodes: ["de"],
        cantons: ["VD"],
        confirmed: true,
      },
      key(),
    );
    const a = await repository.availability(advisor, advisor.userId);
    await repository.declareAvailability(
      advisor,
      advisor.userId,
      {
        revision: a.current!.revision,
        professionalRevision: a.professionalRevision,
        modes: ["office"],
        timezone: "Europe/Zurich",
        periods: [],
        confirmed: true,
      },
      key(),
    );
    value = await repository.advisorAssessment(advisor, lead.id, includeCapacity);
    for (const criterion of Object.values(value.criteria)) expect(criterion.status).toBe("differs");
    await preferences(owner, lead, "phone");
    value = await repository.advisorAssessment(advisor, lead.id, includeCapacity);
    expect(value.criteria.canton).toEqual({ status: "not_applicable", reason: "remote_mode" });
    expect(value.criteria.mode.status).toBe("differs");
    await database.pool.query(
      "update partner_members set application=jsonb_set(application,'{name}','\"Changed\"') where user_id=$1",
      [advisor.userId],
    );
    await database.pool.query(
      "update partner_members set application=jsonb_set(application,'{name}','\"Conseiller isolé\"') where user_id=$1",
      [advisor.userId],
    );
    value = await repository.advisorAssessment(advisor, lead.id, includeCapacity);
    expect(value.criteria.language.reason).toBe("declaration_scope_changed");
    expect(value.criteria.mode.reason).toBe("declaration_scope_changed");
    expect(value.practice.languageCodes).toEqual([]);
    expect(value.modes.values).toEqual([]);
  },
);

it.each([false, true])(
  "requires a current personal mandate, session, activity and category even when a manager or administrator can see the Lead (capacity=%s)",
  async (includeCapacity) => {
    const owner = { ...(await actor()), wallet: true },
      advisor = await professional(),
      neighbor = await professional(),
      lead = await assigned(owner, advisor);
    for (const reader of [owner, admin, neighbor])
      await expect(
        repository.advisorAssessment(reader, lead.id, includeCapacity),
      ).rejects.toMatchObject({
        code: reader === neighbor ? "PARTNER_NOT_FOUND" : "PARTNER_ACCESS_DENIED",
      });
    await database.pool.query(
      'update partner_members set organization_id=(select organization_id from partner_members where user_id=$2),roles=\'["advisor","manager"]\' where user_id=$1',
      [neighbor.userId, advisor.userId],
    );
    expect((await repository.detail(neighbor, lead.id)).access).toBe("operational");
    expect((await repository.detail(neighbor, lead.id)).allowedActions).not.toContain(
      "advisor_assessment",
    );
    await expect(
      repository.advisorAssessment(neighbor, lead.id, includeCapacity),
    ).rejects.toMatchObject({
      code: "PARTNER_ACCESS_DENIED",
    });
    await database.pool.query(
      "insert into partner_contributors(id,lead_id,user_id,access_scope,can_edit,can_contact) values($1,$2,$3,'advice',false,false)",
      [key(), lead.id, neighbor.userId],
    );
    expect((await repository.advisorAssessment(neighbor, lead.id, includeCapacity)).advisorId).toBe(
      neighbor.userId,
    );
    await database.pool.query(
      "update partner_contributors set revoked_at=now() where lead_id=$1 and user_id=$2",
      [lead.id, neighbor.userId],
    );
    await expect(
      repository.advisorAssessment(neighbor, lead.id, includeCapacity),
    ).rejects.toMatchObject({
      code: "PARTNER_ACCESS_DENIED",
    });
    await database.pool.query(
      "update partner_members set application=jsonb_set(application,'{categories}','[\"health\"]') where user_id=$1",
      [advisor.userId],
    );
    await expect(
      repository.advisorAssessment(advisor, lead.id, includeCapacity),
    ).rejects.toMatchObject({
      code: "PARTNER_ACCESS_DENIED",
    });
    await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
      advisor.id,
    ]);
    await expect(
      repository.advisorAssessment(advisor, lead.id, includeCapacity),
    ).rejects.toMatchObject({
      code: "PARTNER_ACCESS_DENIED",
    });
  },
);

it.each([false, true])(
  "invalidates a changed need and transferred profile without projecting former choices, including after a round trip (capacity=%s)",
  async (includeCapacity) => {
    const owner = { ...(await actor()), wallet: true },
      destination = { ...(await actor()), wallet: true },
      advisor = await professional();
    const profile = await createManagedProfileRepository(database.db).create(
      owner,
      { kind: "person", displayName: "Sujet isolé" },
      key(),
    );
    const lead = await assigned(owner, advisor, profile.id);
    await preferences(owner, lead);
    await declarations(advisor);
    const transfers = createAdminProfileTransferRepository(database.db);
    await transfers.transfer(
      { id: admin.id, userId: owner.userId, administratorUserId: admin.userId },
      profile.id,
      { destinationUserId: destination.userId, revision: profile.revision },
      key(),
    );
    let value = await repository.advisorAssessment(advisor, lead.id, includeCapacity);
    expect(value.preferences).toMatchObject({ status: "confirmation_required", current: null });
    expect(value.criteria.language.reason).toBe("preferences_confirmation_required");
    await transfers.transfer(
      { id: admin.id, userId: destination.userId, administratorUserId: admin.userId },
      profile.id,
      { destinationUserId: owner.userId, revision: 1 },
      key(),
    );
    expect(
      (await repository.advisorAssessment(advisor, lead.id, includeCapacity)).preferences.current,
    ).toBeNull();
    await preferences(owner, lead);
    await database.pool.query("update partner_leads set title='Autre besoin' where id=$1", [
      lead.id,
    ]);
    await database.pool.query("update partner_leads set title=$2 where id=$1", [
      lead.id,
      lead.title,
    ]);
    expect(
      (await repository.advisorAssessment(advisor, lead.id, includeCapacity)).preferences.status,
    ).toBe("confirmation_required");
    await database.pool.query(
      "update partner_leads set client_profile_id=null,client_user_id=$2 where id=$1",
      [lead.id, destination.userId],
    );
    value = await repository.advisorAssessment(advisor, lead.id, includeCapacity);
    expect(value.preferences).toMatchObject({ status: "unset", current: null });
    expect(JSON.stringify(value)).not.toContain(profile.id);
  },
);

it.each([false, true])(
  "uses the reviewed competence source without certifying expertise, and respects withdrawal and source invalidation (capacity=%s)",
  async (includeCapacity) => {
    const owner = { ...(await actor()), wallet: true },
      advisor = await professional(),
      lead = await assigned(owner, advisor);
    const documentId = await proof(advisor);
    let value = await repository.advisorAssessment(advisor, lead.id, includeCapacity);
    expect(value.competence.status).toBe("reviewed");
    expect(value.remainingChecks).toContain("need_expertise");
    for (const privateValue of [
      documentId,
      "Motif privé isolé",
      "Preuve-privée.pdf",
      "Déclaration privée isolée",
    ])
      expect(JSON.stringify(value)).not.toContain(privateValue);
    await database.pool.query("update files set revision=revision+1 where id=$1", [documentId]);
    expect(
      (await repository.advisorAssessment(advisor, lead.id, includeCapacity)).competence.status,
    ).toBe("unavailable");
    const dossier = await repository.competence(advisor, advisor.userId, "vehicle");
    await repository.decideCompetence(
      advisor,
      advisor.userId,
      "vehicle",
      competenceDecisionSchema.parse({
        revision: dossier.current!.revision,
        decision: "withdrawn",
        reason: "Retrait isolé",
        scope: "",
        coverage: null,
        validUntil: null,
        documentRevision: dossier.current!.documentRevision,
        originalChecked: false,
      }),
      key(),
    );
    value = await repository.advisorAssessment(advisor, lead.id, includeCapacity);
    expect(value.competence.status).toBe("withdrawn");
  },
);

it.each([false, true])(
  "keeps a coherent committed snapshot while a scanner changes the source during a real profile lock wait (capacity=%s)",
  async (includeCapacity) => {
    const owner = { ...(await actor()), wallet: true },
      advisor = await professional();
    const profile = await createManagedProfileRepository(database.db).create(
      owner,
      { kind: "person", displayName: "Sujet concurrence" },
      key(),
    );
    const lead = await assigned(owner, advisor, profile.id);
    await preferences(owner, lead);
    await declarations(advisor);
    const documentId = await proof(advisor),
      blocker = await database.pool.connect();
    let pending: ReturnType<typeof repository.advisorAssessment> | undefined;
    try {
      await blocker.query("begin");
      await blocker.query("select id from managed_profiles where id=$1 for update", [profile.id]);
      pending = repository.advisorAssessment(advisor, lead.id, includeCapacity);
      await expect
        .poll(
          async () =>
            (
              await database.pool.query(
                "select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%managed_profiles%' and pid<>pg_backend_pid() limit 1",
              )
            ).rowCount,
          { timeout: 5000 },
        )
        .toBe(1);
      await blocker.query("update files set revision=revision+1 where id=$1", [documentId]);
      await blocker.query("commit");
      expect((await pending).competence.status).toBe("reviewed");
      expect(
        (await repository.advisorAssessment(advisor, lead.id, includeCapacity)).competence.status,
      ).toBe("unavailable");
    } finally {
      await blocker.query("rollback");
      blocker.release();
      if (pending) await pending;
    }
  },
);

it.each([false, true])(
  "keeps the personal Admin exception separate from MFA, permissions and actual professional evidence (capacity=%s)",
  async (includeCapacity) => {
    const owner = { ...(await actor()), wallet: true },
      lead = await assigned(owner, admin);
    const value = await repository.advisorAssessment(admin, lead.id, includeCapacity);
    expect(value.advisorId).toBe(admin.userId);
    expect(value.competence.status).toBe("missing");
    expect(value.practice.status).toBe("unset");
    expect(value.modes.status).toBe("missing");
    const staleSession = await actor(true);
    await database.pool.query(
      "update identity_sessions set mfa_verified_at=now()-interval '25 hours' where id=$1",
      [staleSession.id],
    );
    await expect(
      repository.advisorAssessment(staleSession, lead.id, includeCapacity),
    ).rejects.toMatchObject({
      code: "PARTNER_ACCESS_DENIED",
    });
    const revokedAdmin = await actor(true);
    await database.pool.query(
      "update identity_admin_permissions set revoked_at=now() where user_id=$1",
      [revokedAdmin.userId],
    );
    await expect(
      repository.advisorAssessment(revokedAdmin, lead.id, includeCapacity),
    ).rejects.toMatchObject({
      code: "PARTNER_ACCESS_DENIED",
    });
  },
);

it.each([false, true])(
  "refuses a mixed profile generation after a concurrent change and permits a fresh authorized read (capacity=%s)",
  async (includeCapacity) => {
    const owner = { ...(await actor()), wallet: true },
      advisor = await professional();
    const profile = await createManagedProfileRepository(database.db).create(
      owner,
      { kind: "person", displayName: "Sujet concurrent" },
      key(),
    );
    const lead = await assigned(owner, advisor, profile.id);
    await preferences(owner, lead);
    const blocker = await database.pool.connect();
    let pending: Promise<unknown> | undefined;
    try {
      await blocker.query("begin");
      await blocker.query("select id from managed_profiles where id=$1 for update", [profile.id]);
      pending = repository
        .advisorAssessment(advisor, lead.id, includeCapacity)
        .catch((cause: unknown) => cause);
      await expect
        .poll(
          async () =>
            (
              await database.pool.query(
                "select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%managed_profiles%' and pid<>pg_backend_pid() limit 1",
              )
            ).rowCount,
          { timeout: 5000 },
        )
        .toBe(1);
      await blocker.query(
        "update managed_profiles set revision=revision+1,display_name='Sujet renommé' where id=$1",
        [profile.id],
      );
      await blocker.query("commit");
      expect(await pending).toMatchObject({ code: "PARTNER_CONFLICT", statusCode: 409 });
      expect(
        (await repository.advisorAssessment(advisor, lead.id, includeCapacity)).preferences,
      ).toMatchObject({
        status: "confirmation_required",
        current: null,
      });
    } finally {
      await blocker.query("rollback");
      blocker.release();
      if (pending) await pending;
    }
  },
);

it.each([false, true])(
  "keeps client continuity choices explicit and a change request visible without assignment or appointment effects (capacity=%s)",
  async (includeCapacity) => {
    const owner = { ...(await actor()), wallet: true },
      advisor = await professional(),
      other = await professional();
    const lead = await assigned(owner, advisor);
    await assigned(owner, other);
    await repository.updateReferent(
      owner,
      "self",
      "vehicle",
      { revision: 0, profileRevision: 0, advisorId: other.userId, confirmed: true },
      key(),
    );
    expect(
      (await repository.advisorAssessment(advisor, lead.id, includeCapacity)).continuity.status,
    ).toBe("chosen_other");
    await repository.updateReferent(
      owner,
      "self",
      "vehicle",
      { revision: 1, profileRevision: 0, advisorId: advisor.userId, confirmed: true },
      key(),
    );
    await repository.command(
      owner,
      lead.id,
      {
        action: "client_interlocutor",
        revision: (await repository.detail(owner, lead.id)).revision,
        reason: "Changement souhaité",
      },
      key(),
    );
    const before = await unchanged(lead.id),
      value = await repository.advisorAssessment(advisor, lead.id, includeCapacity);
    expect(value.continuity).toMatchObject({ status: "chosen_self", changeRequested: true });
    expect(await unchanged(lead.id)).toEqual(before);
    await repository.command(
      admin,
      lead.id,
      {
        action: "close",
        revision: (await repository.detail(admin, lead.id)).revision,
        result: "resolved_without_contract",
        reason: "current_suitable",
        comment: "Contrat maintenu",
      },
      key(),
    );
    await expect(
      repository.advisorAssessment(advisor, lead.id, includeCapacity),
    ).rejects.toMatchObject({
      code: "PARTNER_ACCESS_DENIED",
    });
  },
);

async function chooseReferent(owner: PartnerActor, advisorId: string | null, profileId = "self") {
  const current = await repository.referentProfile(owner, profileId, "vehicle");
  await repository.updateReferent(
    owner,
    profileId,
    "vehicle",
    {
      revision: current.current.revision,
      profileRevision: current.profileRevision,
      advisorId,
      confirmed: true,
    },
    key(),
  );
}

it("shares only current referent criteria with authorized Lead readers, independent of private modes and periods", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional(),
    referent = await professional();
  const lead = await assigned(owner, advisor);
  await assigned(owner, referent);
  await chooseReferent(owner, referent.userId);
  await preferences(owner, lead);
  await declarations(referent);
  const documentId = await proof(referent);
  const before = await unchanged(lead.id);
  const wallet = await repository.referentAssessment(owner, lead.id);
  expect(wallet).toMatchObject({
    status: "human_review",
    selection: { advisor: { id: referent.userId } },
    assessment: {
      criteria: {
        language: { status: "matches", reason: "declared_match" },
        canton: { status: "matches", reason: "declared_match" },
        mode: { status: "unknown", reason: "shared_source_unavailable" },
      },
      competence: { status: "reviewed" },
    },
  });
  for (const reader of [advisor, admin]) {
    const value = await repository.referentAssessment(reader, lead.id);
    expect({ ...value, assessedAt: wallet.assessedAt }).toEqual(wallet);
  }
  const availability = await repository.availability(referent, referent.userId);
  await repository.declareAvailability(
    referent,
    referent.userId,
    {
      revision: availability.current!.revision,
      professionalRevision: availability.professionalRevision,
      modes: ["video"],
      timezone: "Europe/Zurich",
      confirmed: true,
      periods: [
        {
          kind: "absent",
          startsAt: "2027-01-02T08:00:00.000Z",
          endsAt: "2027-01-02T10:00:00.000Z",
        },
      ],
    },
    key(),
  );
  const after = await repository.referentAssessment(owner, lead.id);
  expect({ ...after, assessedAt: wallet.assessedAt }).toEqual(wallet);
  for (const secret of [
    documentId,
    "Preuve-privée",
    "Déclaration privée",
    "Motif privé",
    "periods",
    "professionalRevision",
    "2027-01-02",
    "modes",
    "history",
  ])
    expect(JSON.stringify(after)).not.toContain(secret);
  expect(await unchanged(lead.id)).toEqual(before);
  expect(await repository.detail(owner, lead.id)).not.toHaveProperty("referentAssessment");
  expect(after).not.toHaveProperty("advisorId");
  await expect(repository.referentAssessment(referent, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await database.pool.query("update files set revision=revision+1 where id=$1", [documentId]);
  expect((await repository.referentAssessment(owner, lead.id)).assessment?.competence.status).toBe(
    "unavailable",
  );
});

it("keeps unknowns, structured differences, remote cantons and invalidated need confirmations distinct for the referent", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional(),
    lead = await assigned(owner, advisor);
  await chooseReferent(owner, advisor.userId);
  expect(
    (await repository.referentAssessment(owner, lead.id)).assessment?.criteria.language.reason,
  ).toBe("preferences_unset");
  await preferences(owner, lead);
  expect(
    (await repository.referentAssessment(owner, lead.id)).assessment?.criteria.language.reason,
  ).toBe("declaration_missing");
  await declarations(advisor, true);
  expect(
    (await repository.referentAssessment(owner, lead.id)).assessment?.criteria.canton.reason,
  ).toBe("declaration_unspecified");
  const practice = await repository.practice(advisor, advisor.userId);
  await repository.declarePractice(
    advisor,
    advisor.userId,
    {
      revision: practice.current!.revision,
      professionalRevision: practice.professionalRevision,
      languageCodes: ["de"],
      cantons: ["VD"],
      confirmed: true,
    },
    key(),
  );
  expect((await repository.referentAssessment(owner, lead.id)).assessment?.criteria).toMatchObject({
    language: { status: "differs", reason: "declared_difference" },
    canton: { status: "differs" },
  });
  await preferences(owner, lead, "phone");
  expect((await repository.referentAssessment(owner, lead.id)).assessment?.criteria.canton).toEqual(
    { status: "not_applicable", reason: "remote_mode" },
  );
  await database.pool.query("update partner_leads set title='Autre besoin' where id=$1", [lead.id]);
  await database.pool.query("update partner_leads set title=$2 where id=$1", [lead.id, lead.title]);
  const invalid = await repository.referentAssessment(owner, lead.id);
  expect(invalid.assessment?.preferences).toEqual({
    status: "confirmation_required",
    confirmedAt: null,
    languageCode: null,
    mode: null,
    canton: null,
  });
  expect(invalid.assessment?.criteria.canton.reason).toBe("preferences_confirmation_required");
  await preferences(owner, lead);
  await database.pool.query(
    "update partner_members set application=jsonb_set(application,'{name}','\"Nom modifié\"') where user_id=$1",
    [advisor.userId],
  );
  await database.pool.query(
    "update partner_members set application=jsonb_set(application,'{name}','\"Conseiller isolé\"') where user_id=$1",
    [advisor.userId],
  );
  expect(
    (await repository.referentAssessment(owner, lead.id)).assessment?.criteria.language.reason,
  ).toBe("declaration_scope_changed");
});

it("requires current operational or Wallet ownership authority and preserves the minimal manager audience", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional(),
    neighbor = await professional(),
    outsider = { ...(await actor()), wallet: true };
  const lead = await assigned(owner, advisor);
  await chooseReferent(owner, advisor.userId);
  for (const reader of [neighbor, outsider])
    await expect(repository.referentAssessment(reader, lead.id)).rejects.toMatchObject({
      code: "PARTNER_NOT_FOUND",
    });
  await database.pool.query(
    "insert into partner_contributors(id,lead_id,user_id,access_scope,can_edit,can_contact) values($1,$2,$3,'progress',false,false)",
    [key(), lead.id, neighbor.userId],
  );
  await expect(repository.referentAssessment(neighbor, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await database.pool.query(
    "update partner_contributors set access_scope='advice' where lead_id=$1 and user_id=$2",
    [lead.id, neighbor.userId],
  );
  expect((await repository.referentAssessment(neighbor, lead.id)).status).toBe("human_review");
  await database.pool.query(
    "update partner_contributors set revoked_at=now() where lead_id=$1 and user_id=$2",
    [lead.id, neighbor.userId],
  );
  await expect(repository.referentAssessment(neighbor, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await database.pool.query(
    "update partner_members set organization_id=(select organization_id from partner_members where user_id=$2),roles='[\"manager\"]' where user_id=$1",
    [neighbor.userId, advisor.userId],
  );
  expect((await repository.referentAssessment(neighbor, lead.id)).status).toBe("human_review");
  await expect(repository.advisorAssessment(neighbor, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await database.pool.query("update partner_members set state='suspended' where user_id=$1", [
    neighbor.userId,
  ]);
  await expect(repository.referentAssessment(neighbor, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    owner.id,
  ]);
  await expect(repository.referentAssessment(owner, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  const stale = await actor(true);
  await database.pool.query(
    "update identity_sessions set mfa_verified_at=now()-interval '25 hours' where id=$1",
    [stale.id],
  );
  await expect(repository.referentAssessment(stale, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  const revoked = await actor(true);
  await database.pool.query(
    "update identity_admin_permissions set revoked_at=now() where user_id=$1",
    [revoked.userId],
  );
  await expect(repository.referentAssessment(revoked, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
});

it("does not assess an absent, unavailable, changed, or declined referent and prioritizes change requests and closure", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional(),
    lead = await assigned(owner, advisor);
  expect(await repository.referentAssessment(owner, lead.id)).toMatchObject({
    status: "unset",
    assessment: null,
  });
  await chooseReferent(owner, null);
  expect(await repository.referentAssessment(owner, lead.id)).toMatchObject({
    status: "coverview",
    assessment: null,
  });
  await chooseReferent(owner, advisor.userId);
  await database.pool.query("update partner_members set state='suspended' where user_id=$1", [
    advisor.userId,
  ]);
  const unavailable = await repository.referentAssessment(owner, lead.id);
  expect(unavailable).toMatchObject({
    status: "unavailable",
    assessment: null,
    selection: { advisor: null },
  });
  expect(JSON.stringify(unavailable)).not.toContain(advisor.userId);
  await database.pool.query("update partner_members set state='approved' where user_id=$1", [
    advisor.userId,
  ]);
  await repository.command(
    owner,
    lead.id,
    {
      action: "client_interlocutor",
      revision: (await repository.detail(owner, lead.id)).revision,
      reason: "Autre interlocuteur souhaité",
    },
    key(),
  );
  const before = await unchanged(lead.id);
  expect(await repository.referentAssessment(owner, lead.id)).toMatchObject({
    status: "client_change_requested",
    assessment: null,
  });
  expect(await unchanged(lead.id)).toEqual(before);
  await repository.command(
    admin,
    lead.id,
    {
      action: "close",
      revision: (await repository.detail(admin, lead.id)).revision,
      result: "resolved_without_contract",
      reason: "current_suitable",
      comment: "Conserver",
    },
    key(),
  );
  expect(await repository.referentAssessment(owner, lead.id)).toMatchObject({
    status: "closed",
    assessment: null,
  });
});

it("follows actual managed-profile transfers, never revives a round-trip choice and excludes a former subject", async () => {
  const owner = { ...(await actor()), wallet: true },
    destination = { ...(await actor()), wallet: true },
    advisor = await professional();
  const profile = await createManagedProfileRepository(database.db).create(
    owner,
    { kind: "person", displayName: "Sujet référent" },
    key(),
  );
  const lead = await assigned(owner, advisor, profile.id);
  await preferences(owner, lead);
  await chooseReferent(owner, advisor.userId, profile.id);
  const transfers = createAdminProfileTransferRepository(database.db);
  await transfers.transfer(
    { id: admin.id, userId: owner.userId, administratorUserId: admin.userId },
    profile.id,
    { destinationUserId: destination.userId, revision: profile.revision },
    key(),
  );
  await expect(repository.referentAssessment(owner, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  expect(await repository.referentAssessment(destination, lead.id)).toMatchObject({
    status: "confirmation_required",
    assessment: null,
    selection: { advisor: null },
  });
  await transfers.transfer(
    { id: admin.id, userId: destination.userId, administratorUserId: admin.userId },
    profile.id,
    { destinationUserId: owner.userId, revision: 1 },
    key(),
  );
  expect((await repository.referentAssessment(owner, lead.id)).status).toBe(
    "confirmation_required",
  );
  await chooseReferent(owner, advisor.userId, profile.id);
  expect((await repository.referentAssessment(owner, lead.id)).assessment?.preferences.status).toBe(
    "confirmation_required",
  );
  await database.pool.query(
    "update partner_leads set client_profile_id=null,client_user_id=$2 where id=$1",
    [lead.id, destination.userId],
  );
  const moved = await repository.referentAssessment(destination, lead.id);
  expect(moved).toMatchObject({ status: "unset", assessment: null });
  expect(JSON.stringify(moved)).not.toContain(advisor.userId);
  await expect(repository.referentAssessment(owner, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await database.pool.query("update partner_leads set client_user_id=null where id=$1", [lead.id]);
  expect(await repository.referentAssessment(admin, lead.id)).toMatchObject({
    status: "unlinked",
    selection: null,
    assessment: null,
  });
});

it("keeps referent selection and professional sources in one snapshot and rejects a concurrent profile generation", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional();
  const profile = await createManagedProfileRepository(database.db).create(
    owner,
    { kind: "person", displayName: "Référent concurrence" },
    key(),
  );
  const lead = await assigned(owner, advisor, profile.id);
  await chooseReferent(owner, advisor.userId, profile.id);
  await declarations(advisor);
  await preferences(owner, lead);
  const blocker = await database.pool.connect();
  let pending: Promise<unknown> | undefined;
  try {
    for (const changeProfile of [false, true]) {
      await blocker.query("begin");
      await blocker.query("select id from managed_profiles where id=$1 for update", [profile.id]);
      pending = repository.referentAssessment(owner, lead.id).catch((cause: unknown) => cause);
      await expect
        .poll(
          async () =>
            (
              await database.pool.query(
                "select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%managed_profiles%' and pid<>pg_backend_pid() limit 1",
              )
            ).rowCount,
          { timeout: 5000 },
        )
        .toBe(1);
      if (changeProfile)
        await blocker.query("update managed_profiles set revision=revision+1 where id=$1", [
          profile.id,
        ]);
      else
        await blocker.query("update partner_members set state='suspended' where user_id=$1", [
          advisor.userId,
        ]);
      await blocker.query("commit");
      if (changeProfile) {
        expect(await pending).toMatchObject({ code: "PARTNER_CONFLICT", statusCode: 409 });
        expect(await repository.referentAssessment(owner, lead.id)).toMatchObject({
          status: "confirmation_required",
          assessment: null,
        });
      } else {
        expect(await pending).toMatchObject({
          status: "human_review",
          assessment: { criteria: { language: { status: "matches" } } },
        });
        expect(await repository.referentAssessment(owner, lead.id)).toMatchObject({
          status: "unavailable",
          assessment: null,
        });
        await database.pool.query("update partner_members set state='approved' where user_id=$1", [
          advisor.userId,
        ]);
      }
    }
  } finally {
    await blocker.query("rollback");
    blocker.release();
    if (pending) await pending;
  }
});

async function sharedInput(person: PartnerActor, modes: SharedModesInput["modes"] = ["home"]) {
  const dossier = await repository.sharedModes(person, person.userId);
  return sharedModesInputSchema.parse({
    revision: dossier.current?.revision ?? 0,
    professionalRevision: dossier.professionalRevision,
    action: modes.length ? "publish" : "withdraw",
    modes,
    audience: "confirmed-referent-leads-v1",
    confirmed: true,
  });
}
async function sharedAssessment(reader: PartnerActor, id: string) {
  return sharedReferentAssessmentSchema.parse(
    await repository.referentAssessment(reader, id, true),
  );
}

it("publishes only explicitly shared modes in v2, preserves v1 and personal sources, and creates no Lead effects", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional(),
    referent = await professional();
  const lead = await assigned(owner, advisor);
  await assigned(owner, referent);
  await chooseReferent(owner, referent.userId);
  await preferences(owner, lead);
  await declarations(referent);
  const privateBefore = await repository.availability(referent, referent.userId);
  const before = await unchanged(lead.id);
  const v1 = referentAssessmentSchema.parse(await repository.referentAssessment(owner, lead.id));
  expect((await sharedAssessment(owner, lead.id)).assessment).toMatchObject({
    sharedModes: { status: "missing", modes: [], declaredAt: null },
    criteria: { mode: { status: "unknown" } },
  });
  const input = await sharedInput(referent, ["video"]);
  const shared = await repository.declareSharedModes(referent, referent.userId, input, key());
  expect(shared.current).toMatchObject({
    revision: 1,
    professionalScope: "current",
    modes: ["video"],
    audience: "confirmed-referent-leads-v1",
    categories: ["vehicle"],
  });
  const value = await sharedAssessment(owner, lead.id);
  expect(value.assessment).toMatchObject({
    sharedModes: { status: "declared", modes: ["video"], declaredAt: shared.current!.declaredAt },
    criteria: { mode: { status: "differs", reason: "declared_difference" } },
  });
  for (const reader of [advisor, admin])
    expect((await sharedAssessment(reader, lead.id)).assessment).toEqual(value.assessment);
  const afterV1 = referentAssessmentSchema.parse(
    await repository.referentAssessment(owner, lead.id),
  );
  expect({ ...afterV1, assessedAt: v1.assessedAt }).toEqual(v1);
  expect(referentAssessmentSchema.safeParse(value).success).toBe(false);
  expect(await repository.availability(referent, referent.userId)).toEqual(privateBefore);
  await repository.declareAvailability(
    referent,
    referent.userId,
    {
      revision: privateBefore.current!.revision,
      professionalRevision: privateBefore.professionalRevision,
      modes: ["home"],
      timezone: "Europe/Zurich",
      periods: [
        {
          kind: "absent",
          startsAt: "2027-02-01T08:00:00.000Z",
          endsAt: "2027-02-01T09:00:00.000Z",
        },
      ],
      confirmed: true,
    },
    key(),
  );
  expect((await sharedAssessment(owner, lead.id)).assessment).toEqual(value.assessment);
  for (const forbidden of [
    "periods",
    "2027-02-01",
    "history",
    "professionalRevision",
    "audience",
    "eligible",
    "score",
  ])
    expect(JSON.stringify(value)).not.toContain(forbidden);
  await expect(sharedAssessment(referent, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  expect(await unchanged(lead.id)).toEqual(before);
  const events = await database.pool.query(
    "select audience,text,lead_id,actor_id from partner_events where kind='modes.shared.v1' and actor_id=$1",
    [referent.userId],
  );
  expect(events.rows).toEqual([
    { audience: "private", text: "", lead_id: null, actor_id: referent.userId },
  ]);
});

it("requires explicit versioned consent and atomically rolls back sharing when its audit cannot persist", async () => {
  const person = await professional(),
    input = await sharedInput(person);
  for (const invalid of [
    { ...input, confirmed: false },
    { ...input, audience: "public" },
    { ...input, modes: [] },
    { ...input, modes: ["home", "home"] },
    { ...input, action: "withdraw" },
    { ...input, extra: true },
  ]) {
    expect(sharedModesInputSchema.safeParse(invalid).success).toBe(false);
    expect(() =>
      repository.declareSharedModes(person, person.userId, invalid as SharedModesInput, key()),
    ).toThrow();
  }
  await expect(
    repository.declareSharedModes(
      person,
      person.userId,
      { ...input, action: "withdraw", modes: [] },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  // A real SQL failure exercises rollback of the declaration and idempotency record, not a mocked transaction.
  await database.pool.query(
    "create function isolated_shared_audit_failure() returns trigger language plpgsql as $$ begin if NEW.kind='modes.shared.v1' then raise exception 'Isolated audit failure'; end if; return NEW; end $$",
  );
  await database.pool.query(
    "create trigger isolated_shared_audit_failure before insert on partner_events for each row execute function isolated_shared_audit_failure()",
  );
  const commandKey = key();
  try {
    await expect(
      repository.declareSharedModes(person, person.userId, input, commandKey),
    ).rejects.toThrow("Isolated audit failure");
    expect((await repository.sharedModes(person, person.userId)).current).toBeNull();
    expect(
      (
        await database.pool.query("select id from partner_commands where user_id=$1 and key=$2", [
          person.userId,
          commandKey,
        ])
      ).rowCount,
    ).toBe(0);
  } finally {
    await database.pool.query("drop trigger isolated_shared_audit_failure on partner_events");
    await database.pool.query("drop function isolated_shared_audit_failure()");
  }
  await repository.declareSharedModes(person, person.userId, input, commandKey);
  for (const [action, modes, audience] of [
    ["publish", [], "confirmed-referent-leads-v1"],
    ["withdraw", ["home"], "confirmed-referent-leads-v1"],
    ["publish", ["other"], "confirmed-referent-leads-v1"],
    ["publish", ["home"], "public"],
  ]) {
    await expect(
      database.pool.query(
        "insert into partner_shared_modes(id,user_id,organization_id,revision,professional_revision,declared_name,declared_organization,categories,action,modes,audience) select $1,user_id,organization_id,2,professional_revision,declared_name,declared_organization,categories,$2,$3,$4 from partner_shared_modes where user_id=$5 and revision=1",
        [key(), action, modes, audience, person.userId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  }
  expect((await repository.sharedModes(person, person.userId)).history).toHaveLength(1);
});

it("serializes shared declarations, keeps exact replay current after withdrawal, and bounds immutable history", async () => {
  const person = await professional(),
    input = await sharedInput(person),
    firstKey = key();
  const race = await Promise.allSettled([
    repository.declareSharedModes(person, person.userId, input, firstKey),
    repository.declareSharedModes(person, person.userId, { ...input, modes: ["phone"] }, key()),
  ]);
  expect(race.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(race.find((r) => r.status === "rejected")).toMatchObject({
    reason: { code: "PARTNER_CONFLICT" },
  });
  const publishInput = await sharedInput(person, ["home"]),
    publishKey = key();
  await repository.declareSharedModes(person, person.userId, publishInput, publishKey);
  const withdrawInput = await sharedInput(person, []),
    withdrawKey = key();
  const withdrawn = await repository.declareSharedModes(
    person,
    person.userId,
    withdrawInput,
    withdrawKey,
  );
  expect(
    await repository.declareSharedModes(person, person.userId, publishInput, publishKey),
  ).toEqual(withdrawn);
  expect(
    await repository.declareSharedModes(person, person.userId, withdrawInput, withdrawKey),
  ).toEqual(withdrawn);
  await expect(
    repository.declareSharedModes(
      person,
      person.userId,
      { ...publishInput, modes: ["office"] },
      publishKey,
    ),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
  const historical = withdrawn.history;
  for (let i = 0; i < 20; i++)
    await repository.declareSharedModes(
      person,
      person.userId,
      await sharedInput(person, ["video"]),
      key(),
    );
  const current = await repository.sharedModes(person, person.userId);
  expect(current.history).toHaveLength(20);
  expect(current.current?.revision).toBe(23);
  const older = await repository.sharedModes(person, person.userId, current.nextBeforeRevision!);
  expect(older.current).toEqual(current.current);
  expect(older.history).toEqual(historical);
  expect(older.nextBeforeRevision).toBeNull();
  await expect(repository.sharedModes(person, person.userId, 0)).rejects.toBeDefined();
});

it("limits the dossier to self and current Admin authority and permits only withdrawal after closure", async () => {
  const person = await professional(),
    neighbor = await professional(),
    wallet = { ...(await actor()), wallet: true };
  const input = await sharedInput(person),
    publishKey = key();
  await repository.declareSharedModes(person, person.userId, input, publishKey);
  await database.pool.query(
    "update partner_members set organization_id=(select organization_id from partner_members where user_id=$2),roles='[\"manager\"]' where user_id=$1",
    [neighbor.userId, person.userId],
  );
  for (const reader of [neighbor, wallet, { ...person, wallet: true }]) {
    await expect(repository.sharedModes(reader, person.userId)).rejects.toMatchObject({
      code: "PARTNER_ACCESS_DENIED",
    });
    await expect(
      repository.declareSharedModes(reader, person.userId, input, key()),
    ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  }
  expect(await repository.sharedModes(admin, person.userId)).toMatchObject({
    canPublish: false,
    canWithdraw: false,
  });
  await expect(
    repository.declareSharedModes(admin, person.userId, input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  for (const revoke of [
    "update identity_admin_permissions set revoked_at=now() where user_id=$1",
    "update identity_sessions set mfa_verified_at=now()-interval '25 hours' where user_id=$1",
  ]) {
    const invalidAdmin = await actor(true);
    await database.pool.query(revoke, [invalidAdmin.userId]);
    await expect(repository.sharedModes(invalidAdmin, person.userId)).rejects.toMatchObject({
      code: "PARTNER_ACCESS_DENIED",
    });
  }
  await database.pool.query("update partner_members set state='closed' where user_id=$1", [
    person.userId,
  ]);
  expect(await repository.sharedModes(person, person.userId)).toMatchObject({
    canPublish: false,
    canWithdraw: true,
  });
  await expect(
    repository.declareSharedModes(person, person.userId, input, publishKey),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  const withdrawal = await sharedInput(person, []),
    withdrawalKey = key();
  expect(
    await repository.declareSharedModes(person, person.userId, withdrawal, withdrawalKey),
  ).toMatchObject({ canPublish: false, canWithdraw: false, current: { action: "withdraw" } });
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    person.id,
  ]);
  await expect(repository.sharedModes(person, person.userId)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await expect(
    repository.declareSharedModes(person, person.userId, withdrawal, withdrawalKey),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  const candidate = await actor();
  await repository.apply(
    candidate,
    partnerApplicationInputSchema.parse({
      name: "Candidat isolé",
      organization: "Organisation candidate",
      phone: "",
      roles: ["advisor"],
      categories: ["vehicle"],
      languages: "fr",
      regions: "GE",
      qualifications: "Test",
    }),
    key(),
  );
  expect((await repository.context(candidate)).operational).toBe(false);
  expect(
    await repository.declareSharedModes(
      candidate,
      candidate.userId,
      await sharedInput(candidate),
      key(),
    ),
  ).toMatchObject({ current: { action: "publish" } });
  expect((await repository.context(candidate)).operational).toBe(false);
});

it("invalidates sharing on professional round trips and requires current scope before reconfirmation", async () => {
  const owner = { ...(await actor()), wallet: true },
    person = await professional(),
    lead = await assigned(owner, person);
  await chooseReferent(owner, person.userId);
  await preferences(owner, lead);
  await repository.declareSharedModes(person, person.userId, await sharedInput(person), key());
  for (const [field, changed, original] of [
    ["name", "Autre nom", "Conseiller isolé"],
    ["organization", "Autre organisation", "Organisation isolée"],
    ["categories", ["vehicle", "health"], ["vehicle"]],
  ] as const) {
    const staleInput = await sharedInput(person);
    for (const value of [changed, original])
      await database.pool.query(
        "update partner_members set application=jsonb_set(application,ARRAY[$2::text],$3::jsonb) where user_id=$1",
        [person.userId, field, JSON.stringify(value)],
      );
    expect((await repository.sharedModes(person, person.userId)).current?.professionalScope).toBe(
      "changed",
    );
    expect((await sharedAssessment(owner, lead.id)).assessment).toMatchObject({
      sharedModes: { status: "scope_changed", modes: [], declaredAt: null },
      criteria: { mode: { status: "unknown", reason: "declaration_scope_changed" } },
    });
    await expect(
      repository.declareSharedModes(person, person.userId, staleInput, key()),
    ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
    await repository.declareSharedModes(person, person.userId, await sharedInput(person), key());
    expect((await sharedAssessment(owner, lead.id)).assessment?.criteria.mode.status).toBe(
      "matches",
    );
  }
  await repository.declareSharedModes(person, person.userId, await sharedInput(person, []), key());
  expect((await sharedAssessment(owner, lead.id)).assessment).toMatchObject({
    sharedModes: { status: "withdrawn", modes: [], declaredAt: null },
    criteria: { mode: { status: "unknown", reason: "shared_source_unavailable" } },
  });
});

it("keeps v2 preferences, client choices, transfers and closure ahead of shared modes without granting new readers", async () => {
  const owner = { ...(await actor()), wallet: true },
    destination = { ...(await actor()), wallet: true },
    person = await professional(),
    neighbor = await professional();
  const profile = await createManagedProfileRepository(database.db).create(
    owner,
    { kind: "person", displayName: "Partage sujet" },
    key(),
  );
  const lead = await assigned(owner, person, profile.id);
  await repository.declareSharedModes(
    person,
    person.userId,
    await sharedInput(person, ["phone"]),
    key(),
  );
  expect(await sharedAssessment(owner, lead.id)).toMatchObject({
    assessment: null,
    status: "unset",
  });
  await chooseReferent(owner, person.userId, profile.id);
  expect((await sharedAssessment(owner, lead.id)).assessment?.criteria.mode.reason).toBe(
    "preferences_unset",
  );
  await preferences(owner, lead, "phone");
  expect((await sharedAssessment(owner, lead.id)).assessment?.criteria).toMatchObject({
    mode: { status: "matches" },
    canton: { status: "not_applicable" },
  });
  for (const reader of [neighbor, destination])
    await expect(sharedAssessment(reader, lead.id)).rejects.toMatchObject({
      code: "PARTNER_NOT_FOUND",
    });
  await database.pool.query(
    "insert into partner_contributors(id,lead_id,user_id,access_scope,can_edit,can_contact) values($1,$2,$3,'progress',false,false)",
    [key(), lead.id, neighbor.userId],
  );
  await expect(sharedAssessment(neighbor, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await database.pool.query(
    "update partner_members set organization_id=(select organization_id from partner_members where user_id=$2),roles='[\"manager\"]' where user_id=$1",
    [neighbor.userId, person.userId],
  );
  expect((await sharedAssessment(neighbor, lead.id)).assessment?.sharedModes.modes).toEqual([
    "phone",
  ]);
  await createAdminProfileTransferRepository(database.db).transfer(
    { id: admin.id, userId: owner.userId, administratorUserId: admin.userId },
    profile.id,
    { destinationUserId: destination.userId, revision: profile.revision },
    key(),
  );
  await expect(sharedAssessment(owner, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  expect(await sharedAssessment(destination, lead.id)).toMatchObject({
    assessment: null,
    status: "confirmation_required",
    selection: { advisor: null },
  });
  await chooseReferent(destination, person.userId, profile.id);
  expect((await sharedAssessment(destination, lead.id)).assessment?.criteria.mode.reason).toBe(
    "preferences_confirmation_required",
  );
  await preferences(destination, lead);
  await repository.command(
    destination,
    lead.id,
    {
      action: "client_interlocutor",
      revision: (await repository.detail(destination, lead.id)).revision,
      reason: "Autre interlocuteur",
    },
    key(),
  );
  expect(await sharedAssessment(destination, lead.id)).toMatchObject({
    assessment: null,
    status: "client_change_requested",
  });
  await repository.command(
    admin,
    lead.id,
    {
      action: "close",
      revision: (await repository.detail(admin, lead.id)).revision,
      result: "resolved_without_contract",
      reason: "current_suitable",
      comment: "Conserver",
    },
    key(),
  );
  expect(await sharedAssessment(destination, lead.id)).toMatchObject({
    assessment: null,
    status: "closed",
  });
});

it("reads shared publication and withdrawal in the same repeatable snapshot as the referent and preferences", async () => {
  const owner = { ...(await actor()), wallet: true },
    person = await professional();
  const profile = await createManagedProfileRepository(database.db).create(
    owner,
    { kind: "person", displayName: "Partage concurrence" },
    key(),
  );
  const lead = await assigned(owner, person, profile.id);
  await chooseReferent(owner, person.userId, profile.id);
  await preferences(owner, lead);
  await repository.declareSharedModes(person, person.userId, await sharedInput(person), key());
  const blocker = await database.pool.connect();
  let pending: Promise<unknown> | undefined;
  try {
    await blocker.query("begin");
    await blocker.query("select id from managed_profiles where id=$1 for update", [profile.id]);
    pending = sharedAssessment(owner, lead.id).catch((cause: unknown) => cause);
    await expect
      .poll(
        async () =>
          (
            await database.pool.query(
              "select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%managed_profiles%' and pid<>pg_backend_pid() limit 1",
            )
          ).rowCount,
        { timeout: 5000 },
      )
      .toBe(1);
    await repository.declareSharedModes(
      person,
      person.userId,
      await sharedInput(person, []),
      key(),
    );
    await blocker.query("commit");
    expect(await pending).toMatchObject({
      assessment: {
        sharedModes: { status: "declared", modes: ["home"] },
        criteria: { mode: { status: "matches" } },
      },
    });
    expect((await sharedAssessment(owner, lead.id)).assessment).toMatchObject({
      sharedModes: { status: "withdrawn", modes: [] },
      criteria: { mode: { status: "unknown" } },
    });
  } finally {
    await blocker.query("rollback");
    blocker.release();
    if (pending) await pending;
  }
});

async function capacityInput(person: PartnerActor, position: CapacityInput["position"] = "open") {
  const dossier = await repository.capacity(person, person.userId);
  return capacityInputSchema.parse({
    revision: dossier.current?.revision ?? 0,
    professionalRevision: dossier.professionalRevision,
    action: position ? "declare" : "withdraw",
    position,
    validUntil: position ? new Date(Date.now() + 86400000).toISOString() : null,
    confirmed: true,
  });
}
async function capacityAssessment(person: PartnerActor, leadId: string) {
  return capacityAdvisorAssessmentSchema.parse(
    await repository.advisorAssessment(person, leadId, true),
  );
}

it("projects only current private capacity in v2, keeps human checks and separates multiple Lead links without any writes", async () => {
  const owner = { ...(await actor()), wallet: true },
    person = await professional(),
    lead = await assigned(owner, person);
  await assigned(owner, person);
  await chooseReferent(owner, person.userId);
  const missing = await capacityAssessment(person, lead.id);
  expect(missing.capacity).toEqual({
    source: "personal_declaration",
    status: "missing",
    position: null,
    declaration: null,
    decision: "human_review_required",
  });
  const v1 = await repository.advisorAssessment(person, lead.id);
  for (const position of ["open", "case_by_case", "unavailable"] as const) {
    const declaration = (
      await repository.declareCapacity(
        person,
        person.userId,
        await capacityInput(person, position),
        key(),
      )
    ).current!;
    const before = await unchanged(lead.id);
    const value = await capacityAssessment(person, lead.id);
    expect(value.capacity).toMatchObject({
      status: "declared",
      position,
      decision: "human_review_required",
      declaration: {
        revision: declaration.revision,
        professionalRevision: declaration.professionalRevision,
        categories: ["vehicle"],
        professionalScope: "current",
        declaredAt: declaration.declaredAt,
        validUntil: declaration.validUntil,
      },
    });
    expect(value.workload).toEqual({
      observedAt: value.assessedAt,
      accepted: 2,
      proposed: 0,
      contributing: 0,
    });
    expect(value.remainingChecks).toEqual(v1.remainingChecks);
    expect(value.remainingChecks).toContain("capacity");
    expect({ ...advisorAssessmentSchema.parse(value), assessedAt: v1.assessedAt }).toEqual(v1);
    expect(await unchanged(lead.id)).toEqual(before);
    for (const forbidden of [
      "history",
      "declaredName",
      "declaredOrganization",
      "score",
      "eligible",
    ])
      expect(value.capacity).not.toHaveProperty(forbidden);
  }
  const beforeShared = await repository.detail(owner, lead.id);
  for (const reader of [owner, admin, person]) {
    expect(await repository.detail(reader, lead.id)).not.toHaveProperty("capacity");
    for (const shared of [false, true]) {
      const result = await repository.referentAssessment(reader, lead.id, shared);
      expect(result).not.toHaveProperty("capacity");
      expect(result.assessment).not.toBeNull();
      expect(result.assessment).not.toHaveProperty("capacity");
      expect(result.assessment).not.toHaveProperty("workload");
    }
  }
  expect(await repository.detail(owner, lead.id)).toEqual(beforeShared);
});

it("masks expired and withdrawn positions, preserves their source dates and requires a new version to reconfirm", async () => {
  const owner = { ...(await actor()), wallet: true },
    person = await professional(),
    lead = await assigned(owner, person);
  const command = {
    ...(await capacityInput(person)),
    validUntil: new Date(Date.now() + 1500).toISOString(),
  };
  await repository.declareCapacity(person, person.userId, command, key());
  expect((await capacityAssessment(person, lead.id)).capacity.status).toBe("declared");
  await database.pool.query(
    "select pg_sleep(greatest(0,extract(epoch from ($1::timestamptz-clock_timestamp())))+0.02)",
    [command.validUntil],
  );
  const before = await unchanged(lead.id);
  expect((await capacityAssessment(person, lead.id)).capacity).toMatchObject({
    status: "expired",
    position: null,
    declaration: { revision: 1, validUntil: command.validUntil },
  });
  await repository.declareCapacity(
    person,
    person.userId,
    await capacityInput(person, "case_by_case"),
    key(),
  );
  expect((await capacityAssessment(person, lead.id)).capacity).toMatchObject({
    status: "declared",
    position: "case_by_case",
    declaration: { revision: 2 },
  });
  const withdrawal = (
    await repository.declareCapacity(
      person,
      person.userId,
      await capacityInput(person, null),
      key(),
    )
  ).current!;
  expect((await capacityAssessment(person, lead.id)).capacity).toMatchObject({
    status: "withdrawn",
    position: null,
    declaration: { revision: 3, declaredAt: withdrawal.declaredAt, validUntil: null },
  });
  expect(await unchanged(lead.id)).toEqual(before);
  await repository.declareCapacity(
    person,
    person.userId,
    await capacityInput(person, "unavailable"),
    key(),
  );
  expect((await capacityAssessment(person, lead.id)).capacity).toMatchObject({
    status: "declared",
    position: "unavailable",
    declaration: { revision: 4 },
  });
});

it("does not revive capacity after a professional round trip and keeps the personal Admin category exception separate", async () => {
  const owner = { ...(await actor()), wallet: true },
    person = await professional(),
    lead = await assigned(owner, person);
  await repository.declareCapacity(person, person.userId, await capacityInput(person), key());
  for (const name of ["Autre identité", "Conseiller isolé"]) {
    await database.pool.query(
      "update partner_members set application=jsonb_set(application,'{name}',$2::jsonb) where user_id=$1",
      [person.userId, JSON.stringify(name)],
    );
    expect((await capacityAssessment(person, lead.id)).capacity).toMatchObject({
      status: "scope_changed",
      position: null,
      declaration: { revision: 1, professionalScope: "changed" },
    });
  }
  await repository.declareCapacity(person, person.userId, await capacityInput(person), key());
  expect((await capacityAssessment(person, lead.id)).capacity.status).toBe("declared");
  await database.pool.query(
    "update partner_members set application=jsonb_set(application,'{categories}','[\"health\"]') where user_id=$1",
    [person.userId],
  );
  await expect(capacityAssessment(person, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await database.pool.query(
    "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated capacity test')",
    [key(), person.userId],
  );
  const selfAdmin = { ...person, administrator: true };
  await repository.declareCapacity(selfAdmin, person.userId, await capacityInput(selfAdmin), key());
  const outsideCategory = await capacityAssessment(selfAdmin, lead.id);
  expect(outsideCategory.capacity).toMatchObject({
    status: "category_not_covered",
    position: null,
    declaration: { categories: ["health"], professionalScope: "current" },
  });
  expect(outsideCategory.workload.accepted).toBe(1);
  expect(outsideCategory.remainingChecks).toContain("capacity");
});

it("retains a coherent declaration, expiry and workload while another Lead changes during a real profile lock wait", async () => {
  const owner = { ...(await actor()), wallet: true },
    person = await professional();
  const profile = await createManagedProfileRepository(database.db).create(
    owner,
    { kind: "person", displayName: "Capacité concurrence" },
    key(),
  );
  const lead = await assigned(owner, person, profile.id),
    otherLead = await assigned(owner, person);
  const command = {
    ...(await capacityInput(person)),
    validUntil: new Date(Date.now() + 2500).toISOString(),
  };
  await repository.declareCapacity(person, person.userId, command, key());
  const blocker = await database.pool.connect();
  let pending: ReturnType<typeof capacityAssessment> | undefined;
  try {
    await blocker.query("begin");
    await blocker.query("select id from managed_profiles where id=$1 for update", [profile.id]);
    pending = capacityAssessment(person, lead.id);
    await expect
      .poll(
        async () =>
          (
            await database.pool.query(
              "select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%managed_profiles%' and pid<>pg_backend_pid() limit 1",
            )
          ).rowCount,
        { timeout: 5000 },
      )
      .toBe(1);
    await repository.command(
      admin,
      otherLead.id,
      {
        action: "close",
        revision: otherLead.revision,
        result: "resolved_without_contract",
        reason: "current_suitable",
        comment: "Conserver",
      },
      key(),
    );
    await database.pool.query(
      "select pg_sleep(greatest(0,extract(epoch from ($1::timestamptz-clock_timestamp())))+0.02)",
      [command.validUntil],
    );
    await blocker.query("commit");
    const snapshot = await pending;
    expect(Date.parse(snapshot.assessedAt)).toBeLessThan(Date.parse(command.validUntil));
    expect(snapshot.capacity).toMatchObject({ status: "declared", position: "open" });
    expect(snapshot.workload).toMatchObject({ observedAt: snapshot.assessedAt, accepted: 2 });
    const fresh = await capacityAssessment(person, lead.id);
    expect(fresh.capacity).toMatchObject({ status: "expired", position: null });
    expect(fresh.workload).toMatchObject({ observedAt: fresh.assessedAt, accepted: 1 });
  } finally {
    await blocker.query("rollback");
    blocker.release();
    if (pending) await pending;
  }
});

it("serializes a personal withdrawal behind a reading assessment and shows the new source on the next read", async () => {
  const owner = { ...(await actor()), wallet: true },
    person = await professional();
  const profile = await createManagedProfileRepository(database.db).create(
    owner,
    { kind: "person", displayName: "Retrait concurrence" },
    key(),
  );
  const lead = await assigned(owner, person, profile.id);
  await repository.declareCapacity(person, person.userId, await capacityInput(person), key());
  const withdrawal = await capacityInput(person, null),
    blocker = await database.pool.connect();
  let pending: ReturnType<typeof capacityAssessment> | undefined;
  let withdrawing: ReturnType<typeof repository.declareCapacity> | undefined;
  try {
    await blocker.query("begin");
    await blocker.query("select id from managed_profiles where id=$1 for update", [profile.id]);
    pending = capacityAssessment(person, lead.id);
    await expect
      .poll(
        async () =>
          (
            await database.pool.query(
              "select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%managed_profiles%' and pid<>pg_backend_pid() limit 1",
            )
          ).rowCount,
        { timeout: 5000 },
      )
      .toBe(1);
    withdrawing = repository.declareCapacity(person, person.userId, withdrawal, key());
    await expect
      .poll(
        async () =>
          (
            await database.pool.query(
              "select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%identity_users%' and pid<>pg_backend_pid() limit 1",
            )
          ).rowCount,
        { timeout: 5000 },
      )
      .toBe(1);
    await blocker.query("commit");
    expect((await pending).capacity).toMatchObject({
      status: "declared",
      position: "open",
      declaration: { revision: 1 },
    });
    await withdrawing;
    expect((await capacityAssessment(person, lead.id)).capacity).toMatchObject({
      status: "withdrawn",
      position: null,
      declaration: { revision: 2 },
    });
  } finally {
    await blocker.query("rollback");
    blocker.release();
    if (pending) await pending;
    if (withdrawing) await withdrawing;
  }
});

it("serves the legacy personal and shared assessments without reading the capacity table, and never pretends v2 data is missing on a schema failure", async () => {
  const owner = { ...(await actor()), wallet: true },
    person = await professional(),
    lead = await assigned(owner, person);
  const before = await repository.advisorAssessment(person, lead.id);
  // Only this test container: exercise a staged deployment before 0048 is available.
  await database.pool.query(
    "alter table partner_capacity_declarations rename to isolated_capacity_unavailable",
  );
  try {
    const legacy = await repository.advisorAssessment(person, lead.id);
    expect({ ...legacy, assessedAt: before.assessedAt }).toEqual(before);
    expect(legacy).not.toHaveProperty("capacity");
    expect(legacy).not.toHaveProperty("workload");
    for (const shared of [false, true])
      expect(await repository.referentAssessment(owner, lead.id, shared)).not.toHaveProperty(
        "capacity",
      );
    await expect(capacityAssessment(person, lead.id)).rejects.toMatchObject({ code: "42P01" });
  } finally {
    await database.pool.query(
      "alter table isolated_capacity_unavailable rename to partner_capacity_declarations",
    );
  }
});

it("joins only personal competence evidence to the exact need without creating an expertise decision or exposing it in shared assessments", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional();
  const lead = await assigned(owner, advisor),
    second = await assigned(owner, advisor);
  await database.pool.query(
    "update partner_leads set title='Second véhicule',object='Autre voiture' where id=$1",
    [second.id],
  );
  const missing = await repository.needExpertiseEvidence(advisor, lead.id);
  expect(missing.competence).toMatchObject({
    summary: { status: "missing" },
    current: null,
    sourceStatus: "missing",
  });
  const documentId = await proof(advisor);
  const before = await unchanged(lead.id);
  const result = needExpertiseEvidenceSchema.parse(
    await repository.needExpertiseEvidence(advisor, lead.id),
  );
  expect(result).toMatchObject({
    version: 1,
    leadId: lead.id,
    advisorId: advisor.userId,
    assessment: "human_review_required",
    scope: { title: lead.title, category: "vehicle", object: "Voiture", context: "Besoin isolé" },
    competence: {
      summary: { status: "reviewed" },
      sourceStatus: "available",
      current: {
        declaration: "Déclaration privée isolée",
        reason: "Motif privé isolé",
        documentName: "Preuve-privée.pdf",
        coverage: "category",
        professionalScope: "current",
      },
    },
  });
  expect(result.competence.reviewedDocumentRevision).toBe(
    result.competence.current!.documentRevision,
  );
  expect(JSON.stringify(result)).not.toContain(documentId);
  for (const field of ["canDownload", "checksum", "storageKey", "history"])
    expect(result.competence.current).not.toHaveProperty(field);
  expect((await repository.needExpertiseEvidence(advisor, second.id)).scope).toMatchObject({
    title: "Second véhicule",
    object: "Autre voiture",
  });
  for (const includeCapacity of [false, true]) {
    const personal = await repository.advisorAssessment(advisor, lead.id, includeCapacity);
    expect(personal.remainingChecks).toHaveLength(6);
    expect(personal.remainingChecks).toContain("need_expertise");
    const shared = await repository.referentAssessment(owner, lead.id, includeCapacity);
    for (const value of ["Motif privé isolé", "Preuve-privée.pdf", "Déclaration privée isolée"])
      expect(JSON.stringify([personal, shared])).not.toContain(value);
  }
  expect(await unchanged(lead.id)).toEqual(before);
  const disabled = await createPartnerRepository(database.pool, false).needExpertiseEvidence(
    advisor,
    lead.id,
  );
  expect(disabled.competence.sourceStatus).toBe("disabled");
  expect(disabled.competence.current).not.toHaveProperty("canDownload");
  expect(
    (
      await database.pool.query<{ relation: string | null }>(
        "select to_regclass('partner_need_conflict_reviews') as relation",
      )
    ).rows[0]?.relation,
  ).toBeNull();
  expect(
    (
      await database.pool.query<{ relation: string | null }>(
        "select to_regclass('partner_need_capacity_decisions') as relation",
      )
    ).rows[0]?.relation,
  ).toBeNull();
});

it("keeps limited, expired, withdrawn and replaced evidence distinct from expertise on the need", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional(),
    lead = await assigned(owner, advisor);
  await proof(advisor);
  let dossier = await repository.competence(advisor, advisor.userId, "vehicle");
  await repository.decideCompetence(
    admin,
    advisor.userId,
    "vehicle",
    competenceDecisionSchema.parse({
      revision: dossier.current!.revision,
      decision: "reviewed",
      reason: "Seulement véhicules privés",
      scope: "Véhicules privés uniquement",
      coverage: "limited",
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      documentRevision: dossier.current!.documentRevision,
      originalChecked: true,
    }),
    key(),
  );
  let result = await repository.needExpertiseEvidence(advisor, lead.id);
  expect(result.competence).toMatchObject({
    summary: { status: "limited" },
    current: { coverage: "limited", scope: "Véhicules privés uniquement" },
  });
  expect(result.assessment).toBe("human_review_required");
  await database.pool.query(
    "update partner_competence_decisions set valid_until=created_at+interval '1 millisecond' where id=$1",
    [result.competence.current!.id],
  );
  result = await repository.needExpertiseEvidence(advisor, lead.id);
  expect(result.competence.summary.status).toBe("expired");
  expect(result.assessment).toBe("human_review_required");
  dossier = await repository.competence(advisor, advisor.userId, "vehicle");
  await repository.decideCompetence(
    advisor,
    advisor.userId,
    "vehicle",
    competenceDecisionSchema.parse({
      revision: dossier.current!.revision,
      decision: "withdrawn",
      reason: "Retrait de la déclaration",
      scope: "",
      coverage: null,
      validUntil: null,
      documentRevision: dossier.current!.documentRevision,
      originalChecked: false,
    }),
    key(),
  );
  expect((await repository.needExpertiseEvidence(advisor, lead.id)).competence.summary.status).toBe(
    "withdrawn",
  );
  dossier = await repository.competence(advisor, advisor.userId, "vehicle");
  await repository.declareCompetence(
    advisor,
    advisor.userId,
    "vehicle",
    competenceDeclarationSchema.parse({
      revision: dossier.current!.revision,
      professionalRevision: dossier.professionalRevision,
      declaration: "Nouvelle déclaration à examiner",
      confirmed: true,
      file: {
        name: "Nouvel-original.pdf",
        mime: "application/pdf",
        size: 20,
        checksum: createHash("sha256").update(key()).digest("hex"),
      },
    }),
    key(),
  );
  result = await repository.needExpertiseEvidence(advisor, lead.id);
  expect(result.competence).toMatchObject({
    summary: { status: "submitted" },
    current: { declaration: "Nouvelle déclaration à examiner", reason: "", coverage: null },
    reviewedDocumentRevision: null,
    sourceStatus: "unavailable",
  });
  expect(JSON.stringify(result)).not.toContain("Seulement véhicules privés");
});

it("marks changed and unsafe sources separately and never restores applicability after a professional round trip", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional(),
    lead = await assigned(owner, advisor);
  const documentId = await proof(advisor);
  await database.pool.query("update files set revision=revision+1 where id=$1", [documentId]);
  expect((await repository.needExpertiseEvidence(advisor, lead.id)).competence).toMatchObject({
    summary: { status: "unavailable" },
    sourceStatus: "changed",
  });
  await database.pool.query(
    "update files set state='quarantined',revision=revision+1 where id=$1",
    [documentId],
  );
  expect((await repository.needExpertiseEvidence(advisor, lead.id)).competence.sourceStatus).toBe(
    "unavailable",
  );
  for (const name of ["Autre nom", "Conseiller isolé"])
    await database.pool.query(
      "update partner_members set application=jsonb_set(application,'{name}',to_jsonb($2::text)) where user_id=$1",
      [advisor.userId, name],
    );
  const result = await repository.needExpertiseEvidence(advisor, lead.id);
  expect(result.competence).toMatchObject({
    summary: { status: "unavailable" },
    current: { professionalScope: "changed", declaredName: "Conseiller isolé" },
  });
  expect(result.assessment).toBe("human_review_required");
});

it("requires a current personal mandate and never borrows the responsible advisor's private evidence for a contributor", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional(),
    neighbor = await professional(),
    lead = await assigned(owner, advisor);
  await proof(advisor);
  for (const reader of [owner, admin, neighbor])
    await expect(repository.needExpertiseEvidence(reader, lead.id)).rejects.toMatchObject({
      code: reader === neighbor ? "PARTNER_NOT_FOUND" : "PARTNER_ACCESS_DENIED",
    });
  await database.pool.query(
    "update partner_members set organization_id=(select organization_id from partner_members where user_id=$2),roles=$3::jsonb where user_id=$1",
    [neighbor.userId, advisor.userId, JSON.stringify(["advisor", "manager"])],
  );
  await expect(repository.needExpertiseEvidence(neighbor, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await database.pool.query(
    "insert into partner_contributors(id,lead_id,user_id,access_scope,can_edit,can_contact) values($1,$2,$3,'advice',false,false)",
    [key(), lead.id, neighbor.userId],
  );
  expect(await repository.needExpertiseEvidence(neighbor, lead.id)).toMatchObject({
    advisorId: neighbor.userId,
    competence: { current: null, summary: { status: "missing" } },
  });
  await database.pool.query(
    "update partner_contributors set revoked_at=now() where lead_id=$1 and user_id=$2",
    [lead.id, neighbor.userId],
  );
  await expect(repository.needExpertiseEvidence(neighbor, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await database.pool.query(
    "update partner_members set application=jsonb_set(application,'{categories}','[\"health\"]') where user_id=$1",
    [advisor.userId],
  );
  await expect(repository.needExpertiseEvidence(advisor, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
});

it("rechecks session and administrator MFA for personal evidence even after a prior successful read", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisorAdmin = await professional(),
    lead = await assigned(owner, advisorAdmin);
  await database.pool.query(
    "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated evidence test')",
    [key(), advisorAdmin.userId],
  );
  const person = { ...advisorAdmin, administrator: true };
  expect((await repository.needExpertiseEvidence(person, lead.id)).competence.canOpenDossier).toBe(
    true,
  );
  await database.pool.query(
    "update identity_sessions set mfa_verified_at=now()-interval '2 days' where id=$1",
    [person.id],
  );
  await expect(repository.needExpertiseEvidence(person, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await database.pool.query(
    "update identity_sessions set mfa_verified_at=now()-interval '1 second' where id=$1",
    [person.id],
  );
  await database.pool.query(
    "update identity_admin_permissions set revoked_at=now() where user_id=$1",
    [person.userId],
  );
  await expect(repository.needExpertiseEvidence(person, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  const advisor = await professional(),
    second = await assigned(owner, advisor);
  await repository.needExpertiseEvidence(advisor, second.id);
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    advisor.id,
  ]);
  await expect(repository.needExpertiseEvidence(advisor, second.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
});

it("rereads the current need and keeps an open client change request visible without changing the competence dossier", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional(),
    lead = await assigned(owner, advisor);
  await proof(advisor);
  const first = await repository.needExpertiseEvidence(advisor, lead.id);
  await database.pool.query(
    "update partner_leads set title='Nouveau besoin',object='Autre objet',details=jsonb_set(details,'{context}','\"Contexte modifié\"') where id=$1",
    [lead.id],
  );
  await repository.command(
    owner,
    lead.id,
    {
      action: "client_interlocutor",
      revision: lead.revision,
      reason: "Autre interlocuteur souhaité",
    },
    key(),
  );
  const result = await repository.needExpertiseEvidence(advisor, lead.id);
  expect(result.scope).toMatchObject({
    title: "Nouveau besoin",
    object: "Autre objet",
    context: "Contexte modifié",
  });
  expect(result.scopeRevision).toBeGreaterThan(first.scopeRevision);
  expect(result.changeRequested).toBe(true);
  expect(result.competence).toEqual(first.competence);
  expect(result.assessment).toBe("human_review_required");
});

it("uses one dated snapshot for need and documentary freshness while a real profile lock delays the read", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional(),
    lead = await assigned(owner, advisor);
  const documentId = await proof(advisor);
  const expiry = (
    await database.pool.query<{ valid_until: Date }>(
      "update partner_competence_decisions set valid_until=clock_timestamp()+interval '2 seconds' where user_id=$1 and decision='reviewed' returning valid_until",
      [advisor.userId],
    )
  ).rows[0]!.valid_until;
  const blocker = await database.pool.connect();
  let pending: ReturnType<typeof repository.needExpertiseEvidence> | undefined;
  try {
    await blocker.query("begin");
    await blocker.query("select id from identity_profiles where user_id=$1 for update", [
      owner.userId,
    ]);
    pending = repository.needExpertiseEvidence(advisor, lead.id);
    await expect
      .poll(
        async () =>
          (
            await database.pool.query(
              "select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%identity_profiles%' and pid<>pg_backend_pid() limit 1",
            )
          ).rowCount,
        { timeout: 5000 },
      )
      .toBe(1);
    await database.pool.query(
      "update files set state='quarantined',revision=revision+1 where id=$1",
      [documentId],
    );
    await expect
      .poll(
        async () =>
          (
            await database.pool.query<{ expired: boolean }>(
              "select clock_timestamp()>=$1 as expired",
              [expiry],
            )
          ).rows[0]!.expired,
        { timeout: 5000 },
      )
      .toBe(true);
    await blocker.query("commit");
    const snapshot = await pending;
    expect(new Date(snapshot.assessedAt).getTime()).toBeLessThan(expiry.getTime());
    expect(snapshot.competence).toMatchObject({
      summary: { status: "reviewed" },
      sourceStatus: "available",
    });
    const current = await repository.needExpertiseEvidence(advisor, lead.id);
    expect(current.competence).toMatchObject({
      summary: { status: "expired" },
      sourceStatus: "unavailable",
    });
    expect(new Date(current.assessedAt).getTime()).toBeGreaterThan(
      new Date(snapshot.assessedAt).getTime(),
    );
  } finally {
    await blocker.query("rollback");
    blocker.release();
    if (pending) await pending;
  }
});

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_advisor_assessment_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  const migrationsFolder = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  await migrate(database.db, { migrationsFolder });
  await migrate(database.db, { migrationsFolder });
  repository = createPartnerRepository(database.pool);
  admin = await actor(true);
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});
