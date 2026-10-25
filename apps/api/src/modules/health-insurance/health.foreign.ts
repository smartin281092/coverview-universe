import type pg from "pg";
import { z } from "zod";
import {
  healthComparisonSchema,
  healthForeignStatusSchema,
  healthLocalitySchema,
  healthOfferSchema,
  type HealthCompareInput,
} from "@coverview/contracts/health-insurance";
import { healthAgeGroup } from "./health.cost.js";
import { recommendedInsurerIds } from "./health.insurer-groups.js";

const countryName = (code: string) =>
  new Intl.DisplayNames(["fr-CH"], { type: "region" }).of(code) ?? code;
export function foreignLocality(code: string) {
  return healthLocalitySchema.parse({
    id: `hfl_${code}`,
    postalCode: "",
    locality: countryName(code),
    municipality: "",
    municipalityId: null,
    canton: "",
    regionId: `EU-${code}`,
    country: code,
  });
}
export function createHealthForeignRepository(pool: pg.Pool) {
  async function status(year: number) {
    const result = await pool.query<{
      importedAt: Date;
      sourceUrl: string;
      premiumCount: number;
      insurerCount: number;
      countries: string[];
    }>(
      `select d.imported_at as "importedAt",d.source_url as "sourceUrl",count(p.id)::int as "premiumCount",count(distinct p.insurer_id)::int as "insurerCount",array_agg(distinct p.country) as countries from health_foreign_datasets d join health_foreign_premiums p on p.dataset_id=d.id where d.year=$1 and d.active group by d.id`,
      [year],
    );
    const row = result.rows[0];
    return row
      ? healthForeignStatusSchema.parse({
          ...row,
          importedAt: row.importedAt.toISOString(),
          countries: row.countries
            .map((code: string) => ({
              code,
              name: countryName(code),
              locality: foreignLocality(code),
            }))
            .sort((a: { name: string }, b: { name: string }) =>
              a.name.localeCompare(b.name, "fr-CH"),
            ),
        })
      : null;
  }
  async function compare(input: HealthCompareInput, brands: Map<number, string>) {
    const year = input.year ?? 2027,
      age = healthAgeGroup(input.birthYear, year);
    if (input.regionId?.startsWith("EU-") && input.deductible !== (age === "child" ? 0 : 300))
      throw Object.assign(new Error("HEALTH_INVALID_DEDUCTIBLE"), { statusCode: 422 });
    const result = await pool.query(
      `select p.id,concat('hfm_',d.year,'_',p.insurer_id) as "modelId",p.insurer_id as "insurerId",i.name as "insurerName",'Assurance de base UE/AELE/UK' as name,'BASE' as category,concat('EU-',p.country) as "regionId",p.country as "residenceCountry",p.monthly_premium_minor as "monthlyPremiumMinor",p.deductible,p.accident,p.age_group as "ageGroup",false as restricted,'region' as eligibility
      from health_foreign_premiums p join health_foreign_datasets d on d.id=p.dataset_id join health_insurers i on i.id=p.insurer_id
      where d.year=$1 and d.active and p.age_group=$2 and p.age_subgroup=case $2 when 'child' then 'K1' when 'young_adult' then 'J1' else 'E1' end and p.accident=$3
      and (cardinality($4::integer[])=0 or p.insurer_id=any($4))
      order by p.monthly_premium_minor,p.insurer_id,p.id limit 1000`,
      [year, age, input.accident, input.insurerIds ?? []],
    );
    // Swiss pathway/benefit filters never establish foreign eligibility.
    const supported =
      !(input.categories?.length && !input.categories.includes("BASE")) &&
      !input.benefitKeys?.length;
    const rows = supported
      ? z
          .array(healthOfferSchema)
          .parse(result.rows)
          .map((offer) => ({
            ...offer,
            insurerBrand: brands.get(offer.insurerId),
            partner: recommendedInsurerIds.includes(offer.insurerId),
          }))
      : [];
    const countries = new Map<string, typeof rows>();
    for (const row of rows) {
      const country = countries.get(row.regionId) ?? [];
      // The first partner model of each country's list (23 October 2026).
      if (
        recommendedInsurerIds.includes(row.insurerId) &&
        !country.some((offer) => offer.recommended)
      )
        row.recommended = true;
      country.push(row);
      countries.set(row.regionId, country);
    }
    const selected = countries.get(input.regionId ?? "") ?? [],
      offset = input.offset ?? 0;
    return healthComparisonSchema.parse({
      year,
      ageGroup: age,
      regions: [...countries].map(([regionId, offers]) => ({
        regionId,
        offers: offers.slice(0, 3),
      })),
      offers: selected.slice(offset, offset + 15),
      recommendedOffer: selected.find((offer) => offer.recommended) ?? null,
      total: selected.length,
      nextOffset: offset + 15 < selected.length ? offset + 15 : null,
    });
  }
  async function quote(
    input: {
      modelId: string;
      localityId: string;
      birthYear: number;
      accident: boolean;
      deductible: number;
    },
    brands: Map<number, string>,
  ) {
    const model = /^hfm_(\d{4})_(\d+)$/.exec(input.modelId),
      country = /^hfl_([A-Z]{2})$/.exec(input.localityId)?.[1];
    if (!model || model[1] !== "2027" || !country)
      throw Object.assign(new Error("HEALTH_INVALID_LOCATION"), { statusCode: 422 });
    const comparison = await compare(
      {
        year: 2027,
        birthYear: input.birthYear,
        accident: input.accident,
        deductible: input.deductible,
        regionId: `EU-${country}`,
        insurerIds: [Number(model[2])],
      },
      brands,
    );
    const offer = comparison.offers.find(
      (row) => row.modelId === input.modelId && row.deductible === input.deductible,
    );
    if (!offer) throw Object.assign(new Error("HEALTH_MODEL_UNAVAILABLE"), { statusCode: 422 });
    return { offer, locality: foreignLocality(country) };
  }
  return { status, compare, quote };
}
