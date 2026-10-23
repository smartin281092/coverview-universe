import type pg from "pg";
import { z } from "zod";
import {
  healthCurrentOptionsSchema,
  healthCurrentComparisonSchema,
  healthCurrentOfferSchema,
  healthInsurerIdentitySchema,
  healthLocalitiesSchema,
  type HealthCurrentBaseline,
  type HealthCurrentOffer,
  type HealthCurrentOptionsInput,
  type HealthCurrentComparisonInput,
} from "@coverview/contracts/health-insurance";
import { healthAgeGroup, healthDeductibles } from "./health.cost.js";
import { groupeMutuelInsurerIds } from "./health.insurer-groups.js";

// Companies of one group that share regions (20 October 2026): the picker lists Groupe Mutuel's
// insurers as one entry.
const insurerGroups = new Map(groupeMutuelInsurerIds.map((id) => [id, "Groupe Mutuel"]));
// Historical prices never borrow model conditions, brands or tariff codes from the new year.
export function createHealthCurrentRepository(pool: pg.Pool) {
  async function dataset() {
    const result = await pool.query<{ id: string; insurer_identities: unknown }>(
      "select id,insurer_identities from health_datasets where year=2026 and active limit 1",
    );
    return result.rows[0];
  }
  async function localities(query: string) {
    const snapshot = await dataset();
    if (!snapshot) return { items: [] };
    const normalized = query.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    const rows = await pool.query(
      `select l.id,l.postal_code as "postalCode",l.locality,l.municipality,
        l.municipality_id as "municipalityId",r.canton,r.region_id as "regionId"
       from health_localities l join health_regions r on r.id=l.region_key
       where l.dataset_id=$1 and l.search_text like $2 escape '\\'
       order by case when l.postal_code=$3 then 0 else 1 end,l.postal_code,l.locality,l.id limit 20`,
      [snapshot.id, "%" + normalized.replace(/[\\%_]/g, "\\$&") + "%", query],
    );
    return healthLocalitiesSchema.parse({ items: rows.rows });
  }
  async function options(input: HealthCurrentOptionsInput) {
    const ageGroup = healthAgeGroup(input.birthYear, 2026);
    const subgroup = ageGroup === "child" ? "K1" : ageGroup === "young_adult" ? "J1" : "E1";
    const foreign = input.regionId.startsWith("EU-");
    const deductibles = foreign
      ? [ageGroup === "child" ? 0 : 300]
      : healthDeductibles(input.birthYear, 2026);
    const snapshot = await dataset();
    const result: z.infer<typeof healthCurrentOptionsSchema> = {
      year: 2026,
      status: "data_unavailable",
      datasetId: snapshot?.id ?? null,
      regionId: null,
      municipalityId: input.municipalityId ?? null,
      ageGroup,
      deductibles,
      insurers: [],
      offers: [],
    };
    if (!snapshot) return result;
    if (!deductibles.includes(input.deductible))
      return { ...result, status: "invalid_deductible" as const };
    const identities = z
      .array(healthInsurerIdentitySchema)
      .max(100)
      .parse(snapshot.insurer_identities);
    let rows: pg.QueryResult;
    if (foreign) {
      const foreignSnapshot = await pool.query<{ id: string }>(
        "select id from health_foreign_datasets where active and year=2026 limit 1",
      );
      const foreignId = foreignSnapshot.rows[0]?.id;
      if (!foreignId) return result;
      result.datasetId = foreignId;
      result.regionId = input.regionId;
      result.municipalityId = null;
      rows = await pool.query(
        `select p.id,'hfm_2026_'||p.insurer_id as "modelId",p.insurer_id as "insurerId",
          'Assurance de base UE/AELE/UK' as name,'BASE' as category,'EU-'||p.country as "regionId",
          p.country as "residenceCountry",p.monthly_premium_minor as "monthlyPremiumMinor",
          p.deductible,p.accident,p.age_group as "ageGroup",false as restricted,'region' as eligibility,
          'hfm_2027_'||p.insurer_id as "nextModelId"
         from health_foreign_premiums p where p.dataset_id=$1 and p.country=$2 and p.age_group=$3
           and p.age_subgroup=$4 and p.accident=$5 and p.deductible=$6
         order by p.insurer_id,p.id limit 200`,
        [foreignId, input.regionId.slice(3), ageGroup, subgroup, input.accident, input.deductible],
      );
    } else {
      // The same OFS municipality is resolved in the historical table, never in the 2027 map.
      // A missing OFS (e.g. a merger) requires an explicit historical-locality choice.
      const regions = await pool.query<{ id: string; region_id: string }>(
        `select distinct r.id,r.region_id from health_regions r where r.dataset_id=$1
          and r.canton not in ('ZE','ZR') and
          (($3::integer is null and r.region_id=$2) or
           ($3::integer is not null and exists(select 1 from health_localities l
             where l.region_key=r.id and l.dataset_id=$1 and l.municipality_id=$3))) limit 2`,
        [snapshot.id, input.regionId, input.municipalityId ?? null],
      );
      const region = regions.rows[0];
      if (!region || regions.rows.length !== 1)
        return { ...result, status: "location_required" as const };
      result.regionId = region.region_id;
      rows = await pool.query(
        `select p.id,m.id as "modelId",m.insurer_id as "insurerId",m.name,m.category,
          $7::text as "regionId",p.monthly_premium_minor as "monthlyPremiumMinor",
          p.deductible,p.accident,p.age_group as "ageGroup",e.restricted,
          case when not e.restricted then 'region' when $6::integer is null then 'municipality_required'
            else 'municipality_confirmed' end as eligibility,
          (select m27.id from health_models m27
            join health_datasets d27 on d27.id=m27.dataset_id and d27.year=2027 and d27.active
            where m27.insurer_id=m.insurer_id and m27.tariff_code=m.tariff_code
            order by m27.id limit 1) as "nextModelId"
         from health_premiums p join health_models m on m.id=p.model_id and m.dataset_id=p.dataset_id
         join health_eligibility e on e.model_id=m.id and e.region_key=p.region_key
         where p.dataset_id=$1 and p.region_key=$2 and p.age_group=$3 and p.age_subgroup=$4
           and p.accident=$5 and p.deductible=$8
           and ($6::integer is null or not e.restricted or $6=any(e.municipality_ids))
         order by m.insurer_id,m.name,p.id limit 200`,
        [
          snapshot.id,
          region.id,
          ageGroup,
          subgroup,
          input.accident,
          input.municipalityId ?? null,
          region.region_id,
          input.deductible,
        ],
      );
    }
    const identityById = new Map(identities.map((identity) => [identity.id, identity]));
    // An incomplete historical identity is a data error, never replaced with a newer legal entity.
    const offers = rows.rows.map((row: { insurerId: number }) => {
      const identity = identityById.get(row.insurerId);
      if (!identity) throw new Error("HEALTH_HISTORICAL_IDENTITY_MISSING");
      return healthCurrentOfferSchema.parse({
        ...row,
        insurerName: identity.name,
        insurerBrand: identity.brand,
      });
    });
    const insurerIds = new Set(offers.map((offer) => offer.insurerId));
    result.insurers = identities
      .filter((identity) => insurerIds.has(identity.id))
      .map((identity) => {
        const group = insurerGroups.get(identity.id);
        return group ? { ...identity, group } : identity;
      })
      .sort((a, b) => a.brand.localeCompare(b.brand, "fr-CH"));
    result.offers = offers.filter(
      (offer) => input.insurerId === undefined || offer.insurerId === input.insurerId,
    );
    result.status = result.offers.length ? "available" : "model_unavailable";
    return healthCurrentOptionsSchema.parse(result);
  }
  // The current model in 2027 (12 October 2026): model ids change every year, the insurer and its
  // tariff code do not. Its price is read for the person's age in 2027, in the contract's region
  // (its commune resolved in the 2027 regions), with the contract's accident cover and deductible;
  // a child deductible that no longer exists at the new age becomes the ordinary 300 CHF.
  async function baseline2027(
    current: HealthCurrentOffer,
    municipalityId: number | undefined,
    birthYear: number,
  ): Promise<HealthCurrentBaseline | null> {
    const ageGroup = healthAgeGroup(birthYear, 2027);
    const subgroup = ageGroup === "child" ? "K1" : ageGroup === "young_adult" ? "J1" : "E1";
    const foreign = current.regionId.startsWith("EU-");
    const deductibles = foreign
      ? [ageGroup === "child" ? 0 : 300]
      : healthDeductibles(birthYear, 2027);
    const deductible = deductibles.includes(current.deductible)
      ? current.deductible
      : deductibles.includes(300)
        ? 300
        : deductibles[0]!;
    const fields: Pick<HealthCurrentBaseline, "year" | "deductible" | "accident" | "ageGroup"> = {
      year: 2027,
      deductible,
      accident: current.accident,
      ageGroup,
    };
    if (foreign) {
      const row = (
        await pool.query<{ monthly_premium_minor: number }>(
          `select p.monthly_premium_minor from health_foreign_premiums p
           join health_foreign_datasets d on d.id=p.dataset_id and d.year=2027 and d.active
           where p.insurer_id=$1 and p.country=$2 and p.age_group=$3 and p.age_subgroup=$4
             and p.accident=$5 and p.deductible=$6 order by p.id limit 1`,
          [
            current.insurerId,
            current.regionId.slice(3),
            ageGroup,
            subgroup,
            current.accident,
            deductible,
          ],
        )
      ).rows[0];
      return row
        ? {
            ...fields,
            modelId: `hfm_2027_${current.insurerId}`,
            name: current.name,
            monthlyPremiumMinor: row.monthly_premium_minor,
            regionId: current.regionId,
          }
        : null;
    }
    const row = (
      await pool.query<{
        modelId: string;
        name: string;
        monthlyPremiumMinor: number;
        regionId: string;
      }>(
        `select m27.id as "modelId",m27.name,p.monthly_premium_minor as "monthlyPremiumMinor",
           r.region_id as "regionId"
         from health_models m26
         join health_models m27 on m27.insurer_id=m26.insurer_id and m27.tariff_code=m26.tariff_code
         join health_datasets d on d.id=m27.dataset_id and d.year=2027 and d.active
         join health_premiums p on p.model_id=m27.id and p.dataset_id=d.id
         join health_regions r on r.id=p.region_key and r.canton not in ('ZE','ZR')
         join health_eligibility e on e.model_id=m27.id and e.region_key=p.region_key
         where m26.id=$1 and p.age_group=$2 and p.age_subgroup=$3 and p.accident=$4 and p.deductible=$5
           and (($6::integer is null and r.region_id=$7) or ($6::integer is not null and exists(
             select 1 from health_localities l
             where l.region_key=r.id and l.dataset_id=d.id and l.municipality_id=$6)))
           and ($6::integer is null or not e.restricted or $6=any(e.municipality_ids))
         order by p.id limit 1`,
        [
          current.modelId,
          ageGroup,
          subgroup,
          current.accident,
          deductible,
          municipalityId ?? null,
          current.regionId,
        ],
      )
    ).rows[0];
    return row ? { ...fields, ...row } : null;
  }
  async function compare(input: HealthCurrentComparisonInput) {
    const available = await options({ ...input.current, birthYear: input.birthYear });
    const current =
      available.offers.find((offer) => offer.modelId === input.current.modelId) ?? null;
    const result: z.infer<typeof healthCurrentComparisonSchema> = {
      status: available.status,
      current: null,
      currentYear: 2026,
      targetYear: 2027,
      differences: [],
    };
    if (available.status !== "available") return result;
    if (!current) return { ...result, status: "model_unavailable" as const };
    if (current.eligibility === "municipality_required")
      return { ...result, status: "location_required" as const };
    result.current = current;
    // Without a 2027 tariff for the model, its 2026 price stays the reference, said as such.
    const baseline: HealthCurrentBaseline = (await baseline2027(
      current,
      input.current.municipalityId,
      input.birthYear,
    )) ?? {
      year: 2026,
      modelId: current.modelId,
      name: current.name,
      monthlyPremiumMinor: current.monthlyPremiumMinor,
      deductible: current.deductible,
      accident: current.accident,
      ageGroup: current.ageGroup,
      regionId: current.regionId,
    };
    result.baseline = baseline;
    const targetAge = healthAgeGroup(input.birthYear, 2027);
    const subgroup = targetAge === "child" ? "K1" : targetAge === "young_adult" ? "J1" : "E1";
    const targets = await pool.query<{
      id: string;
      monthly_premium_minor: number;
      deductible: number;
      accident: boolean;
      region_id: string;
    }>(
      `select p.id,p.monthly_premium_minor,p.deductible,p.accident,r.region_id from health_premiums p
       join health_datasets d on d.id=p.dataset_id and d.year=2027 and d.active
       join health_regions r on r.id=p.region_key and r.canton not in ('ZE','ZR')
       where p.id=any($1::text[]) and p.age_group=$2 and p.age_subgroup=$3
       union all
       select p.id,p.monthly_premium_minor,p.deductible,p.accident,'EU-'||p.country as region_id
       from health_foreign_premiums p join health_foreign_datasets d on d.id=p.dataset_id and d.year=2027 and d.active
       where p.id=any($1::text[]) and p.age_group=$2 and p.age_subgroup=$3`,
      [input.offerIds, targetAge, subgroup],
    );
    result.differences = targets.rows.map((target) => {
      const saving = baseline.monthlyPremiumMinor - target.monthly_premium_minor;
      return {
        offerId: target.id,
        currentYear: 2026 as const,
        targetYear: 2027 as const,
        baselineYear: baseline.year,
        monthlySavingMinor: saving,
        annualSavingMinor: saving * 12,
        direction:
          saving > 0
            ? ("saving" as const)
            : saving < 0
              ? ("increase" as const)
              : ("equal" as const),
        deductibleChanged: baseline.deductible !== target.deductible,
        accidentChanged: baseline.accident !== target.accident,
        ageGroupChanged: baseline.ageGroup !== targetAge,
        regionChanged: baseline.regionId !== target.region_id,
      };
    });
    return healthCurrentComparisonSchema.parse(result);
  }
  return { options, compare, localities };
}
