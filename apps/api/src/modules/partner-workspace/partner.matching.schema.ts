import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { identityUsers } from "../identity/index.js";
import { partnerLeads } from "./partner.schema.js";
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
// Immutable record of each assignment decision and the ranking it was taken against.
export const partnerMatchingDecisions = pgTable(
  "partner_matching_decisions",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    cycle: integer("cycle").notNull(),
    kind: text("kind").notNull(),
    actorId: text("actor_id").references(() => identityUsers.id),
    systemActor: text("system_actor"),
    chosenUserId: text("chosen_user_id")
      .notNull()
      .references(() => identityUsers.id),
    chosenRank: integer("chosen_rank"),
    topUserId: text("top_user_id").references(() => identityUsers.id),
    deviation: boolean("deviation").notNull(),
    reason: text("reason").notNull(),
    basis: text("basis").notNull(),
    ranking: jsonb("ranking").notNull(),
    excluded: jsonb("excluded").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_matching_lead_history").on(t.leadId, t.createdAt, t.id),
    check(
      "partner_matching_actor",
      sql`(${t.kind}='manual' and ${t.actorId} is not null and ${t.systemActor} is null) or (${t.kind}='automatic' and ${t.actorId} is null and ${t.systemActor}='partner-continuity-v1' and ${t.deviation}=false)`,
    ),
    check(
      "partner_matching_shape",
      sql`${t.cycle}>0 and (${t.chosenRank} is null or ${t.chosenRank} between 1 and 100) and length(trim(${t.reason})) between 1 and 2000 and ${t.basis} ~ '^[a-f0-9]{64}$' and jsonb_typeof(${t.ranking})='array' and jsonb_array_length(${t.ranking})<=10 and jsonb_typeof(${t.excluded})='array'`,
    ),
  ],
);
