import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { identityUsers } from "../identity/index.js";
import { partnerLeads, partnerOffers } from "./partner.schema.js";
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
// Advisor-validated recommendation (C4b): one immutable row per version, never rewritten.
export const partnerOfferRecommendations = pgTable(
  "partner_offer_recommendations",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    version: integer("version").notNull(),
    kind: text("kind").notNull(),
    offerId: text("offer_id").references(() => partnerOffers.id),
    offerVersion: integer("offer_version"),
    rationale: text("rationale").notNull(),
    attention: text("attention").notNull().default(""),
    orientationKind: text("orientation_kind").notNull(),
    deviation: boolean("deviation").notNull(),
    deviationReason: text("deviation_reason"),
    basis: text("basis").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => identityUsers.id),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_recommendation_version").on(t.leadId, t.version),
    check(
      "partner_recommendation_shape",
      sql`${t.version}>0 and ${t.kind} in ('offer','keep_current','none') and ((${t.kind}='offer') = (${t.offerId} is not null and ${t.offerVersion} is not null)) and length(trim(${t.rationale})) between 20 and 3000 and length(${t.attention})<=2000 and ${t.orientationKind} in ('insufficient','offer_advantage','keep_current','tradeoff','offers_only') and ${t.deviation} = (${t.deviationReason} is not null and length(trim(${t.deviationReason}))>=20) and ${t.basis} ~ '^[a-f0-9]{64}$'`,
    ),
  ],
);
