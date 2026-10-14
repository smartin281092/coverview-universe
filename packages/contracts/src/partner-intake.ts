import { z } from "zod";

// Orders sent by horizon3.finance from the visitor's browser (14 October 2026). A public contract:
// every field is bounded, unknown fields are ignored, amounts are francs with at most two decimals.
const text = (max: number) => z.string().trim().min(1).max(max);
const francs = z
  .number()
  .min(0)
  .max(100_000_000)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
    "At most two decimals",
  );
export const horizon3ContactSchema = z.object({
  source: z.literal("horizon3"),
  requestId: z.guid(),
  firstName: text(80),
  lastName: text(80),
  email: z.email().max(254),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()./-]{6,40}$/u),
  birthYear: z
    .number()
    .int()
    .min(1900)
    .refine((year) => year <= new Date().getUTCFullYear(), "Birth year in the future"),
  investment: francs,
  frequency: z
    .string()
    .trim()
    .regex(/^[a-z_-]{1,30}$/u),
  initialCapital: francs.nullable().default(null),
  productId: z.number().int().min(0).max(1_000_000).nullable().default(null),
  productName: text(120),
  strategyId: text(60),
  company: text(120),
});
export type Horizon3Contact = z.infer<typeof horizon3ContactSchema>;
// The same answer for a new order and for a retry of the same one.
export const horizon3ContactReceiptSchema = z
  .object({ success: z.literal(true), requestId: z.guid() })
  .strict();
