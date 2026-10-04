import type pg from "pg";
import { z } from "zod";

// Brand is presentation metadata. Never merge insurers, models or benefits by brand.
export function healthInsurerBrands(insurers: ReadonlyArray<{ id: number; brand: string }>) {
  return new Map(insurers.map((insurer) => [insurer.id, insurer.brand]));
}

export async function loadHealthInsurerBrands(pool: pg.Pool, datasetId: string) {
  const result = await pool.query<{ insurers: unknown }>(
    `select c.data->'insurers' as insurers from health_recommendation_catalogs c
     join health_datasets d on d.id=c.dataset_id and d.year=c.year
     where c.dataset_id=$1 order by c.created_at desc,c.id desc limit 1`,
    [datasetId],
  );
  const insurers = z
    .array(z.object({ id: z.number().int(), brand: z.string().trim().min(1) }))
    .parse(result.rows[0]?.insurers ?? []);
  return healthInsurerBrands(insurers);
}
