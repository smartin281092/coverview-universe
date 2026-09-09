import { z } from "zod";
import { managedProfileIdSchema } from "./managed-profiles.js";
import texts from "./authorization-texts.json" with { type: "json" };

export const authorizationTexts = texts;
export const authorizationKindSchema = z.enum(["procuration", "mandate"]);
export const authorizationIdSchema = z.string().regex(/^sig_[0-9a-f-]{36}$/);
export const authorizationPointSchema = z.tuple([
  z.number().min(0).max(1),
  z.number().min(0).max(1),
]);
export const authorizationDrawingSchema = z
  .array(z.array(authorizationPointSchema).min(2).max(500))
  .min(1)
  .max(30)
  .refine((strokes) => strokes.flat().length <= 3000, "Signature too large")
  .refine((strokes) => {
    const points = strokes.flat();
    return (
      Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0])) > 0.04 &&
      Math.max(...points.map((p) => p[1])) - Math.min(...points.map((p) => p[1])) > 0.02
    );
  }, "Draw a signature");
export const authorizationDocumentSchema = z.object({
  kind: authorizationKindSchema,
  profileId: managedProfileIdSchema,
  profileName: z.string().max(160),
  profileKind: z.enum(["person", "legal_entity"]),
  profileRevision: z.number().int().nonnegative(),
  version: z.string().max(100),
  title: z.string().max(160),
  organization: z.string().max(400),
  sections: z.array(z.object({ title: z.string().max(200), text: z.string().max(10000) })).max(20),
  values: z.record(z.string().max(100), z.string().max(240)),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  canSign: z.boolean(),
  signatureId: authorizationIdSchema.nullable(),
  signedAt: z.iso.datetime().nullable(),
});
export const authorizationSignInputSchema = z
  .object({
    profileId: managedProfileIdSchema,
    profileRevision: z.number().int().nonnegative(),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
    signerName: z.string().trim().min(2).max(160),
    place: z.string().trim().min(1).max(160),
    accepted: z.literal(true),
    representative: z.boolean(),
    drawing: authorizationDrawingSchema,
  })
  .strict();
export const authorizationReceiptSchema = z.object({
  id: authorizationIdSchema,
  document: authorizationDocumentSchema,
  accepted: z.literal(true),
  signerName: z.string().max(160),
  place: z.string().max(160),
  representative: z.boolean(),
  drawing: authorizationDrawingSchema,
  signedAt: z.iso.datetime(),
  integrityHash: z.string().regex(/^[0-9a-f]{64}$/),
});
export const authorizationStatusSchema = z.object({
  procuration: z.object({
    signedAt: z.iso.datetime().nullable(),
    id: authorizationIdSchema.nullable(),
  }),
  mandate: z.object({
    signedAt: z.iso.datetime().nullable(),
    id: authorizationIdSchema.nullable(),
  }),
});
export type AuthorizationDocument = z.infer<typeof authorizationDocumentSchema>;
export type AuthorizationSignInput = z.infer<typeof authorizationSignInputSchema>;
export type AuthorizationReceipt = z.infer<typeof authorizationReceiptSchema>;
