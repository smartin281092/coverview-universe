import { z } from "zod";
import { leadCategorySchema, leadOfferSchema, leadRequestKindSchema } from "./partner.js";

const id = z.string().min(1).max(100);

// The offers the client received, request by request (8 October 2026): Wallet's offers page
// lists them with their document and groups the requests about the same object.
export const walletOffersQuerySchema = z
  .object({ clientProfileId: z.union([z.literal("self"), id]).optional() })
  .strict();
export const walletOffersSchema = z.object({
  items: z
    .array(
      z.object({
        lead: z.object({
          id,
          title: z.string(),
          requestKind: leadRequestKindSchema,
          category: leadCategorySchema,
          object: z.string(),
          clientProfileId: id.nullable(),
        }),
        offers: z.array(leadOfferSchema).max(100),
      }),
    )
    .max(50),
  truncated: z.boolean(),
});
export type WalletOffers = z.infer<typeof walletOffersSchema>;
export type WalletOffersQuery = z.infer<typeof walletOffersQuerySchema>;
