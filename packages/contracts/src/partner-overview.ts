import { z } from "zod";
import { leadCategorySchema } from "./partner.js";
import { pilotageMeasureSchema } from "./partner-pilotage.js";

const instant = z.iso.datetime({ offset: true });
const id = z.string().min(1).max(100);
const count = z.number().int().nonnegative();
const rate = z.number().min(0).max(100).nullable();

// CoverView network overview (brief II.14), completing the pilotage measures with absolute
// follow-up counts, reassignments and advisor and partner comparisons. Admin only.
export const adminOverviewQuerySchema = z
  .object({ from: instant, to: instant, category: leadCategorySchema.optional() })
  .strict()
  .refine(
    (v) =>
      Date.parse(v.to) > Date.parse(v.from) &&
      Date.parse(v.to) - Date.parse(v.from) <= 3660 * 86400000,
    { path: ["to"] },
  );
const performance = {
  active: count,
  closed: count,
  contracts: count,
  // Contracts among Leads closed in the period; null without any closure.
  conversionRate: rate,
  overdue: count,
};
export const adminOverviewSchema = z.object({
  from: instant,
  to: instant,
  // Current state, whatever the period.
  followUp: z.object({
    active: count,
    noNextAction: count,
    firstActionOverdue: count,
    overdue: count,
    unassigned: count,
    coverviewQueue: count,
  }),
  // Traced assignment decisions in the period (since the explained matching).
  reassignments: z.object({ manual: count, automatic: count }),
  advisors: z
    .array(
      z.object({
        userId: id,
        name: z.string(),
        organizationId: id,
        organization: z.string(),
        ...performance,
        // Days from creation to a closure with contract, in the period.
        cycleDays: z.number().nonnegative().nullable(),
        responses: count,
        // Shown only from 5 responses, like the public rating.
        satisfaction: z.number().min(1).max(5).nullable(),
      }),
    )
    .max(100),
  organizations: z
    .array(z.object({ organizationId: id, name: z.string(), advisors: count, ...performance }))
    .max(100),
  // Brief I.21 (C6c): CoverView's share of recorded receipts, from the same ledger replay as the
  // statistics, network-wide and per branch. No cost of qualification, handling, control or
  // follow-up is recorded anywhere: profitability is never computed, never shown as zero.
  coverview: z.object({
    revenue: pilotageMeasureSchema,
    branches: z.array(pilotageMeasureSchema.extend({ category: leadCategorySchema })).max(20),
    costs: z.literal("unrecorded"),
  }),
  truncated: z.boolean(),
});
export type AdminOverviewQuery = z.infer<typeof adminOverviewQuerySchema>;
export type AdminOverview = z.infer<typeof adminOverviewSchema>;
