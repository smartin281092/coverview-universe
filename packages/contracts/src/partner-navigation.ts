import { z } from "zod";
import { leadListQuerySchema } from "./partner.js";
export const leadViewFiltersSchema = leadListQuerySchema
  .omit({ cursor: true })
  .extend({ layout: z.enum(["list", "kanban"]).default("kanban") })
  .strict();
export const leadViewInputSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save"),
      id: z.string().min(1).max(100).nullable(),
      revision: z.number().int().nonnegative(),
      name: z.string().trim().min(2).max(60),
      filters: leadViewFiltersSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("remove"),
      id: z.string().min(1).max(100),
      revision: z.number().int().positive(),
    })
    .strict(),
]);
export const leadViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  revision: z.number().int().positive(),
  filters: leadViewFiltersSchema,
  active: z.boolean(),
  updatedAt: z.iso.datetime(),
});
export const leadViewsSchema = z.object({ items: z.array(leadViewSchema).max(20) });
export type LeadViewInput = z.infer<typeof leadViewInputSchema>;
export type LeadView = z.infer<typeof leadViewSchema>;
export type LeadViewFilters = z.infer<typeof leadViewFiltersSchema>;
