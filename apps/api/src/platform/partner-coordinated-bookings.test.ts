import { cp, mkdir, mkdtemp, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, expect, it } from "vitest";
import {
  leadCreateInputSchema,
  partnerApplicationInputSchema,
  bookingProposalInputSchema,
  coordinatedBookingInputSchema,
} from "@coverview/contracts/partner";
import { createDatabase } from "./db/database.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";
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
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_coordinated_bookings_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  // The incoming journal is protected. Assemble the pending additive migration only in this
  // ignored test catalogue; the normal deployment catalogue deliberately remains untouched.
  const local = resolve(".planning-local");
  await mkdir(local, { recursive: true });
  const migrationsFolder = await mkdtemp(join(local, "booking-proposals-test-"));
  await cp(fileURLToPath(new URL("../../drizzle/", import.meta.url)), migrationsFolder, {
    recursive: true,
  });
  const entrySchema = z.object({
    idx: z.number(),
    version: z.string(),
    when: z.number(),
    tag: z.string(),
    breakpoints: z.boolean(),
  });
  const journal = z
    .object({ entries: z.array(entrySchema) })
    .passthrough()
    .parse(JSON.parse(await readFile(join(migrationsFolder, "meta/_journal.json"), "utf8")));
  for (const name of [
    "0049_partner_need_capacity",
    "0050_partner_need_conflicts",
    "0051_partner_need_expertise",
    "0052_partner_solution_binding",
    "0053_partner_solution_clauses",
    "0054_partner_distribution_review",
    "0055_partner_appointment_links",
    "0056_partner_booking_proposals",
  ]) {
    const pending = fileURLToPath(new URL("../../drizzle-pending/" + name + "/", import.meta.url));
    const entry = entrySchema.parse(
      JSON.parse(await readFile(join(pending, "entry.json"), "utf8")),
    );
    expect(entry.idx).toBe(journal.entries.at(-1)!.idx + 1);
    journal.entries.push(entry);
    await copyFile(join(pending, "migration.sql"), join(migrationsFolder, entry.tag + ".sql"));
    await copyFile(
      join(pending, "snapshot.json"),
      join(migrationsFolder, "meta/" + String(entry.idx).padStart(4, "0") + "_snapshot.json"),
    );
  }
  await writeFile(join(migrationsFolder, "meta/_journal.json"), JSON.stringify(journal));
  await migrate(database.db, { migrationsFolder });
  await migrate(database.db, { migrationsFolder });
  repository = createPartnerRepository(database.pool);
  admin = await actor(true);
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});

async function preference(owner: PartnerActor, id: string, mode: "video" | "phone" = "video") {
  const previous = await repository.advicePreferences(owner, id);
  await repository.confirmAdvicePreferences(
    owner,
    id,
    {
      revision: previous.revision,
      scopeRevision: previous.scopeRevision,
      profileRevision: previous.profileRevision!,
      mode,
      languageCode: null,
      canton: null,
      confirmed: true,
    },
    key(),
  );
}

async function setup(withProfile = false) {
  const person = await professional(),
    owner = { ...(await actor()), wallet: true };
  const profileId = withProfile ? `profile_${key()}` : null;
  if (profileId)
    await database.pool.query(
      "insert into managed_profiles(id,user_id,display_name,kind) values($1,$2,'Sujet isolé','person')",
      [profileId, owner.userId],
    );
  const lead = await assigned(owner, person, profileId);
  await preference(owner, lead.id);
  const availability = await repository.availability(person, person.userId);
  await repository.declareAvailability(
    person,
    person.userId,
    {
      revision: availability.current?.revision ?? 0,
      professionalRevision: availability.professionalRevision,
      modes: ["video", "phone"],
      periods: [
        { kind: "available", startsAt: "2030-06-04T08:00:00Z", endsAt: "2030-06-04T18:00:00Z" },
      ],
      timezone: "Europe/Zurich",
      confirmed: true,
    },
    key(),
  );
  return { person, owner, lead, profileId };
}
type Scenario = Awaited<ReturnType<typeof setup>>;
async function offer(
  s: Scenario,
  starts = ["2030-06-04T10:00:00Z", "2030-06-04T12:00:00Z"],
  expiresAt = new Date(Date.now() + 3600000).toISOString(),
) {
  const slots = [];
  for (const startsAt of starts) {
    const proposal = {
      appointment: {
        startsAt,
        durationMinutes: 60,
        mode: "video" as const,
        location: "Lien convenu isolé",
        timezone: "Europe/Zurich" as const,
      },
      time: { preparationMinutes: 15, travelBeforeMinutes: 0, travelAfterMinutes: 0 },
    };
    const preview = await repository.previewPersonalAppointment(s.person, s.lead.id, proposal);
    expect(preview.canConfirm).toBe(true);
    slots.push({ ...proposal, basis: preview.basis });
  }
  const input = bookingProposalInputSchema.parse({
    slots,
    expiresAt,
    offeredConfirmed: true,
    externalCommitmentsChecked: true,
    capacityConfirmed: true,
    preparationAndTravelChecked: true,
  });
  const commandKey = key();
  const result = await repository.proposeBooking(s.person, s.lead.id, input, commandKey);
  return { input, commandKey, result, id: result.proposals[0]!.id };
}
async function choice(s: Scenario, slot = 0) {
  const view = await repository.bookingProposals(s.owner, s.lead.id),
    proposal = view.proposals[0]!;
  return {
    proposal,
    input: { slot, basis: proposal.slots[slot]!.basis, confirmed: true as const },
  };
}
async function count(leadId: string) {
  return (
    await database.pool.query<{ appointments: number; times: number }>(
      `select
    (select count(*)::int from partner_appointments where lead_id=$1) appointments,
    (select count(*)::int from partner_appointment_time_plans t join partner_appointments a on a.id=t.appointment_id where a.lead_id=$1) times`,
      [leadId],
    )
  ).rows[0];
}

async function pair() {
  const first = await setup(),
    other = await setup();
  const lead = await assigned(first.owner, other.person);
  const second = { ...other, owner: first.owner, lead };
  await preference(first.owner, lead.id);
  await offer(first, ["2030-06-04T10:00:00Z"]);
  await offer(second, ["2030-06-04T12:00:00Z"]);
  const a = await choice(first),
    b = await choice(second);
  const input = coordinatedBookingInputSchema.parse({
    choices: [
      { leadId: first.lead.id, proposalId: a.proposal.id, ...a.input },
      { leadId: second.lead.id, proposalId: b.proposal.id, ...b.input },
    ],
    confirmed: true,
  });
  return { first, second, input };
}
it("reserves two specialists atomically, preserves cycles and work, and replays exact receipt once", async () => {
  const { first, second, input } = await pair(),
    commandKey = key();
  const before = (
    await database.pool.query(
      "select id,notification_cycle,next_action,due_at from partner_leads where id=any($1::text[]) order by id",
      [[first.lead.id, second.lead.id]],
    )
  ).rows;
  const result = await repository.reserveCoordinatedBookings(first.owner, input, commandKey);
  expect(result.items).toHaveLength(2);
  expect(result.items.every((i) => i.proposal.state === "booked")).toBe(true);
  expect(await repository.reserveCoordinatedBookings(first.owner, input, commandKey)).toEqual(
    result,
  );
  for (const s of [first, second])
    expect(await count(s.lead.id)).toEqual({ appointments: 1, times: 1 });
  expect(
    (
      await database.pool.query(
        "select id,notification_cycle,next_action,due_at from partner_leads where id=any($1::text[]) order by id",
        [[first.lead.id, second.lead.id]],
      )
    ).rows,
  ).toEqual(before);
  const evidence = (
    await database.pool.query(
      "select t.evidence from partner_appointment_time_plans t where t.evidence->'booking'->>'coordinationId'=$1",
      [result.id],
    )
  ).rows;
  expect(evidence).toHaveLength(2);
  expect(JSON.stringify(result)).not.toContain("preparationMinutes");
  await expect(
    repository.reserveCoordinatedBookings(
      first.owner,
      { ...input, choices: [...input.choices].reverse() },
      commandKey,
    ),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
});
it("refuses overlap, duplicate requests, missing confirmation and unowned requests without partial reservations", async () => {
  const { first, second, input } = await pair();
  expect(coordinatedBookingInputSchema.safeParse({ ...input, confirmed: false }).success).toBe(
    false,
  );
  expect(
    coordinatedBookingInputSchema.safeParse({
      ...input,
      choices: [input.choices[0], input.choices[0]],
    }).success,
  ).toBe(false);
  await repository.withdrawBooking(
    second.person,
    second.lead.id,
    input.choices[1]!.proposalId,
    { confirmed: true },
    key(),
  );
  await offer(second, ["2030-06-04T10:30:00Z"]);
  const overlap = await choice(second);
  const changed = {
    ...input,
    choices: [
      input.choices[0]!,
      { leadId: second.lead.id, proposalId: overlap.proposal.id, ...overlap.input },
    ],
  };
  await expect(
    repository.reserveCoordinatedBookings(first.owner, changed, key()),
  ).rejects.toMatchObject({ code: "PARTNER_APPOINTMENT_CONFLICT" });
  await expect(
    repository.reserveCoordinatedBookings({ ...(await actor()), wallet: true }, input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  expect(() => repository.reserveCoordinatedBookings(admin, input, key())).toThrow(
    "PARTNER_ACCESS_DENIED",
  );
  for (const s of [first, second])
    expect(await count(s.lead.id)).toEqual({ appointments: 0, times: 0 });
});
it("revalidates the last source and rolls back all changes on a late persistence failure", async () => {
  const { first, second, input } = await pair();
  await database.pool
    .query(`create function coordination_fail() returns trigger language plpgsql as $$ begin
    if new.operation='booking.coordinate:v1' then raise exception 'Isolated coordination failure'; end if; return new; end $$;
    create trigger coordination_fail before insert on partner_commands for each row execute function coordination_fail()`);
  try {
    await expect(repository.reserveCoordinatedBookings(first.owner, input, key())).rejects.toThrow(
      "Isolated coordination failure",
    );
  } finally {
    await database.pool.query(
      "drop trigger coordination_fail on partner_commands; drop function coordination_fail()",
    );
  }
  for (const s of [first, second])
    expect(await count(s.lead.id)).toEqual({ appointments: 0, times: 0 });
  await preference(second.owner, second.lead.id, "phone");
  await expect(
    repository.reserveCoordinatedBookings(first.owner, input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  expect(await count(first.lead.id)).toEqual({ appointments: 0, times: 0 });
});
it("serializes racing batches and rechecks current authorization on exact replay", async () => {
  const { first, second, input } = await pair();
  const keys = [key(), key()];
  const raced = await Promise.allSettled(
    keys.map((k) => repository.reserveCoordinatedBookings(first.owner, input, k)),
  );
  expect(raced.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  for (const s of [first, second])
    expect(await count(s.lead.id)).toEqual({ appointments: 1, times: 1 });
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    first.owner.id,
  ]);
  await expect(
    repository.reserveCoordinatedBookings(
      first.owner,
      input,
      keys[raced.findIndex((r) => r.status === "fulfilled")]!,
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
});
it("expires the whole batch after an actual wait following all appointment writes", async () => {
  const { first, second, input } = await pair();
  // Immutable offers cannot be rewritten, so replace both with a deliberately short real deadline.
  for (const [i, s] of [first, second].entries()) {
    await repository.withdrawBooking(
      s.person,
      s.lead.id,
      input.choices[i]!.proposalId,
      { confirmed: true },
      key(),
    );
    await offer(
      s,
      [i ? "2030-06-04T12:00:00Z" : "2030-06-04T10:00:00Z"],
      new Date(Date.now() + 4000).toISOString(),
    );
    const c = await choice(s);
    input.choices[i] = { leadId: s.lead.id, proposalId: c.proposal.id, ...c.input };
  }
  const blocker = await database.pool.connect();
  await blocker.query("begin; select pg_advisory_xact_lock(554433)");
  await database.pool
    .query(`create function coordination_wait() returns trigger language plpgsql as $$ begin
    if new.operation='booking.coordinate:v1' then perform pg_advisory_xact_lock(554433); end if; return new; end $$;
    create trigger coordination_wait before insert on partner_commands for each row execute function coordination_wait()`);
  const outcome = repository.reserveCoordinatedBookings(first.owner, input, key()).then(
    (value) => ({ value, error: null }),
    (error: unknown) => ({ value: null, error }),
  );
  try {
    let waiting = false;
    for (let i = 0; i < 100; i++) {
      waiting = !!(
        await database.pool.query(
          "select 1 from pg_locks where locktype='advisory' and objid=554433 and not granted",
        )
      ).rowCount;
      if (waiting) break;
      await setTimeout(25);
    }
    expect(waiting).toBe(true);
    await setTimeout(4200);
    await blocker.query("commit");
    expect((await outcome).error).toMatchObject({ code: "PARTNER_CONFLICT" });
    for (const s of [first, second])
      expect(await count(s.lead.id)).toEqual({ appointments: 0, times: 0 });
  } finally {
    await blocker.query("rollback");
    blocker.release();
    await outcome;
    await database.pool.query(
      "drop trigger coordination_wait on partner_commands; drop function coordination_wait()",
    );
  }
});

it("requires one canonical subject and at least two specialists even for demands owned by the same Wallet", async () => {
  const { first, second, input } = await pair(),
    profileId = `prf_${key()}`;
  await database.pool.query(
    "insert into managed_profiles(id,user_id,display_name,kind) values($1,$2,'Autre sujet isolé','person')",
    [profileId, first.owner.userId],
  );
  const lead = await assigned(first.owner, second.person, profileId),
    other = { ...second, lead, profileId };
  await preference(first.owner, lead.id);
  await offer(other, ["2030-06-04T14:00:00Z"]);
  const otherChoice = await choice(other);
  await expect(
    repository.reserveCoordinatedBookings(
      first.owner,
      {
        ...input,
        choices: [
          input.choices[0]!,
          { leadId: lead.id, proposalId: otherChoice.proposal.id, ...otherChoice.input },
        ],
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  const sameLead = await assigned(first.owner, first.person),
    same = { ...first, lead: sameLead };
  await preference(first.owner, sameLead.id);
  await offer(same, ["2030-06-04T14:00:00Z"]);
  const sameChoice = await choice(same);
  await expect(
    repository.reserveCoordinatedBookings(
      first.owner,
      {
        ...input,
        choices: [
          input.choices[0]!,
          { leadId: sameLead.id, proposalId: sameChoice.proposal.id, ...sameChoice.input },
        ],
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  for (const s of [first, second, other, same])
    expect(await count(s.lead.id)).toEqual({ appointments: 0, times: 0 });
});
