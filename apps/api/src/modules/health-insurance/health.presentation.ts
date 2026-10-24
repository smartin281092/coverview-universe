import type pg from "pg";
import { z } from "zod";
import { healthOfferSchema } from "@coverview/contracts/health-insurance";
import { recommendedInsurerIds } from "./health.insurer-groups.js";

const modelPresentationSchema = z.object({
  id: z.string(),
  year: z.number().int(),
  access: z.object({
    contacts: healthOfferSchema.shape.firstContacts.unwrap(),
    verifiedYear: z.boolean(),
    ageScope: z.enum(["all", "adult"]).default("all"),
  }),
});
type Model = z.infer<typeof modelPresentationSchema>;
type Offer = z.infer<typeof healthOfferSchema>;

/** OFEV notice, page 1, checked 2026-10-01. No carry-forward to another year.
 * Environmental redistribution only, not an insurer reserve refund or a subsidy.
 * Published premiums and recommendation costs remain gross; this is a separate credit.
 */
export function healthOfferPresentation(offer: Offer, year: number, model?: Model) {
  const swiss = !offer.residenceCountry && !offer.regionId.startsWith("EU-");
  // The ways in the insurer documents for this model (24 October 2026), confirmed for the year
  // or not: contactsVerified tells which, and only confirmed ones reach the recommendation.
  const documented =
    swiss && model?.year === year && (model.access.ageScope === "all" || offer.ageGroup !== "child")
      ? model
      : undefined;
  return {
    firstContacts: documented?.access.contacts ?? [],
    contactsVerified: Boolean(documented?.access.verifiedYear),
    // Every model of a partner insurer carries CoverView's recommendation, said as such.
    partner: recommendedInsurerIds.includes(offer.insurerId),
    redistribution:
      swiss && year === 2027
        ? {
            year,
            monthlyMinor: 475,
            annualMinor: 5700,
            sourceUrl:
              "https://www.sodalis.ch/writable/media/1789710416-Merkblatt_Rueckverteilung_CO2-_und_VOC-Abgaben_2027.pdf",
          }
        : null,
  };
}

export async function loadHealthModelPresentation(pool: pg.Pool, datasetId: string) {
  const result = await pool.query<{ models: unknown }>(
    `select c.data->'models' as models from health_recommendation_catalogs c
     join health_datasets d on d.id=c.dataset_id and d.year=c.year
     where c.dataset_id=$1 order by c.created_at desc,c.id desc limit 1`,
    [datasetId],
  );
  return new Map(
    z
      .array(modelPresentationSchema)
      .parse(result.rows[0]?.models ?? [])
      .map((model) => [model.id, model]),
  );
}
