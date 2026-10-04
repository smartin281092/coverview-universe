import { assertLocalDatabase, loadEnvironment } from "../../platform/config.js";
import { createDatabase } from "../../platform/db/database.js";
const config = loadEnvironment();
assertLocalDatabase(config);
const database = createDatabase(config);
try {
  if (process.argv.includes("--migration-state")) {
    const migrations = await database.pool.query(
      "select id,created_at,hash from drizzle.__drizzle_migrations order by created_at desc limit 3",
    );
    const columns = await database.pool.query(
      "select column_name from information_schema.columns where table_name='health_datasets'",
    );
    process.stdout.write(
      JSON.stringify({ migrations: migrations.rows, columns: columns.rows }) + "\n",
    );
  }
  const snapshots = await database.pool.query(
    `select year,id,active,counts from health_datasets order by year,id`,
  );
  const foreign = await database.pool.query(
    `select d.year,d.id,d.active,count(p.id)::integer as premiums from health_foreign_datasets d left join health_foreign_premiums p on p.dataset_id=d.id group by d.id order by d.year,d.id`,
  );
  const preserved = await database.pool.query<{
    benefits: string;
    models_2027: string;
    insurers_2027: string;
  }>(`select
    (select md5(string_agg(row_to_json(b)::text,'' order by id)) from health_benefits b) as benefits,
    (select md5(string_agg(row_to_json(m)::text,'' order by m.id)) from health_models m join health_datasets d on d.id=m.dataset_id where d.year=2027) as models_2027,
    (select md5(string_agg(row_to_json(i)::text,'' order by i.id)) from health_insurers i where exists(select 1 from health_models m join health_datasets d on d.id=m.dataset_id where d.year=2027 and m.insurer_id=i.id)) as insurers_2027`);
  process.stdout.write(
    JSON.stringify({
      snapshots: snapshots.rows,
      foreign: foreign.rows,
      preserved: preserved.rows[0],
    }) + "\n",
  );
} finally {
  await database.pool.end();
}
