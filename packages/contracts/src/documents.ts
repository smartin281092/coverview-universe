import { z } from "zod";
import { profileSchema, profileValuesSchema, profileFieldSchema } from "./profile.js";
import { insuranceCompanyIdSchema } from "./companies.js";
import { managedProfileIdSchema } from "./managed-profiles.js";

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
  "phone",
  "contactEmail",
  "companyName",
  "registrationNumber",
]);
export const documentClassificationSchema = z.enum([
  "identity",
  "insurance",
  "insurance_offer",
  "insurance_policy",
  "pension",
  "invoice",
  "correspondence",
  "power_of_attorney",
  "management_mandate",
  "unknown",
]);
export const documentListQuerySchema = z
  .object({
    cursor: z.string().max(200).optional(),
    profileId: managedProfileIdSchema.optional(),
    q: z.string().trim().max(120).optional(),
    classification: documentClassificationSchema.optional(),
    group: z.enum(["date", "type"]).optional(),
    sort: z.enum(["newest", "oldest", "title"]).optional(),
  })
  .strict();
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
export const insuranceDomainSchema = z.enum([
  "motor",
  "household",
  "personal_liability",
  "building",
  "legal_protection",
  "health",
  "accident",
  "life",
  "pension_3a",
  "pension_3b",
  "pension",
  "travel",
  "pet",
  "other",
]);
export const insurancePremiumSchema = z.object({
  amountMinor: z.number().int().nonnegative().max(100000000000),
  currency: z.enum(["CHF", "EUR", "USD"]),
  period: z.enum(["month", "quarter", "half_year", "year", "once", "unknown"]),
});
const sourcedTextSchema = z.object({
  value: z.string().min(1).max(240),
  source: documentSourceSchema,
});
export const documentInsuranceSchema = z.object({
  companyId: insuranceCompanyIdSchema.nullable(),
  companySource: documentSourceSchema.nullable(),
  domain: insuranceDomainSchema.nullable(),
  domainSource: documentSourceSchema.nullable(),
  policyNumber: sourcedTextSchema.nullable(),
  insuredSubject: sourcedTextSchema.nullable(),
  startsOn: z.object({ value: z.iso.date(), source: documentSourceSchema }).nullable(),
  endsOn: z.object({ value: z.iso.date(), source: documentSourceSchema }).nullable(),
  premium: insurancePremiumSchema.extend({ source: documentSourceSchema }).nullable(),
});
export const documentAnalysisSchema = z.object({
  category: documentCategorySchema,
  title: z.string().trim().min(1).max(140).nullable().optional(),
  titleSource: documentSourceSchema.nullable().optional(),
  classification: documentClassificationSchema.optional(),
  insurance: documentInsuranceSchema.nullable().optional(),
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
  profileId: managedProfileIdSchema.optional(),
  id: documentIdSchema,
  name: z.string().max(240),
  title: z.string().max(140).nullable().optional(),
  classification: documentClassificationSchema.optional(),
  companyId: insuranceCompanyIdSchema.nullable().optional(),
  insuranceDomain: insuranceDomainSchema.nullable().optional(),
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
export const documentChangeRequestSchema = z.object({
  id: z.uuid(),
  documentId: documentIdSchema,
  extractionId: z.uuid(),
  field: profileFieldSchema,
  previousValue: z.string().max(240),
  requestedValue: z.string().max(240),
  insurer: z.string().trim().min(1).max(160),
  state: z.enum(["prepared", "cancelled"]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const documentChangeRequestsSchema = z.object({
  requests: z.array(documentChangeRequestSchema).max(20),
  nextCursor: z.string().max(200).nullable(),
});
export const documentProfileDifferencesSchema = z.object({
  fields: z
    .array(
      z.object({
        field: profileFieldSchema,
        count: z.number().int().positive(),
        documentId: documentIdSchema,
      }),
    )
    .max(10),
});
export const documentReviewGroupSchema = z.object({
  id: z.string().min(1).max(100),
  labelKey: z.union([z.literal("address"), documentFieldSchema]),
  fields: z
    .array(
      z.object({
        extractionId: z.uuid(),
        field: documentFieldSchema,
        value: z.string().min(1).max(240),
        currentValue: z.string().max(240).nullable(),
      }),
    )
    .min(1)
    .max(15),
  different: z.boolean(),
  canSync: z.boolean(),
  profileRevision: z.number().int().nonnegative(),
});
export const documentSchema = documentSummarySchema.extend({
  reviewGroups: z.array(documentReviewGroupSchema).max(15).optional(),
  profileComparisons: z
    .array(
      z.object({
        extractionId: z.uuid(),
        currentValue: z.string().max(240),
        different: z.boolean(),
      }),
    )
    .max(40)
    .optional(),
  changeRequests: z.array(documentChangeRequestSchema).max(40).optional(),
  analysis: documentAnalysisSchema.nullable(),
  decisions: z.array(documentDecisionSchema).max(20),
  reviewedValues: z
    .array(z.object({ field: documentFieldSchema, value: z.string().max(240) }))
    .max(15),
});
export const documentListSchema = z.object({
  documents: z.array(documentSummarySchema).max(20),
  nextCursor: z.string().max(200).nullable(),
  total: z.number().int().nonnegative().optional(),
});
export const insuranceContractSchema = z.object({
  id: documentIdSchema,
  documentIds: z.array(documentIdSchema).min(1).max(200),
  title: z.string().max(140),
  domain: insuranceDomainSchema.nullable(),
  insuredSubject: z.string().max(240).nullable(),
  policyNumber: z.string().max(240).nullable(),
  startsOn: z.iso.date().nullable(),
  endsOn: z.iso.date().nullable(),
  state: z.enum(["active", "expired", "upcoming", "unknown"]),
  expiresSoon: z.boolean(),
  optimization: z.literal("unknown"),
  premium: insurancePremiumSchema.nullable(),
});
export const insuranceCompanyDetailsSchema = z.object({
  companyId: insuranceCompanyIdSchema,
  documents: z.array(documentSummarySchema).max(200),
  contracts: z.array(insuranceContractSchema).max(200),
  stats: z.object({
    documentCount: z.number().int().nonnegative(),
    contractCount: z.number().int().nonnegative(),
    activeContractCount: z.number().int().nonnegative(),
    expiredContractCount: z.number().int().nonnegative(),
    unknownContractCount: z.number().int().nonnegative(),
    annualPremiumTotals: z
      .array(
        z.object({
          currency: insurancePremiumSchema.shape.currency,
          amountMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
        }),
      )
      .max(3),
    premiumCoverage: z.object({
      included: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
    }),
    incomplete: z.boolean(),
  }),
});
export const documentCreateInputSchema = z
  .object({
    profileId: managedProfileIdSchema.optional(),
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
    // The depositor declares the document's purpose; this never verifies identity.
    purpose: z.literal("identity_card").optional(),
  })
  .strict();
export const documentIdentityDocumentTypeSchema = z.enum([
  "identity_card",
  "passport",
  "residence_permit",
  "unknown",
]);
export type DocumentIdentityDocumentType = z.infer<typeof documentIdentityDocumentTypeSchema>;
export const documentIdentityAttachmentQuerySchema = z
  .object({ profileId: managedProfileIdSchema.optional() })
  .strict();
export const documentIdentityAttachmentSchema = z.object({
  profileId: managedProfileIdSchema.default("self"),
  documentType: documentIdentityDocumentTypeSchema.default("unknown"),
  documentTypeSource: z.enum(["declared", "detected", "unknown"]).default("unknown"),
  backRequired: z.boolean().default(true),
  revision: z.number().int().nonnegative(),
  combined: documentSummarySchema.nullable(),
  front: documentSummarySchema.nullable(),
  back: documentSummarySchema.nullable(),
  status: z.enum(["missing", "incomplete", "processing", "ready", "needs_attention"]),
});
export const documentIdentityAttachmentInputSchema = z
  .object({
    profileId: managedProfileIdSchema.optional(),
    documentType: documentIdentityDocumentTypeSchema.optional(),
    revision: z.number().int().nonnegative(),
    combinedId: documentIdSchema.nullable().optional(),
    frontId: documentIdSchema.nullable().optional(),
    backId: documentIdSchema.nullable().optional(),
  })
  .strict();
export type DocumentIdentityAttachment = z.infer<typeof documentIdentityAttachmentSchema>;
export type DocumentIdentityAttachmentInput = z.infer<typeof documentIdentityAttachmentInputSchema>;
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
    notification: z
      .object({ insurer: z.string().trim().min(1).max(160) })
      .strict()
      .optional(),
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
export const documentFieldReviewInputSchema = documentRevisionSchema
  .extend({
    profileRevision: z.number().int().nonnegative(),
    intent: z.enum(["save", "sync"]),
    values: z
      .array(
        z
          .object({
            extractionId: z.uuid(),
            value: z.string().trim().min(1).max(240),
          })
          .strict(),
      )
      .min(1)
      .max(15),
  })
  .strict();
export type DocumentReviewGroup = z.infer<typeof documentReviewGroupSchema>;
export type DocumentFieldReviewInput = z.infer<typeof documentFieldReviewInputSchema>;
export const documentProfileValuesSchema = profileValuesSchema;
export type DocumentSummary = z.infer<typeof documentSummarySchema>;
export type DocumentRecord = z.infer<typeof documentSchema>;
export type DocumentAnalysis = z.infer<typeof documentAnalysisSchema>;
export type DocumentSource = z.infer<typeof documentSourceSchema>;
export type DocumentExtraction = z.infer<typeof documentExtractionSchema>;
export type DocumentInsurance = z.infer<typeof documentInsuranceSchema>;
export type InsuranceDomain = z.infer<typeof insuranceDomainSchema>;
export type InsuranceContract = z.infer<typeof insuranceContractSchema>;
export type InsuranceCompanyDetails = z.infer<typeof insuranceCompanyDetailsSchema>;
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
  "DOCUMENT_MANDATE_REQUIRED",
  "DOCUMENT_ATTACHMENT_INVALID",
  "DOCUMENT_LIMIT_REACHED",
] as const;
