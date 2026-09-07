import { z } from "zod";
import { profileSchema, profileValuesSchema } from "./profile.js";

export const documentIdSchema = z.string().regex(/^doc_[0-9a-f-]{36}$/);
export const documentCategorySchema = z.enum([
  "identity",
  "insurance",
  "pension",
  "invoice",
  "correspondence",
  "unknown",
]);
export const documentStateSchema = z.enum([
  "pending",
  "queued",
  "scanning",
  "reading",
  "ready",
  "failed",
  "quarantined",
  "deleting",
  "deleted",
]);
export const documentFieldSchema = z.enum([
  "firstName",
  "lastName",
  "birthDate",
  "nationality",
  "street",
  "postalCode",
  "city",
  "country",
  "documentNumber",
  "documentType",
  "expiresOn",
]);
export const documentSourceSchema = z.object({
  page: z.number().int().min(1).max(20),
  text: z.string().max(1000),
  method: z.string().min(1).max(100),
  version: z.string().min(1).max(200),
  confidence: z.number().min(0).max(1).nullable(),
  box: z
    .object({
      x: z.number().nonnegative(),
      y: z.number().nonnegative(),
      width: z.number().nonnegative(),
      height: z.number().nonnegative(),
    })
    .nullable(),
});
export const documentExtractionSchema = z.object({
  id: z.string().uuid(),
  field: documentFieldSchema,
  value: z.string().min(1).max(240),
  source: documentSourceSchema,
});
export const documentAnalysisSchema = z.object({
  category: documentCategorySchema,
  evidence: documentSourceSchema.nullable(),
  fields: z.array(documentExtractionSchema).max(40),
  pages: z
    .array(
      z.object({
        page: z.number().int().min(1).max(20),
        text: z.string().max(30000),
        method: z.string().max(100),
        version: z.string().max(200),
      }),
    )
    .max(20),
});
export const documentSummarySchema = z.object({
  id: documentIdSchema,
  name: z.string().max(240),
  mime: z.string().max(160),
  size: z.number().int().nonnegative(),
  checksum: z.string().regex(/^[0-9a-f]{64}$/),
  state: documentStateSchema,
  revision: z.number().int().nonnegative(),
  category: documentCategorySchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  analysisRequested: z.boolean(),
  failure: z.string().max(100).nullable(),
  canRetry: z.boolean(),
  canDownload: z.boolean(),
});
export const documentDecisionSchema = z.object({
  id: z.string(),
  action: z.enum(["category", "review"]),
  at: z.iso.datetime(),
  category: documentCategorySchema.nullable(),
  fields: z
    .array(
      z.object({
        field: documentFieldSchema,
        choice: z.enum(["keep", "use", "correct"]),
        value: z.string().max(240).nullable(),
        source: documentSourceSchema.nullable(),
      }),
    )
    .max(40),
});
export const documentSchema = documentSummarySchema.extend({
  analysis: documentAnalysisSchema.nullable(),
  decisions: z.array(documentDecisionSchema).max(20),
  reviewedValues: z
    .array(z.object({ field: documentFieldSchema, value: z.string().max(240) }))
    .max(11),
});
export const documentListSchema = z.object({
  documents: z.array(documentSummarySchema).max(20),
  nextCursor: z.string().max(200).nullable(),
});
export const documentCreateInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(240)
      .refine((value) =>
        [...value].every(
          (character) => (character.codePointAt(0) ?? 0) >= 32 && character.codePointAt(0) !== 127,
        ),
      ),
    mime: z.string().max(160),
    size: z
      .number()
      .int()
      .min(1)
      .max(20 * 1024 * 1024),
    checksum: z.string().regex(/^[0-9a-f]{64}$/),
    analysisRequested: z.boolean(),
  })
  .strict();
export const documentRevisionSchema = z
  .object({ revision: z.number().int().nonnegative() })
  .strict();
export const documentCategoryInputSchema = documentRevisionSchema
  .extend({ category: documentCategorySchema })
  .strict();
export const documentRetryInputSchema = documentRevisionSchema
  .extend({ analysisRequested: z.boolean() })
  .strict();
export const documentReviewInputSchema = documentRevisionSchema
  .extend({
    profileRevision: z.number().int().nonnegative(),
    concernsMe: z.boolean(),
    decisions: z
      .array(
        z
          .object({
            extractionId: z.uuid(),
            choice: z.enum(["keep", "use", "correct"]),
            value: z.string().trim().min(1).max(240).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(40),
  })
  .strict();
export const documentReviewResultSchema = z.object({
  document: documentSchema,
  profile: profileSchema,
});
export const documentProfileValuesSchema = profileValuesSchema;
export type DocumentSummary = z.infer<typeof documentSummarySchema>;
export type DocumentRecord = z.infer<typeof documentSchema>;
export type DocumentAnalysis = z.infer<typeof documentAnalysisSchema>;
export type DocumentSource = z.infer<typeof documentSourceSchema>;
export type DocumentExtraction = z.infer<typeof documentExtractionSchema>;
export type DocumentReviewInput = z.infer<typeof documentReviewInputSchema>;
export type DocumentCreateInput = z.infer<typeof documentCreateInputSchema>;
export const documentErrorCodes = [
  "DOCUMENT_NOT_FOUND",
  "DOCUMENT_CONFLICT",
  "DOCUMENT_IDEMPOTENCY_REUSED",
  "DOCUMENT_UPLOAD_INVALID",
  "DOCUMENT_STORAGE_UNAVAILABLE",
  "DOCUMENT_DOWNLOAD_BLOCKED",
  "DOCUMENT_REVIEW_INVALID",
  "DOCUMENT_LIMIT_REACHED",
] as const;
