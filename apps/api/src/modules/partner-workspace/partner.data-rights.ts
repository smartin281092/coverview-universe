import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import {
  leadCategorySchema,
  leadEventSchema,
  leadListQuerySchema,
  leadTaskSchema,
  partnerNotificationQuerySchema,
} from "@coverview/contracts/partner";
import {
  clientConfirmationSchema,
  qualityPageQuerySchema,
} from "@coverview/contracts/partner-quality";
import {
  dataExportProofSchema,
  matchingAppearancesSchema,
  partnerDataExportVersion,
  partnerDataRegisterVersion,
  professionalDataExportSchema,
  professionalDataSchema,
  walletDataContactSchema,
  walletDataExportSchema,
  walletDataSchema,
  type ProfessionalDataExport,
  type WalletDataExport,
} from "@coverview/contracts/partner-data";
import {
  PartnerError,
  camel,
  date,
  fail,
  failOnConcurrentAbort,
  lockActor,
  visible,
  type PartnerActor,
} from "./partner.policy.js";
import { newId } from "./partner.audit.js";
import { completeAccessSubjects, ownRequests } from "./partner.data-requests.js";
import { professionalRegister, walletRegister } from "./partner.data-register.js";
import type { createPartnerRepository } from "./partner.repository.js";

type Repository = ReturnType<typeof createPartnerRepository>;
type Surface = "wallet" | "partner";
type Collected = { truncated: string[]; unavailable: string[] };

// At most this many requests per export; a larger set is declared truncated, never cut silently.
const LEADS = 100;

// Consultation and export of a person's Partner data (brief I.20, C7a). The export is the sum of
// the reads the person's space already makes, with the same rights at the same time: nothing is
// re-implemented here, so nothing can be shown that the screens would refuse.
export function createDataRightsOperations(pool: Pool, repository: Repository) {
  async function read<T>(actor: PartnerActor, work: (tx: PoolClient) => Promise<T>) {
    const tx = await pool.connect();
    try {
      await tx.query("begin");
      await lockActor(tx, actor);
      const result = await work(tx);
      await tx.query("commit");
      return result;
    } catch (cause) {
      await tx.query("rollback");
      failOnConcurrentAbort(cause);
      throw cause;
    } finally {
      tx.release();
    }
  }
  // A section refused with the person's current rights is declared unavailable; any other failure
  // stops the export rather than handing out an incomplete copy as if it were whole.
  async function section<T>(
    collected: Collected,
    name: string,
    work: () => Promise<T>,
  ): Promise<T | null> {
    try {
      return await work();
    } catch (cause) {
      if (cause instanceof PartnerError) {
        collected.unavailable.push(`${name}:${cause.code}`);
        return null;
      }
      throw cause;
    }
  }
  function cut(collected: Collected, name: string, next: unknown) {
    if (next) collected.truncated.push(name);
  }
  async function proofs(tx: PoolClient, actor: PartnerActor, surface: Surface) {
    const rows = (
      await tx.query<Record<string, unknown>>(
        "select id,created_at,complete,counts from partner_data_exports where user_id=$1 and surface=$2 order by created_at desc,id desc limit 10",
        [actor.userId, surface],
      )
    ).rows;
    return rows.map((row) =>
      dataExportProofSchema.parse({
        id: row.id,
        createdAt: (row.created_at as Date).toISOString(),
        complete: row.complete,
        counts: row.counts,
      }),
    );
  }
  async function prove(
    actor: PartnerActor,
    surface: Surface,
    complete: boolean,
    counts: Record<string, number>,
  ) {
    return read(actor, async (tx) => {
      const id = newId("pdexp");
      const created = (
        await tx.query<{ created_at: Date }>(
          "insert into partner_data_exports(id,user_id,session_id,surface,manifest_version,complete,counts) values($1,$2,$3,$4,$5,$6,$7) returning created_at",
          [
            id,
            actor.userId,
            actor.id,
            surface,
            partnerDataExportVersion,
            complete,
            JSON.stringify(counts),
          ],
        )
      ).rows[0]!;
      return { id, generatedAt: created.created_at.toISOString() };
    });
  }

  // The person's own line in every stored ranking, newest first (R5). Other candidates, the
  // request and the decision's reason stay out.
  async function appearances(tx: PoolClient, userId: string) {
    const rows = (
      await tx.query<Record<string, unknown>>(
        `select d.id,d.created_at,l.category,d.kind,d.chosen_user_id=$1 chosen,d.top_user_id is not distinct from $1 "first",
          case when d.chosen_user_id=$1 then d.chosen_rank end chosen_rank,
          (select r from jsonb_array_elements(d.ranking) r where r->>'userId'=$1 limit 1) entry
         from partner_matching_decisions d join partner_leads l on l.id=d.lead_id
         where d.chosen_user_id=$1 or d.ranking @> jsonb_build_array(jsonb_build_object('userId',$1::text))
         order by d.created_at desc,d.id desc limit 101`,
        [userId],
      )
    ).rows;
    return matchingAppearancesSchema.parse({
      truncated: rows.length > 100,
      items: rows.slice(0, 100).map((row) => {
        const entry = row.entry as Record<string, unknown> | null;
        return {
          id: row.id,
          createdAt: (row.created_at as Date).toISOString(),
          category: leadCategorySchema.parse(row.category),
          kind: row.kind,
          rank: entry ? entry.rank : (row.chosen_rank ?? null),
          first: row.first,
          chosen: row.chosen,
          criteria: entry
            ? {
                competence: entry.competence,
                convention: entry.convention,
                language: entry.language,
                region: entry.region,
                mode: entry.mode,
                availability: entry.availability,
                capacity: entry.capacity,
                referent: entry.referent,
                relationship: entry.relationship,
                activeLeads: entry.activeLeads,
                recentAssignments: entry.recentAssignments,
              }
            : null,
        };
      }),
    });
  }

  // Internal notes, tasks and every audience of the journal, opened only by a granted complete
  // access; read under the same visibility as the request itself.
  async function internalOf(tx: PoolClient, actor: PartnerActor, leadId: string) {
    const seen = `exists(select 1 from partner_leads l where l.id=$2 and (${visible(actor)}))`;
    const tasks = (
      await tx.query<Record<string, unknown>>(
        `select * from partner_tasks t where t.lead_id=$2 and ${seen} order by t.state,t.due_at,t.id limit 101`,
        [actor.userId, leadId],
      )
    ).rows;
    const events = (
      await tx.query<Record<string, unknown>>(
        `select * from partner_events e where e.lead_id=$2 and ${seen} order by e.created_at desc,e.id desc limit 501`,
        [actor.userId, leadId],
      )
    ).rows;
    const contacts = (
      await tx.query<Record<string, unknown>>(
        `select * from partner_client_confirmations c where c.lead_id=$2 and c.owner_id=$1 and c.channel in ('call','email') and c.invalidated_at is null and ${seen} order by c.created_at desc,c.id desc limit 101`,
        [actor.userId, leadId],
      )
    ).rows;
    return {
      truncated: tasks.length > 100 || events.length > 500 || contacts.length > 100,
      qualityContacts: contacts.slice(0, 100).map((row) =>
        clientConfirmationSchema.parse({
          id: row.id,
          channel: row.channel,
          facts: row.facts,
          comment: row.comment,
          createdAt: date(row.created_at as Date),
        }),
      ),
      tasks: tasks.slice(0, 100).map((row) =>
        leadTaskSchema.parse({
          ...camel<Record<string, unknown>>(row),
          dueAt: date(row.due_at as Date),
          reminderAt: date(row.reminder_at as Date | null),
          completedAt: date(row.completed_at as Date | null),
        }),
      ),
      events: events.slice(0, 500).map((row) =>
        leadEventSchema.parse({
          id: row.id,
          subjectId: row.subject_id,
          offer: null,
          responsePending: false,
          kind: row.kind,
          authorId: row.actor_id ?? "system_partner_continuity",
          systemActor: row.system_actor,
          audience: row.audience,
          text: row.text,
          createdAt: date(row.created_at as Date),
        }),
      ),
    };
  }

  async function walletRequests(actor: PartnerActor, collected: Collected) {
    const leads: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await repository.list(
        actor,
        leadListQuerySchema.parse({ limit: LEADS, ...(cursor ? { cursor } : {}) }),
      );
      leads.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor && leads.length < LEADS);
    cut(collected, "requests", cursor || leads.length > LEADS);
    // Subjects whose complete access CoverView granted to this person and is still open (C7b).
    const granted = await read(actor, (tx) => completeAccessSubjects(tx, actor));
    const requests: WalletDataExport["requests"] = [];
    for (const id of leads.slice(0, LEADS)) {
      const name = `requests.${id}`;
      const lead = await section(collected, name, () => repository.detail(actor, id));
      if (!lead) continue;
      const subject = lead.clientProfileId
        ? `profile:${lead.clientProfileId}`
        : `self:${actor.userId}`;
      const internal = granted.has(subject)
        ? await read(actor, (tx) => internalOf(tx, actor, id))
        : null;
      cut(collected, `${name}.internal`, internal?.truncated);
      // The client's own contact details and origin, read under the same visibility as the lead.
      const details = await read(
        actor,
        async (tx) =>
          (
            await tx.query<{ details: unknown }>(
              `select l.details from partner_leads l where l.id=$2 and (${visible(actor)})`,
              [actor.userId, id],
            )
          ).rows[0]?.details,
      );
      if (!details) {
        collected.unavailable.push(`${name}:PARTNER_NOT_FOUND`);
        continue;
      }
      const contact = walletDataContactSchema.parse({
        objectReference: "",
        ...z.record(z.string(), z.unknown()).parse(details),
      });
      const offerHistory = await section(collected, `${name}.offerHistory`, () =>
        repository.offerHistory(actor, id),
      );
      cut(collected, `${name}.offerHistory`, offerHistory?.nextCursor);
      const finalPolicies = await section(collected, `${name}.finalPolicies`, () =>
        repository.finalPolicies(actor, id),
      );
      cut(collected, `${name}.finalPolicies`, finalPolicies?.nextCursor);
      const communications = await section(collected, `${name}.communications`, () =>
        repository.communications(actor, id, {}),
      );
      cut(
        collected,
        `${name}.communications`,
        communications?.nextRecordsCursor || communications?.nextRecordingsCursor,
      );
      const quality = await section(collected, `${name}.quality`, () =>
        repository.qualityQueue(actor, qualityPageQuerySchema.parse({ state: "all" }), id),
      );
      cut(collected, `${name}.quality`, quality?.nextCursor);
      const conclusions = await section(collected, `${name}.conclusions`, () =>
        repository.conclusions(actor, id),
      );
      cut(collected, `${name}.conclusions`, conclusions?.nextCursor);
      const marketMandates = await section(collected, `${name}.marketMandates`, () =>
        repository.marketMandates(actor, id),
      );
      cut(collected, `${name}.marketMandates`, marketMandates?.nextCursor);
      const relationships = await section(collected, `${name}.relationships`, () =>
        repository.leadRelationships(actor, id),
      );
      cut(collected, `${name}.relationships`, relationships?.nextCursor);
      const reopenings = await section(collected, `${name}.reopenings`, () =>
        repository.leadReopenings(actor, id),
      );
      cut(collected, `${name}.reopenings`, reopenings?.nextCursor);
      const surveys = await section(collected, `${name}.surveys`, () =>
        repository.surveys(actor, id),
      );
      cut(collected, `${name}.surveys`, surveys?.nextCursor);
      const confirmations = await section(collected, `${name}.confirmations`, () =>
        repository.walletConfirmations(actor, id),
      );
      cut(collected, `${name}.confirmations`, confirmations?.truncated);
      requests.push({
        lead,
        contact,
        offerHistory,
        finalPolicies,
        bookingProposals: await section(collected, `${name}.bookingProposals`, () =>
          repository.bookingProposals(actor, id),
        ),
        sharedAppointments: await section(collected, `${name}.sharedAppointments`, () =>
          repository.sharedAppointments(actor, id),
        ),
        participations: await section(collected, `${name}.participations`, () =>
          repository.jointParticipations(actor, id),
        ),
        advicePreferences: await section(collected, `${name}.advicePreferences`, () =>
          repository.advicePreferences(actor, id),
        ),
        communications,
        quality,
        surveys,
        confirmations,
        conclusions,
        marketMandates,
        relationships,
        reopenings,
        internal: internal && {
          tasks: internal.tasks,
          events: internal.events,
          qualityContacts: internal.qualityContacts,
        },
      });
    }
    return requests;
  }

  async function walletReferents(actor: PartnerActor, collected: Collected) {
    // Only the subjects this person owns; each read re-checks that ownership itself.
    const pairs = await read(
      actor,
      async (tx) =>
        (
          await tx.query<{ profile_id: string | null; category: string }>(
            `select distinct rs.profile_id,rs.category from partner_referent_selections rs
             where (rs.profile_id is null and rs.self_user_id=$1) or exists(select 1 from managed_profiles mp where mp.id=rs.profile_id and mp.user_id=$1)
             order by rs.profile_id nulls first,rs.category limit 101`,
            [actor.userId],
          )
        ).rows,
    );
    cut(collected, "referents", pairs.length > 100);
    const referents: WalletDataExport["referents"] = [];
    for (const pair of pairs.slice(0, 100)) {
      const profile = await section(
        collected,
        `referents.${pair.profile_id ?? "self"}.${pair.category}`,
        () => repository.referentProfile(actor, pair.profile_id ?? "self", pair.category),
      );
      if (!profile) continue;
      const { candidates, candidatesTruncated, ...own } = profile;
      void candidates;
      void candidatesTruncated;
      referents.push(own);
      cut(
        collected,
        `referents.${pair.profile_id ?? "self"}.${pair.category}`,
        own.nextBeforeRevision,
      );
    }
    return referents;
  }

  return {
    walletData: (actor: PartnerActor) =>
      read(actor, async (tx) => {
        if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
        return walletDataSchema.parse({
          registerVersion: partnerDataRegisterVersion,
          exports: await proofs(tx, actor, "wallet"),
          requests: await ownRequests(tx, actor),
        });
      }),
    async walletExport(actor: PartnerActor): Promise<WalletDataExport> {
      if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
      // The session is checked before any read, not only when the proof is written.
      await read(actor, () => Promise.resolve(null));
      const collected: Collected = { truncated: [], unavailable: [] };
      const requests = await walletRequests(actor, collected);
      const referents = await walletReferents(actor, collected);
      const notifications = await section(collected, "notifications", () =>
        repository.notifications(actor, partnerNotificationQuerySchema.parse({ status: "all" })),
      );
      cut(collected, "notifications", notifications?.nextCursor);
      const counts = {
        requests: requests.length,
        contact: requests.length,
        appointments: requests.reduce((sum, r) => sum + r.lead.appointments.length, 0),
        offers: requests.reduce((sum, r) => sum + r.lead.offers.length, 0),
        preferences: requests.filter((r) => r.advicePreferences?.current).length + referents.length,
        communications: requests.reduce(
          (sum, r) =>
            sum +
            (r.communications?.records.length ?? 0) +
            (r.communications?.recordings.length ?? 0),
          0,
        ),
        quality: requests.reduce(
          (sum, r) =>
            sum +
            (r.quality?.items.length ?? 0) +
            (r.surveys?.items.length ?? 0) +
            (r.confirmations?.items.length ?? 0),
          0,
        ),
        notifications: notifications?.items.length ?? 0,
        internal: requests.reduce(
          (sum, r) =>
            sum +
            (r.internal
              ? r.internal.tasks.length +
                r.internal.events.length +
                r.internal.qualityContacts.length
              : 0),
          0,
        ),
      };
      const complete = requests.some((r) => r.internal);
      const proof = await prove(actor, "wallet", complete, counts);
      return walletDataExportSchema.parse({
        manifest: {
          version: partnerDataExportVersion,
          exportId: proof.id,
          generatedAt: proof.generatedAt,
          surface: "wallet",
          complete,
          counts,
          ...collected,
        },
        register: walletRegister(),
        requests,
        referents,
        notifications,
      });
    },
    async professionalData(actor: PartnerActor) {
      if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
      // Its own transaction locks the session too: it runs before this one, never inside it.
      const referrer = await section({ truncated: [], unavailable: [] }, "referrer", () =>
        repository.referrerEvaluation(actor, actor.userId),
      );
      return read(actor, async (tx) =>
        professionalDataSchema.parse({
          registerVersion: partnerDataRegisterVersion,
          matching: await appearances(tx, actor.userId),
          referrer,
          exports: await proofs(tx, actor, "partner"),
          requests: await ownRequests(tx, actor),
        }),
      );
    },
    async professionalExport(actor: PartnerActor): Promise<ProfessionalDataExport> {
      if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
      await read(actor, () => Promise.resolve(null));
      const collected: Collected = { truncated: [], unavailable: [] };
      const me = actor.userId;
      const context = await repository.context(actor);
      const declared = await read(actor, async (tx) => ({
        competence: (
          await tx.query<{ category: string }>(
            "select distinct category from partner_competence_declarations where user_id=$1 order by category limit 10",
            [me],
          )
        ).rows,
        convention: (
          await tx.query<{ category: string; company_id: string }>(
            "select distinct category,company_id from partner_convention_declarations where user_id=$1 order by category,company_id limit 51",
            [me],
          )
        ).rows,
        matching: await appearances(tx, me),
      }));
      cut(collected, "declarations.convention", declared.convention.length > 50);
      cut(collected, "matching", declared.matching.truncated);
      const competence = [];
      for (const { category } of declared.competence) {
        const dossier = await section(collected, `declarations.competence.${category}`, () =>
          repository.competence(actor, me, category),
        );
        if (dossier) competence.push(dossier);
      }
      const convention = [];
      for (const { category, company_id } of declared.convention.slice(0, 50)) {
        const dossier = await section(
          collected,
          `declarations.convention.${category}.${company_id}`,
          () => repository.convention(actor, me, category, company_id),
        );
        if (dossier) convention.push(dossier);
      }
      const goals = await section(collected, "goals", () =>
        repository.goals(actor, { state: "all" }),
      );
      cut(collected, "goals", goals?.nextCursor);
      const remunerations = await section(collected, "remunerations", () =>
        repository.economyCases(actor),
      );
      cut(collected, "remunerations", remunerations?.nextCursor);
      const decisions =
        (
          await section(collected, "membership.decisions", () =>
            repository.accessDecisions(actor, me),
          )
        )?.items ?? [];
      const result = {
        context,
        decisions,
        profile: await section(collected, "profile", () => repository.profileDossier(actor, me)),
        evaluation: await section(collected, "evaluation", () => repository.evaluation(actor, me)),
        referrer: await section(collected, "referrer", () =>
          repository.referrerEvaluation(actor, me),
        ),
        matching: declared.matching,
        declarations: {
          competence,
          convention,
          availability: await section(collected, "declarations.availability", () =>
            repository.availability(actor, me),
          ),
          practice: await section(collected, "declarations.practice", () =>
            repository.practice(actor, me),
          ),
          capacity: await section(collected, "declarations.capacity", () =>
            repository.capacity(actor, me),
          ),
          sharedModes: await section(collected, "declarations.sharedModes", () =>
            repository.sharedModes(actor, me),
          ),
        },
        goals,
        remunerations,
      };
      const counts = {
        membership: (context.application ? 1 : 0) + decisions.length,
        declarations:
          competence.length +
          convention.length +
          [
            result.declarations.availability,
            result.declarations.practice,
            result.declarations.capacity,
            result.declarations.sharedModes,
          ].filter(Boolean).length,
        profile: result.profile ? 1 : 0,
        evaluations: result.evaluation ? 1 : 0,
        internal_scores: declared.matching.items.length + (result.referrer ? 1 : 0),
        goals: goals?.items.length ?? 0,
        remunerations: remunerations?.items.length ?? 0,
      };
      const proof = await prove(actor, "partner", false, counts);
      return professionalDataExportSchema.parse({
        manifest: {
          version: partnerDataExportVersion,
          exportId: proof.id,
          generatedAt: proof.generatedAt,
          surface: "partner",
          complete: false,
          counts,
          ...collected,
        },
        register: professionalRegister(),
        ...result,
      });
    },
  };
}
