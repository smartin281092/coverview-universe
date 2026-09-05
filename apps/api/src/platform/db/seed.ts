import { localPersonasSchema } from "@coverview/contracts";
import { sql } from "drizzle-orm";
import { assertLocalDatabase, type Environment } from "../config.js";
import type { createDatabase } from "./database.js";
import { localPreviewPersonas } from "./schema.js";
import { personas } from "./seed/personas.mjs";

export const localPersonas = localPersonasSchema.parse({ mode: "local-fixture", personas });

export async function seedLocalPersonas(
  config: Environment,
  database: ReturnType<typeof createDatabase>,
) {
  assertLocalDatabase(config);
  if (!config.FIXTURE_MODE) throw new Error("Seeding personas requires FIXTURE_MODE=true");
  await database.db
    .insert(localPreviewPersonas)
    .values(
      localPersonas.personas.map((persona) => ({
        id: persona.id,
        email: persona.email,
        spaceLabel: persona.org,
      })),
    )
    .onConflictDoUpdate({
      target: localPreviewPersonas.id,
      set: { email: sql`excluded.email`, spaceLabel: sql`excluded.space_label` },
    });
}
