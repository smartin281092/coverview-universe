import { z } from "zod";
import { leadCategorySchema } from "./partner.js";
const id = z.string().min(1).max(100),
  instant = z.iso.datetime({ offset: true });
export const pilotageMetricSchema = z.enum([
  "new_leads",
  "active_leads",
  "closed_leads",
  "lost_leads",
  "declared_contracts",
  "verified_signatures",
  "contacts",
  "appointments_scheduled",
  "appointments_completed",
  "tasks_completed",
  "tasks_overdue",
  "market_received",
  "market_transmitted",
  "contact_rate",
  "appointment_rate",
  "appointment_offer_rate",
  "offer_signature_rate",
  "transformation_rate",
  "first_contact_days",
  "first_appointment_days",
  "first_offer_days",
  "first_signature_days",
  "cycle_days",
  "stage_days",
  "offers_prepared",
  "offers_presented",
  "offers_per_lead",
  "decisions",
  "offer_open_rate",
  "offer_selection_rate",
  "offer_decision_days",
  "keep_current_rate",
  "satisfaction",
  "survey_responses",
  "on_time_rate",
  "reassignment_rate",
  "complaints",
  "quality_checks",
  "quality_pending",
  "inactive_leads",
  "undocumented_contracts",
  "complete_follow_up_rate",
  "pipeline_minimum",
  "pipeline_maximum",
  "weighted_pipeline_minimum",
  "weighted_pipeline_maximum",
  "confirmed_commission",
  "received_commission",
  "signed_commission",
  "available_commission",
  "reserved_commission",
  "paid_commission",
  "clawback_commission",
  "recovered_commission",
  "disputed_commission",
  "recovery_due_commission",
  "coverview_revenue",
  "proposed_savings",
  "policy_differences",
]);
export function pilotageMetricUnit(metric: z.infer<typeof pilotageMetricSchema>) {
  if (metric.endsWith("_rate")) return "percent" as const;
  if (metric.endsWith("_days")) return "days" as const;
  if (metric === "satisfaction") return "rating" as const;
  if (
    metric.includes("pipeline") ||
    metric.endsWith("_commission") ||
    metric === "coverview_revenue" ||
    metric === "proposed_savings"
  )
    return "chf_minor" as const;
  return "count" as const;
}
export const pilotageScopeSchema = z
  .object({
    kind: z.enum(["self", "individual", "team", "organization", "network"]),
    organizationId: id.nullable(),
    userIds: z.array(id).max(100),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      new Set(v.userIds).size !== v.userIds.length ||
      (v.kind === "individual" && (v.userIds.length !== 1 || v.organizationId !== null)) ||
      (v.kind === "team" && (!v.organizationId || !v.userIds.length)) ||
      (v.kind === "organization" && (!v.organizationId || v.userIds.length)) ||
      (["self", "network"].includes(v.kind) && (v.organizationId || v.userIds.length))
    )
      c.addIssue({ code: "custom", path: ["userIds"] });
  });
export const pilotageFiltersSchema = z
  .object({
    category: leadCategorySchema.optional(),
    source: z.string().trim().max(160).optional(),
    company: z.string().trim().max(160).optional(),
    product: z.string().trim().max(200).optional(),
  })
  .strict();
export const pilotageQuerySchema = pilotageFiltersSchema
  .extend({
    from: instant,
    to: instant,
    scope: z.enum(["self", "individual", "team", "organization", "network"]).default("self"),
    organizationId: id.optional(),
    members: z.string().max(10100).optional(),
  })
  .strict()
  .refine(
    (v) =>
      Date.parse(v.to) > Date.parse(v.from) &&
      Date.parse(v.to) - Date.parse(v.from) <= 3660 * 86400000,
    { path: ["to"] },
  );
export const pilotageSourceQuerySchema = pilotageQuerySchema.safeExtend({
  metric: pilotageMetricSchema,
  cursor: z.string().max(500).optional(),
});
export const pilotageMeasureSchema = z.object({
  metric: pilotageMetricSchema,
  group: z.enum(["activity", "conversion", "offers", "quality", "economy"]),
  unit: z.enum(["count", "percent", "days", "rating", "chf_minor"]),
  basis: z.enum(["flow", "cohort", "snapshot"]),
  value: z.number().nullable(),
  numerator: z.number().nullable(),
  denominator: z.number().int().nonnegative().nullable(),
  population: z.number().int().nonnegative(),
  canInspect: z.boolean(),
  status: z.enum([
    "available",
    "no_observations",
    "source_unavailable",
    "restricted",
    "volume_limit",
  ]),
  reason: z.string().nullable(),
});
export const pilotageSourcesSchema = z.object({
  metric: pilotageMetricSchema,
  items: z.array(
    z.object({
      leadId: id,
      title: z.string(),
      sourceId: id,
      at: instant.nullable(),
      value: z.number().nullable(),
      denominator: z.number().nullable(),
    }),
  ),
  nextCursor: z.string().nullable(),
});
export const pilotageSchema = z.object({
  calculatedAt: instant,
  from: instant,
  to: instant,
  comparisonFrom: instant,
  comparisonTo: instant,
  scope: pilotageScopeSchema,
  leadCount: z.number().int().nonnegative(),
  measures: z.array(pilotageMeasureSchema),
  comparison: z.array(pilotageMeasureSchema),
  breakdowns: z.array(
    z.object({
      dimension: z.enum(["stage", "category", "advisor", "organization", "source", "company"]),
      items: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          count: z.number().int().nonnegative(),
          selected: z.number().int().nonnegative().nullable(),
          selectionRate: z.number().min(0).max(100).nullable(),
        }),
      ),
      truncated: z.boolean(),
    }),
  ),
  network: z
    .object({
      activeOrganizations: z.number().int(),
      activeAdvisors: z.number().int(),
      pendingMembers: z.number().int(),
      suspendedMembers: z.number().int(),
      newMembers: z.number().int(),
    })
    .nullable(),
});
export const pilotageOptionsSchema = z.object({
  canNetwork: z.boolean(),
  canManageOrganization: z.boolean(),
  organizationId: id.nullable(),
  people: z.array(
    z.object({ id, name: z.string(), organizationId: id, organizationName: z.string() }),
  ),
  organizations: z.array(z.object({ id, name: z.string() })),
  sources: z.array(z.string()),
  companies: z.array(z.string()),
  products: z.array(z.string()),
  truncated: z.boolean(),
});
export const goalInputSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    title: z.string().trim().min(5).max(200),
    metric: pilotageMetricSchema,
    scope: pilotageScopeSchema,
    filters: pilotageFiltersSchema,
    from: instant,
    to: instant,
    target: z.number().min(0).max(2_000_000_000),
    direction: z.enum(["at_least", "at_most"]),
    state: z.enum(["active", "archived"]),
    reason: z.string().trim().min(10).max(2000),
    confirmed: z.literal(true),
  })
  .strict()
  .superRefine((v, c) => {
    const unit = pilotageMetricUnit(v.metric);
    if (
      (unit === "chf_minor" || (unit === "count" && v.metric !== "offers_per_lead")) &&
      !Number.isInteger(v.target)
    )
      c.addIssue({ code: "custom", path: ["target"] });
    if (
      Date.parse(v.to) <= Date.parse(v.from) ||
      Date.parse(v.to) - Date.parse(v.from) > 3660 * 86400000
    )
      c.addIssue({ code: "custom", path: ["to"] });
    if (
      (v.metric.endsWith("_rate") && v.target > 100) ||
      (v.metric === "satisfaction" && v.target > 5)
    )
      c.addIssue({ code: "custom", path: ["target"] });
  });
export const goalVersionSchema = z.object({
  revision: z.number().int().positive(),
  input: goalInputSchema,
  authorName: z.string(),
  createdAt: instant,
});
export const goalSchema = z.object({
  id,
  createdAt: instant,
  current: goalVersionSchema,
  actual: pilotageMeasureSchema,
  gap: z.number().nullable(),
  progressPercent: z.number().nullable(),
  attained: z.boolean().nullable(),
  canEdit: z.boolean(),
  history: z.array(goalVersionSchema),
  nextRevision: z.number().int().nullable(),
});
export const goalsSchema = z.object({
  items: z.array(goalSchema.omit({ history: true, nextRevision: true })),
  nextCursor: z.string().nullable(),
});
export const goalsQuerySchema = z
  .object({
    cursor: z.string().max(500).optional(),
    state: z.enum(["active", "archived", "all"]).default("active"),
  })
  .strict();
export type PilotageMetric = z.infer<typeof pilotageMetricSchema>;
export type PilotageScope = z.infer<typeof pilotageScopeSchema>;
export type PilotageQuery = z.infer<typeof pilotageQuerySchema>;
export type PilotageMeasure = z.infer<typeof pilotageMeasureSchema>;
