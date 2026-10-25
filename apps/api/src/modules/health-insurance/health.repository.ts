import type pg from "pg";
import { z } from "zod";
import {
  healthCompareInputSchema,
  healthComparisonSchema,
  healthLocalitiesSchema,
  healthStatusSchema,
  healthModelDetailsSchema,
  healthGuideInputSchema,
  healthGuideResultSchema,
  healthOfferSchema,
  healthLocalitySchema,
} from "@coverview/contracts/health-insurance";
import { healthAgeGroup, healthDeductibles, ordinaryAnnualCost } from "./health.cost.js";
import { loadHealthInsurerBrands } from "./health.brands.js";
import {
  benefitTypeSchema,
  evidenceBenefitSchema,
} from "@coverview/contracts/health-recommendation";
import { healthOfferPresentation, loadHealthModelPresentation } from "./health.presentation.js";
import { createHealthForeignRepository, foreignLocality } from "./health.foreign.js";
import { locateCoordinates } from "./health.location.js";
import { recommendedInsurerIds } from "./health.insurer-groups.js";
import { legacyBenefitFilterKeys, offeredWithBase } from "./recommendation.utility.js";

type Input = z.infer<typeof healthCompareInputSchema>;
const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
function invalid(code: string, statusCode = 400): never {
  throw Object.assign(new Error(code), { statusCode });
}

export function createHealthRepository(pool: pg.Pool) {
  const foreign = createHealthForeignRepository(pool);
  async function dataset() {
    const result = await pool.query<{ id: string }>(
      "select id from health_datasets where year=2027 and active=true limit 1",
    );
    return result.rows[0]?.id;
  }
  async function requireDataset() {
    const id = await dataset();
    return id ?? invalid("HEALTH_DATA_UNAVAILABLE", 503);
  }
  async function status() {
    const id = await dataset();
    if (!id)
      return healthStatusSchema.parse({
        available: false,
        year: 2027,
        importedAt: null,
        premiumCount: 0,
        modelCount: 0,
        insurerCount: 0,
        localityCount: 0,
        regions: [],
        insurers: [],
        sources: [],
      });
    const results = await Promise.all([
      pool.query("select imported_at, sources, counts from health_datasets where id=$1", [id]),
      pool.query(
        "select region_id as id,canton,number from health_regions where dataset_id=$1 and canton not in ('ZE','ZR') order by canton,number",
        [id],
      ),
      pool.query(
        "select distinct i.id,i.name from health_insurers i join health_models m on m.insurer_id=i.id where m.dataset_id=$1 order by i.name",
        [id],
      ),
      loadHealthInsurerBrands(pool, id),
      foreign.status(2027),
      latestTaxonomy(id, 2027),
    ]);
    const taxonomy = results[5];
    const header = z
      .object({
        imported_at: z.date(),
        sources: z.array(z.object({ url: z.url(), file: z.string(), sha256: z.string() })),
        counts: z.object({
          premiums: z.number(),
          models: z.number(),
          insurers: z.number(),
          localities: z.number(),
        }),
      })
      .parse(results[0].rows[0]);
    return healthStatusSchema.parse({
      available: true,
      year: 2027,
      importedAt: header.imported_at.toISOString(),
      premiumCount: header.counts.premiums,
      modelCount: header.counts.models,
      insurerCount: header.counts.insurers,
      localityCount: header.counts.localities,
      regions: results[1].rows,
      insurers: results[2].rows
        .map((insurer: { id: number; name: string }) => ({
          ...insurer,
          brand: results[3].get(insurer.id),
        }))
        .sort((a, b) => (a.brand ?? a.name).localeCompare(b.brand ?? b.name, "fr-CH")),
      sources: header.sources,
      foreign: results[4],
      benefitTypes: taxonomy.types
        .filter((type) => ["service", "financial"].includes(type.valuation))
        .map((type) => ({
          key: type.key,
          family: type.family,
          label: type.label,
          description: type.description,
          models: new Set(
            taxonomy.facts
              .filter((fact) => fact.equivalenceGroup === type.key)
              .flatMap((fact) => fact.modelIds),
          ).size,
        }))
        .filter((type) => type.models > 0),
    });
  }
  async function localities(query: string) {
    const result = await pool.query(
      `select l.id,l.postal_code as "postalCode",l.locality,l.municipality,l.municipality_id as "municipalityId",r.canton,r.region_id as "regionId"
      from health_localities l join health_regions r on r.id=l.region_key where l.dataset_id=$1 and l.search_text like $2 escape '\\'
      order by case when l.postal_code=$3 then 0 else 1 end,l.postal_code,l.locality,l.municipality,l.id limit 20`,
      [await requireDataset(), "%" + normalize(query).replace(/[\\%_]/g, "\\$&") + "%", query],
    );
    return healthLocalitiesSchema.parse({ items: result.rows });
  }
  async function locate(input: { latitude: number; longitude: number; accuracy: number }) {
    const located = locateCoordinates(input.latitude, input.longitude, input.accuracy);
    if (!located) return { regionId: null, items: [], approximate: true };
    if (located.country !== "CH")
      return {
        regionId: located.regionId,
        items: [foreignLocality(located.country)],
        approximate: true,
      };
    const rows = await pool.query(
      `select l.id,l.postal_code as "postalCode",l.locality,l.municipality,l.municipality_id as "municipalityId",r.canton,r.region_id as "regionId" from health_localities l join health_regions r on r.id=l.region_key where l.dataset_id=$1 and l.municipality_id=$2 order by l.postal_code,l.locality limit 20`,
      [await requireDataset(), located.municipalityId],
    );
    return {
      regionId: located.regionId,
      items: healthLocalitiesSchema.parse({ items: rows.rows }).items,
      approximate: true,
    };
  }
  async function validateLocation(input: Input, id: string) {
    if (!healthDeductibles(input.birthYear).includes(input.deductible))
      invalid("HEALTH_INVALID_DEDUCTIBLE");
    if (input.municipalityId && !input.regionId) invalid("HEALTH_REGION_REQUIRED");
    if (!input.regionId) return;
    const result = await pool.query(
      `select r.id from health_regions r where r.dataset_id=$1 and r.region_id=$2 and r.canton not in ('ZE','ZR')
      and ($3::integer is null or exists(select 1 from health_localities l where l.region_key=r.id and l.municipality_id=$3)) limit 1`,
      [id, input.regionId, input.municipalityId ?? null],
    );
    if (!result.rowCount) invalid("HEALTH_INVALID_LOCATION");
  }
  // Taxonomy of the latest evidence catalogue of the dataset, with the facts offered with the basic
  // insurance alone (same predicate as the recommendation). Optional key filter limits the transfer.
  async function latestTaxonomy(datasetId: string, year: number, keys: string[] | null = null) {
    const result = await pool.query<{ types: unknown; facts: unknown }>(
      `select coalesce(latest.data->'benefitTypes','[]'::jsonb) as types,
        coalesce((select jsonb_agg(b) from jsonb_array_elements(latest.data->'benefits') b
          where $3::text[] is null or b->>'equivalenceGroup'=any($3)),'[]'::jsonb) as facts
      from (select c.data from health_recommendation_catalogs c where c.dataset_id=$1 and c.year=$2
        order by c.created_at desc,c.id desc limit 1) latest`,
      [datasetId, year, keys],
    );
    return {
      types: z.array(benefitTypeSchema).parse(result.rows[0]?.types ?? []),
      facts: z
        .array(evidenceBenefitSchema)
        .parse(result.rows[0]?.facts ?? [])
        .filter((fact) => offeredWithBase(fact, year)),
    };
  }
  // Canonical benefit types filter: a model is kept only when it offers every requested type with
  // the basic insurance alone. Historical keys keep their stricter `health_benefits` semantics.
  async function benefitTypeModels(datasetId: string, keys: string[], year: number) {
    if (!keys.length) return null;
    const { facts } = await latestTaxonomy(datasetId, year, keys);
    return keys
      .map(
        (key) =>
          new Set(facts.filter((f) => f.equivalenceGroup === key).flatMap((f) => f.modelIds)),
      )
      .reduce((kept, models) => new Set([...kept].filter((model) => models.has(model))));
  }
  async function compare(input: Input, existingDataset?: string) {
    const id = existingDataset ?? (await requireDataset());
    const legacyKeys = input.benefitKeys.filter((key) => legacyBenefitFilterKeys.includes(key));
    const [brands, modelPresentation, typedModels] = await Promise.all([
      loadHealthInsurerBrands(pool, id),
      loadHealthModelPresentation(pool, id),
      benefitTypeModels(
        id,
        input.benefitKeys.filter((key) => !legacyKeys.includes(key)),
        input.year,
      ),
    ]);
    const foreignComparison = await foreign.compare(input, brands);
    const foreignSelected = input.regionId?.startsWith("EU-") ?? false;
    if (!foreignSelected) await validateLocation(input, id);
    const age = healthAgeGroup(input.birthYear);
    const result = await pool.query(
      `with matching as (
      select p.id,p.model_id as "modelId",m.insurer_id as "insurerId",i.name as "insurerName",m.name,m.category,r.region_id as "regionId",
      p.monthly_premium_minor as "monthlyPremiumMinor",p.deductible,p.accident,p.age_group as "ageGroup",e.restricted,
      case when not e.restricted then 'region' when $6::integer is not null and r.region_id=$5 then 'municipality_confirmed' else 'municipality_required' end as eligibility
      from health_premiums p join health_models m on m.id=p.model_id join health_insurers i on i.id=m.insurer_id
      join health_regions r on r.id=p.region_key join health_eligibility e on e.model_id=m.id and e.region_key=r.id
      where p.dataset_id=$1 and p.age_group=$2 and p.age_subgroup=case $2 when 'child' then 'K1' when 'young_adult' then 'J1' else 'E1' end
      and p.accident=$3 and p.deductible=$4 and r.canton not in ('ZE','ZR')
      and ($6::integer is null or r.region_id<>$5 or not e.restricted or $6=any(e.municipality_ids))
      and (cardinality($7::text[])=0 or m.category=any($7)) and (cardinality($8::integer[])=0 or m.insurer_id=any($8))
      and not exists(select 1 from unnest($9::text[]) wanted where not exists (
        select 1 from health_benefits b where b.insurer_id=m.insurer_id and b.tariff_code=m.tariff_code
        and (b.key=wanted or (wanted='breast_screening_deductible_waiver' and b.key='breast_screening_free'))
        and b.active=true and b.kind='model' and b.value=true and b.year_confirmed=true and b.requires_supplementary=false
        and (b.valid_from is null or b.valid_from<='2027-01-01') and (b.valid_until is null or b.valid_until>='2027-12-31')
      ))
      and ($11::text[] is null or m.id=any($11))
    ), ranked as (select *,row_number() over(partition by "regionId" order by "monthlyPremiumMinor","insurerId","modelId",id) as ranking,
      count(*) over(partition by "regionId") as total from matching),
    -- The first partner model of each region's whole list, whatever page is shown (23 October 2026);
    -- the selected region's one is always returned (25 October 2026).
    flagged as (select *,min(ranking) filter (where "insurerId"=any($12::integer[])) over(partition by "regionId") as "recommendedRanking" from ranked)
    select * from flagged where ranking<=3 or ("regionId"=$5 and ((ranking>$10 and ranking<=$10+15) or ranking="recommendedRanking"))
    order by "regionId",ranking limit 166`,
      [
        id,
        age,
        input.accident,
        input.deductible,
        input.regionId ?? null,
        input.municipalityId ?? null,
        input.categories,
        input.insurerIds,
        legacyKeys,
        input.offset,
        typedModels ? [...typedModels] : null,
        recommendedInsurerIds,
      ],
    );
    const rows = z
      .array(
        healthOfferSchema.extend({
          ranking: z.coerce.number(),
          total: z.coerce.number(),
          recommendedRanking: z.coerce.number().nullable(),
        }),
      )
      .parse(result.rows);
    for (const row of rows) {
      if (row.ranking === row.recommendedRanking) row.recommended = true;
      row.insurerBrand = brands.get(row.insurerId);
      Object.assign(
        row,
        healthOfferPresentation(row, input.year, modelPresentation.get(row.modelId)),
      );
    }
    const byRegion = new Map<string, z.infer<typeof healthOfferSchema>[]>();
    for (const row of rows)
      if (row.ranking <= 3) {
        const list = byRegion.get(row.regionId) ?? [];
        list.push(row);
        byRegion.set(row.regionId, list);
      }
    const selected = rows.filter((row) => row.regionId === input.regionId);
    const total = selected[0]?.total ?? 0;
    return healthComparisonSchema.parse({
      year: 2027,
      ageGroup: age,
      regions: [...byRegion]
        .map(([regionId, offers]) => ({ regionId, offers }))
        .concat(foreignComparison.regions),
      offers: foreignSelected
        ? foreignComparison.offers
        : selected.filter((row) => row.ranking > input.offset && row.ranking <= input.offset + 15),
      recommendedOffer: foreignSelected
        ? foreignComparison.recommendedOffer
        : (selected.find((row) => row.recommended) ?? null),
      total: foreignSelected ? foreignComparison.total : total,
      nextOffset: foreignSelected
        ? foreignComparison.nextOffset
        : input.offset + 15 < total
          ? input.offset + 15
          : null,
    });
  }
  async function details(modelId: string) {
    const id = await requireDataset();
    const models = await pool.query(
      'select m.id as "modelId",m.insurer_id as "insurerId",i.name as "insurerName",m.name,m.category,m.tariff_code as "tariffCode" from health_models m join health_insurers i on i.id=m.insurer_id where m.dataset_id=$1 and m.id=$2 limit 1',
      [id, modelId],
    );
    const model = z
      .object({
        modelId: z.string(),
        insurerId: z.number(),
        insurerName: z.string(),
        name: z.string(),
        category: z.string(),
        tariffCode: z.string(),
      })
      .safeParse(models.rows[0]);
    if (!model.success) invalid("HEALTH_MODEL_NOT_FOUND", 404);
    const facts = await pool.query(
      `select id,kind,key,title,description,value,amount_minor as "amountMinor",currency,period,conditions,source_url as "sourceUrl",verified_at as "verifiedAt",valid_from as "validFrom",valid_until as "validUntil",year_confirmed as "yearConfirmed",requires_supplementary as "requiresSupplementary"
      from health_benefits where active=true and insurer_id=$1 and (tariff_code=$2 or tariff_code is null) order by kind desc,title,id limit 100`,
      [model.data.insurerId, model.data.tariffCode],
    );
    return healthModelDetailsSchema.parse({
      ...model.data,
      insurerBrand: (await loadHealthInsurerBrands(pool, id)).get(model.data.insurerId),
      year: 2027,
      benefits: facts.rows,
      coverageStatus: facts.rows.length ? "partial" : "unknown",
      premiumSourceUrl: "https://www.priminfo.admin.ch/fr/downloads/aktuell",
    });
  }
  async function guide(input: z.infer<typeof healthGuideInputSchema>) {
    if (input.regionId?.startsWith("EU-")) invalid("HEALTH_RECOMMENDATION_INVALID_PROFILE", 422);
    const id = await requireDataset();
    const comparisonInput = healthCompareInputSchema.parse(
      Object.fromEntries(
        Object.entries(input).filter(
          ([key]) =>
            ![
              "annualCareMinor",
              "reserveMinor",
              "preferredAccess",
              "objective",
              "answers",
            ].includes(key),
        ),
      ),
    );
    const guidance: string[] = [];
    const answers = input.answers;
    if (answers.doctor === "keep" || answers.doctor === "verify") guidance.push("doctor_network");
    if (answers.treatment === "regular" || answers.treatment === "planned")
      guidance.push("planned_care");
    if (answers.prevention && answers.prevention !== "none") guidance.push("prevention");
    if (answers.medication && answers.medication !== "none") guidance.push("medication");
    if (answers.supplementary && answers.supplementary !== "none") guidance.push("supplementary");
    if (answers.lifestyle && answers.lifestyle !== "none") guidance.push("club");
    if (answers.household === "children" || healthAgeGroup(input.birthYear) === "child")
      guidance.push("family");
    if (answers.household === "maternity") guidance.push("maternity");
    if (!input.accident || answers.employment === "verify" || answers.employment === "not_covered")
      guidance.push("accident");
    if (answers.subsidy === "review" || answers.subsidy === "already") guidance.push("subsidy");
    const access = {
      any: [],
      free: ["BASE"],
      practice: ["PRAXIS"],
      remote: ["TEL_DIG"],
      flexible: ["FLEX"],
    } as const;
    const wanted: readonly string[] = access[input.preferredAccess];
    const categories = input.categories.length
      ? input.categories.filter((x) => !wanted.length || wanted.includes(x))
      : [...wanted];
    if (input.categories.length && wanted.length && !categories.length)
      return healthGuideResultSchema.parse({
        scenarios: [],
        bestDeductible: null,
        careMinor: input.annualCareMinor,
        objective: input.objective,
        guidance,
      });
    const scenarios = [];
    for (const deductible of healthDeductibles(input.birthYear)) {
      const comparison = await compare(
        healthCompareInputSchema.parse({ ...comparisonInput, categories, deductible, offset: 0 }),
        id,
      );
      const offer = comparison.offers[0];
      if (!offer) continue;
      const cost = ordinaryAnnualCost(
        offer.monthlyPremiumMinor,
        deductible,
        input.annualCareMinor,
        comparison.ageGroup === "child",
      );
      scenarios.push({
        offer,
        ...cost,
        reserveSufficient:
          input.reserveMinor === null ? null : input.reserveMinor >= cost.maxOrdinaryCostShareMinor,
      });
    }
    scenarios.sort(
      (a, b) =>
        (input.objective === "premium"
          ? a.annualPremiumMinor - b.annualPremiumMinor
          : a.estimatedAnnualMinor - b.estimatedAnnualMinor) ||
        a.offer.deductible - b.offer.deductible,
    );
    const best = scenarios.find((x) => x.reserveSufficient !== false);
    return healthGuideResultSchema.parse({
      scenarios,
      bestDeductible: best?.offer.deductible ?? null,
      careMinor: input.annualCareMinor,
      objective: input.objective,
      guidance,
    });
  }
  async function quote(input: {
    modelId: string;
    localityId: string;
    birthYear: number;
    accident: boolean;
    deductible: number;
    currentInsurerId?: number | null;
  }) {
    const id = await requireDataset();
    if (input.modelId.startsWith("hfm_")) {
      const brands = await loadHealthInsurerBrands(pool, id);
      const quoted = await foreign.quote(input, brands);
      let currentInsurerName: string | null = null;
      if (input.currentInsurerId) {
        const current = await pool.query<{ name: string }>(
          "select name from health_insurers where id=$1",
          [input.currentInsurerId],
        );
        if (!current.rows[0]) invalid("HEALTH_INVALID_INSURER", 422);
        currentInsurerName = current.rows[0].name;
      }
      return {
        ...quoted,
        currentInsurerName,
        currentInsurerBrand: input.currentInsurerId
          ? brands.get(input.currentInsurerId)
          : undefined,
      };
    }
    if (!healthDeductibles(input.birthYear).includes(input.deductible))
      invalid("HEALTH_INVALID_DEDUCTIBLE");
    const location = await pool.query(
      `select l.id,l.postal_code as "postalCode",l.locality,l.municipality,l.municipality_id as "municipalityId",r.canton,r.region_id as "regionId" from health_localities l join health_regions r on r.id=l.region_key where l.id=$1 and l.dataset_id=$2 limit 1`,
      [input.localityId, id],
    );
    const locality = healthLocalitySchema.safeParse(location.rows[0]);
    if (!locality.success) invalid("HEALTH_INVALID_LOCATION");
    const result = await pool.query(
      `select p.id,p.model_id as "modelId",m.insurer_id as "insurerId",i.name as "insurerName",m.name,m.category,r.region_id as "regionId",p.monthly_premium_minor as "monthlyPremiumMinor",p.deductible,p.accident,p.age_group as "ageGroup",e.restricted,case when e.restricted then 'municipality_confirmed' else 'region' end as eligibility
      from health_premiums p join health_models m on m.id=p.model_id join health_insurers i on i.id=m.insurer_id join health_regions r on r.id=p.region_key join health_eligibility e on e.model_id=m.id and e.region_key=r.id
      where p.dataset_id=$1 and m.id=$2 and r.region_id=$3 and p.age_group=$4 and p.age_subgroup=case $4 when 'child' then 'K1' when 'young_adult' then 'J1' else 'E1' end and p.accident=$5 and p.deductible=$6 and (not e.restricted or $7=any(e.municipality_ids)) limit 1`,
      [
        id,
        input.modelId,
        locality.data.regionId,
        healthAgeGroup(input.birthYear),
        input.accident,
        input.deductible,
        locality.data.municipalityId,
      ],
    );
    const offer = healthOfferSchema.safeParse(result.rows[0]);
    if (!offer.success) invalid("HEALTH_MODEL_UNAVAILABLE", 422);
    const brands = await loadHealthInsurerBrands(pool, id);
    offer.data.insurerBrand = brands.get(offer.data.insurerId);
    offer.data.partner = recommendedInsurerIds.includes(offer.data.insurerId);
    let currentInsurerName: string | null = null;
    if (input.currentInsurerId) {
      const insurer = await pool.query<{ name: string }>(
        "select name from health_insurers where id=$1 limit 1",
        [input.currentInsurerId],
      );
      if (!insurer.rows[0]) invalid("HEALTH_INVALID_INSURER", 422);
      currentInsurerName = insurer.rows[0].name;
    }
    return {
      offer: offer.data,
      locality: locality.data,
      currentInsurerName,
      currentInsurerBrand: input.currentInsurerId ? brands.get(input.currentInsurerId) : undefined,
    };
  }
  return { status, localities, locate, compare, details, guide, quote };
}
