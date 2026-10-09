import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  evidenceCatalogSchema,
  recommendationAdminStateSchema,
  recommendationPublishSchema,
  recommendationCatalogPublishSchema,
  operatorCaseUpdateSchema,
  operatorCaseSchema,
  type RecommendationInput,
  type EvidenceCatalog,
} from "@coverview/contracts/health-recommendation";
import { healthOfferSchema } from "@coverview/contracts/health-insurance";
import type { createDatabase } from "../../platform/db/database.js";
import { lockProfileActor, type ProfileActor } from "../identity/index.js";
import {
  recommendationCatalogs as catalogs,
  recommendationVersions as versions,
  recommendationReviews as reviews,
  recommendationCommands as commands,
} from "./recommendation.schema.js";
import { defaultRecommendationRules, recommend } from "./recommendation.engine.js";
import { healthAgeGroup, healthDeductibles } from "./health.cost.js";
import { healthInsurerBrands } from "./health.brands.js";
import { healthOfferPresentation } from "./health.presentation.js";
import { legacyBenefitFilterKeys } from "./recommendation.utility.js";
export class RecommendationError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
  ) {
    super(code);
  }
}
const fail = (code: string, status: number): never => {
  throw new RecommendationError(code, status);
};
type Database = ReturnType<typeof createDatabase>;
type Queryable = {
  query: (text: string, values: unknown[]) => Promise<{ rowCount: number | null }>;
};
/** Whether a model is in the year's latest evidence catalogue, so that an offer can name it. */
export async function isCatalogModel(queryable: Queryable, modelId: string, year = 2027) {
  const result = await queryable.query(
    `select 1 from health_recommendation_catalogs where id=(
       select id from health_recommendation_catalogs where year=$1 order by created_at desc, id desc limit 1
     ) and data->'models' @> $2::jsonb`,
    [year, JSON.stringify([{ id: modelId }])],
  );
  return !!result.rowCount;
}
export function validateCatalog(catalog: EvidenceCatalog) {
  const models = new Map(catalog.models.map((model) => [model.id, model]));
  const sources = new Map(catalog.sources.map((source) => [source.id, source]));
  if (
    models.size !== catalog.models.length ||
    sources.size !== catalog.sources.length ||
    new Set(catalog.benefits.map((fact) => fact.id)).size !== catalog.benefits.length
  )
    fail("HEALTH_RECOMMENDATION_INVALID_CATALOG", 422);
  const insurers = new Set(catalog.insurers.map((insurer) => insurer.id));
  for (const model of catalog.models) {
    if (
      model.year !== catalog.year ||
      !insurers.has(model.insurerId) ||
      model.sourceIds.some((id) => !sources.has(id)) ||
      (model.access.verifiedYear &&
        model.category !== "BASE" &&
        model.sourceIds.every((id) => !sources.get(id)?.yearExplicit))
    )
      fail("HEALTH_RECOMMENDATION_INVALID_CATALOG", 422);
  }
  for (const item of [...catalog.benefits, ...catalog.cases]) {
    if (
      item.year !== catalog.year ||
      !insurers.has(item.insurerId) ||
      item.modelIds.some((id) => !models.has(id) || models.get(id)!.insurerId !== item.insurerId) ||
      item.sourceIds.some((id) => !sources.has(id))
    )
      fail("HEALTH_RECOMMENDATION_INVALID_CATALOG", 422);
  }
  // With a taxonomy, every fact belongs to exactly one canonical type of the same family. Keys of
  // the historical compare filters stay reserved to avoid two meanings for one filter.
  const types = new Map(catalog.benefitTypes.map((type) => [type.key, type]));
  if (
    types.size !== catalog.benefitTypes.length ||
    catalog.benefitTypes.some((type) => legacyBenefitFilterKeys.includes(type.key)) ||
    (types.size > 0 &&
      catalog.benefits.some((fact) => types.get(fact.equivalenceGroup)?.family !== fact.category))
  )
    fail("HEALTH_RECOMMENDATION_INVALID_CATALOG", 422);
  for (const fact of catalog.benefits) {
    if (
      fact.verification === "verified" &&
      fact.yearConfirmed &&
      (!fact.validFrom || fact.sourceIds.every((id) => !sources.get(id)?.yearExplicit))
    )
      fail("HEALTH_RECOMMENDATION_INVALID_CATALOG", 422);
    if (
      fact.financial.kind !== "none" &&
      fact.verification === "verified" &&
      fact.sourceIds.every((id) => sources.get(id)?.quality !== "contract")
    )
      fail("HEALTH_RECOMMENDATION_INVALID_CATALOG", 422);
    if (
      fact.telemedicine !== "free_consultation" &&
      /teleconsultation/.test(fact.equivalenceGroup) &&
      fact.financial.kind === "eligible_care_waiver" &&
      fact.financial.copay
    )
      fail("HEALTH_RECOMMENDATION_INVALID_CATALOG", 422);
  }
}
export function createRecommendationRepository(database: Database) {
  const { db, pool } = database;
  async function catalogVersion(id: string) {
    const [row] = await db.select().from(catalogs).where(eq(catalogs.id, id)).limit(1);
    if (!row) fail("HEALTH_RECOMMENDATION_NOT_FOUND", 404);
    const catalog = evidenceCatalogSchema.parse(row!.data);
    const updates = await db.select().from(reviews).where(eq(reviews.catalogId, id)).limit(2000);
    const byId = new Map(updates.map((item) => [item.caseId, operatorCaseSchema.parse(item.data)]));
    return { ...catalog, cases: catalog.cases.map((record) => byId.get(record.id) ?? record) };
  }
  async function state(year: number) {
    const [history, catalogRows, catalogHistory] = await Promise.all([
      db
        .select()
        .from(versions)
        .where(eq(versions.year, year))
        .orderBy(desc(versions.revision))
        .limit(100),
      db
        .select()
        .from(catalogs)
        .where(eq(catalogs.year, year))
        .orderBy(desc(catalogs.createdAt), desc(catalogs.id))
        .limit(1),
      db
        .select({
          id: catalogs.id,
          at: catalogs.createdAt,
          checkedAt: sql<string>`${catalogs.data}->>'checkedAt'`,
          reason: sql<string>`coalesce(${catalogs.data}->'publication'->>'reason', 'Import documentaire local')`,
          actor: sql<string>`coalesce(${catalogs.data}->'publication'->>'actor', 'local_import')`,
        })
        .from(catalogs)
        .where(eq(catalogs.year, year))
        .orderBy(desc(catalogs.createdAt), desc(catalogs.id))
        .limit(100),
    ]);
    const latest = history[0];
    const catalog = catalogRows[0] ? await catalogVersion(catalogRows[0].id) : null;
    const reviewDays =
      latest?.config.researchReviewDays ?? defaultRecommendationRules.researchReviewDays;
    const reviewDates = (catalog?.sources ?? []).map((source) => ({
      id: source.id,
      at: new Date(Date.parse(source.checkedAt) + reviewDays * 86400000).toISOString().slice(0, 10),
    }));
    const today = new Date().toISOString().slice(0, 10);
    return recommendationAdminStateSchema.parse({
      rules: {
        id: latest?.id ?? "default-v1",
        revision: latest?.revision ?? 0,
        config: latest?.config ?? { ...defaultRecommendationRules, year },
      },
      history: history.map((value) => ({
        id: value.id,
        revision: value.revision,
        at: value.createdAt.toISOString(),
        actor: value.actorId ?? "local_import",
        reason: value.reason,
        config: value.config,
      })),
      catalog,
      catalogHistory: catalogHistory.map((version) => ({
        ...version,
        at: version.at.toISOString(),
      })),
      reviewDue: {
        sourceIds: reviewDates.filter((date) => date.at <= today).map((date) => date.id),
        nextAt: reviewDates.map((date) => date.at).sort()[0] ?? null,
      },
    });
  }
  async function offers(input: RecommendationInput, catalog: EvidenceCatalog) {
    const { tariff } = input;
    if (tariff.regionId?.startsWith("EU-")) fail("HEALTH_RECOMMENDATION_INVALID_PROFILE", 422);
    const active = await pool.query(
      "select id from health_datasets where id=$1 and year=$2 and active=true limit 1",
      [catalog.datasetId, tariff.year],
    );
    if (!active.rowCount) fail("HEALTH_RECOMMENDATION_YEAR_MISMATCH", 422);
    if (!tariff.regionId) return [];
    if (tariff.municipalityId) {
      const locality = await pool.query(
        "select l.id from health_localities l join health_regions r on r.id=l.region_key where l.dataset_id=$1 and r.region_id=$2 and l.municipality_id=$3 limit 1",
        [catalog.datasetId, tariff.regionId, tariff.municipalityId],
      );
      if (!locality.rowCount) fail("HEALTH_RECOMMENDATION_INVALID_PROFILE", 422);
    }
    const deductibles = healthDeductibles(tariff.birthYear);
    if (!deductibles.includes(tariff.deductible))
      fail("HEALTH_RECOMMENDATION_INVALID_PROFILE", 422);
    const result = await pool.query(
      `select p.id,p.model_id as "modelId",m.insurer_id as "insurerId",i.name as "insurerName",m.name,m.category,r.region_id as "regionId",p.monthly_premium_minor as "monthlyPremiumMinor",p.deductible,p.accident,p.age_group as "ageGroup",e.restricted,
      case when not e.restricted then 'region' when $6::integer is not null then 'municipality_confirmed' else 'municipality_required' end as eligibility
      from health_premiums p join health_models m on m.id=p.model_id join health_insurers i on i.id=m.insurer_id join health_regions r on r.id=p.region_key join health_eligibility e on e.model_id=m.id and e.region_key=r.id
      where p.dataset_id=$1 and p.age_group=$2 and p.age_subgroup=case $2 when 'child' then 'K1' when 'young_adult' then 'J1' else 'E1' end and p.accident=$3 and p.deductible=any($4::integer[]) and r.region_id=$5 and r.canton not in ('ZE','ZR')
      and ($6::integer is null or not e.restricted or $6=any(e.municipality_ids)) and (cardinality($7::text[])=0 or m.category=any($7)) and (cardinality($8::integer[])=0 or m.insurer_id=any($8)) order by p.monthly_premium_minor,m.insurer_id,m.id,p.id limit 1201`,
      [
        catalog.datasetId,
        healthAgeGroup(tariff.birthYear, tariff.year),
        tariff.accident,
        input.scope === "same_deductible" ? [tariff.deductible] : deductibles,
        tariff.regionId,
        tariff.municipalityId ?? null,
        tariff.categories,
        tariff.insurerIds,
      ],
    );
    if (result.rows.length > 1200) fail("HEALTH_RECOMMENDATION_SCOPE_TOO_LARGE", 422);
    // Benefit filters are evaluated against year-specific evidence; missing facts are not silently false.
    const brands = healthInsurerBrands(catalog.insurers);
    const models = new Map(catalog.models.map((model) => [model.id, model]));
    return z
      .array(healthOfferSchema)
      .parse(result.rows)
      .map((offer) => ({
        ...offer,
        insurerBrand: brands.get(offer.insurerId),
        ...healthOfferPresentation(offer, tariff.year, models.get(offer.modelId)),
      }));
  }
  async function run(
    input: RecommendationInput,
    override?: z.infer<typeof recommendationPublishSchema>["config"],
  ) {
    const current = await state(input.tariff.year);
    const catalog = current.catalog ?? fail("HEALTH_RECOMMENDATION_UNAVAILABLE", 503);
    return recommend(input, {
      offers: await offers(input, catalog),
      catalog,
      rules: override ?? current.rules.config,
      rulesVersion: override ? "admin-simulation" : current.rules.id,
    });
  }
  async function mutate<T>(
    actor: ProfileActor,
    key: string,
    payload: unknown,
    work: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
  ): Promise<T> {
    if (!z.uuid().safeParse(key).success) fail("HEALTH_RECOMMENDATION_INVALID_COMMAND", 400);
    const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    return db.transaction(async (tx) => {
      await lockProfileActor(tx, { ...actor, administratorUserId: actor.userId });
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('health-recommendation-admin',0))`,
      );
      const [previous] = await tx
        .select()
        .from(commands)
        .where(and(eq(commands.actorId, actor.userId), eq(commands.key, key)))
        .limit(1);
      if (previous) {
        if (previous.hash !== hash) fail("HEALTH_RECOMMENDATION_IDEMPOTENCY_REUSED", 422);
        return previous.result as T;
      }
      const result = await work(tx);
      await tx
        .insert(commands)
        .values({ id: `hrc_${randomUUID()}`, actorId: actor.userId, key, hash, result });
      return result;
    });
  }
  // The latest catalogue of a year, parsed once per publication: a new one has a new id.
  const published = new Map<number, { id: string; catalog: EvidenceCatalog }>();
  async function latestCatalog(year: number) {
    const [row] = await db
      .select({ id: catalogs.id })
      .from(catalogs)
      .where(eq(catalogs.year, year))
      .orderBy(desc(catalogs.createdAt), desc(catalogs.id))
      .limit(1);
    if (!row) return null;
    const cached = published.get(year);
    if (cached?.id === row.id) return cached.catalog;
    const [stored] = await db
      .select({ data: catalogs.data })
      .from(catalogs)
      .where(eq(catalogs.id, row.id))
      .limit(1);
    if (!stored) return null;
    const catalog = evidenceCatalogSchema.parse(stored.data);
    published.set(year, { id: row.id, catalog });
    return catalog;
  }
  function evidenceModel(catalog: EvidenceCatalog, model: EvidenceCatalog["models"][number]) {
    const brand = catalog.insurers.find((insurer) => insurer.id === model.insurerId)?.brand;
    return {
      id: model.id,
      insurerId: model.insurerId,
      insurerName: model.insurerName,
      insurerBrand: brand ?? model.insurerName,
      name: model.name,
      category: model.category,
    };
  }
  return {
    state,
    run,
    catalogVersion,
    /** The models an offer can be linked to, by brand then name (public, no personal data). */
    async catalogModels(year: number) {
      const catalog = await latestCatalog(year);
      const models = (catalog?.models ?? []).map((model) => evidenceModel(catalog!, model));
      models.sort(
        (a, b) =>
          a.insurerBrand.localeCompare(b.insurerBrand, "fr") || a.name.localeCompare(b.name, "fr"),
      );
      return { year, models };
    },
    /**
     * One model's facts, as the comparator selects them: the model's own, then its insurer's
     * facts that name no model, with only the types and sources they cite.
     */
    async modelEvidence(year: number, modelId: string) {
      const catalog = await latestCatalog(year);
      const model = catalog?.models.find((item) => item.id === modelId);
      if (!catalog || !model) return null;
      const benefits = catalog.benefits.filter(
        (fact) =>
          fact.modelIds.includes(modelId) ||
          (!fact.modelIds.length && fact.insurerId === model.insurerId),
      );
      const keys = new Set(benefits.map((fact) => fact.equivalenceGroup));
      const sourceIds = new Set(benefits.flatMap((fact) => fact.sourceIds));
      return {
        year,
        model: evidenceModel(catalog, model),
        benefits,
        benefitTypes: catalog.benefitTypes.filter((type) => keys.has(type.key)),
        sources: catalog.sources.filter((source) => sourceIds.has(source.id)),
      };
    },
    async publish(
      input: z.infer<typeof recommendationPublishSchema>,
      actor: ProfileActor,
      key: string,
    ) {
      return mutate(actor, key, { operation: "publish", input }, async (tx) => {
        const [current] = await tx
          .select()
          .from(versions)
          .where(eq(versions.year, input.config.year))
          .orderBy(desc(versions.revision))
          .limit(1);
        if ((current?.revision ?? 0) !== input.expectedRevision)
          fail("HEALTH_RECOMMENDATION_CONFLICT", 409);
        const value = {
          id: `hrv_${randomUUID()}`,
          year: input.config.year,
          revision: input.expectedRevision + 1,
          config: input.config,
          actorId: actor.userId,
          reason: input.reason,
        };
        await tx.insert(versions).values(value);
        return { id: value.id, revision: value.revision };
      });
    },
    async review(
      catalogId: string,
      id: string,
      input: z.infer<typeof operatorCaseUpdateSchema>,
      actor: ProfileActor,
      key: string,
    ) {
      return mutate(actor, key, { operation: "review", catalogId, id, input }, async (tx) => {
        const [catalog] = await tx
          .select()
          .from(catalogs)
          .where(eq(catalogs.id, catalogId))
          .limit(1);
        const [override] = await tx
          .select()
          .from(reviews)
          .where(and(eq(reviews.catalogId, catalogId), eq(reviews.caseId, id)))
          .limit(1);
        const original = catalog?.data.cases.find((record) => record.id === id);
        if (!original) fail("HEALTH_RECOMMENDATION_NOT_FOUND", 404);
        const current = operatorCaseSchema.parse(override?.data ?? original);
        if (current.revision !== input.expectedRevision)
          fail("HEALTH_RECOMMENDATION_CONFLICT", 409);
        const record = operatorCaseSchema.parse({
          ...current,
          status: input.status,
          owner: input.owner,
          revision: current.revision + 1,
          history: [
            ...current.history,
            {
              at: new Date().toISOString(),
              actor: actor.userId,
              action: input.status,
              note: input.note,
            },
          ],
        });
        await tx
          .insert(reviews)
          .values({ id: `hrr_${randomUUID()}`, catalogId, caseId: id, data: record })
          .onConflictDoUpdate({
            target: [reviews.catalogId, reviews.caseId],
            set: { data: record },
          });
        return record;
      });
    },
    async publishCatalog(
      input: z.infer<typeof recommendationCatalogPublishSchema>,
      actor: ProfileActor,
      key: string,
    ) {
      const catalog = input.catalog;
      validateCatalog(catalog);
      return mutate(actor, key, { operation: "catalog", input }, async (tx) => {
        const [current] = await tx
          .select({ id: catalogs.id })
          .from(catalogs)
          .where(eq(catalogs.year, catalog.year))
          .orderBy(desc(catalogs.createdAt), desc(catalogs.id))
          .limit(1);
        if ((current?.id ?? null) !== input.expectedCatalogId)
          fail("HEALTH_RECOMMENDATION_CONFLICT", 409);
        const [exists] = await tx
          .select()
          .from(catalogs)
          .where(eq(catalogs.id, catalog.id))
          .limit(1);
        if (exists) fail("HEALTH_RECOMMENDATION_CONFLICT", 409);
        const inventory = await tx.execute(
          sql`select m.id,m.insurer_id,m.category from health_models m join health_datasets d on d.id=m.dataset_id where d.id=${catalog.datasetId} and d.year=${catalog.year} and d.active=true`,
        );
        if (
          inventory.rows.length !== catalog.models.length ||
          inventory.rows.some(
            (row) =>
              !catalog.models.some(
                (model) =>
                  model.id === row.id &&
                  model.insurerId === row.insurer_id &&
                  model.category === row.category,
              ),
          )
        )
          fail("HEALTH_RECOMMENDATION_INVALID_CATALOG", 422);
        await tx.insert(catalogs).values({
          id: catalog.id,
          year: catalog.year,
          datasetId: catalog.datasetId,
          data: {
            ...catalog,
            publication: {
              at: new Date().toISOString(),
              actor: actor.userId,
              reason: input.reason,
            },
          },
        });
        return { id: catalog.id };
      });
    },
  };
}
