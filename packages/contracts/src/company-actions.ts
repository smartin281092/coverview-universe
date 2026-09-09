import { z } from "zod";
import { insuranceCompanyIdSchema } from "./companies.js";
import { managedProfileIdSchema } from "./managed-profiles.js";
import { documentIdSchema, documentReviewGroupSchema } from "./documents.js";

export const companyActionGroupSchema = z.enum([
  "address",
  "phone",
  "contactEmail",
  "firstName",
  "lastName",
  "birthDate",
  "nationality",
  "companyName",
  "registrationNumber",
]);
export const companyActionValuesSchema = z
  .object({
    street: z.string().min(1).max(240).optional(),
    postalCode: z.string().min(1).max(240).optional(),
    city: z.string().min(1).max(240).optional(),
    country: z.string().min(1).max(240).optional(),
    phone: z.string().min(1).max(240).optional(),
    contactEmail: z.string().min(1).max(240).optional(),
    firstName: z.string().min(1).max(240).optional(),
    lastName: z.string().min(1).max(240).optional(),
    birthDate: z.string().min(1).max(240).optional(),
    nationality: z.string().min(1).max(240).optional(),
    companyName: z.string().min(1).max(240).optional(),
    registrationNumber: z.string().min(1).max(240).optional(),
  })
  .strict();
export const companyActionStatusSchema = z.enum([
  "current",
  "unknown",
  "needs_review",
  "needs_notification",
  "requested",
  "in_progress",
  "notified",
  "confirmed",
]);
export const serviceRequestStateSchema = z.enum([
  "requested",
  "in_progress",
  "notified",
  "confirmed",
]);
export const companyEvidenceSchema = z.object({
  kind: z.enum(["notified", "confirmed"]),
  occurredAt: z.iso.datetime(),
  recordedAt: z.iso.datetime(),
  reference: z.string().min(1).max(500),
});
export const companyActionObservationSchema = z.object({
  documentId: z.string().regex(/^doc_[0-9a-f-]{36}$/),
  documentTitle: z.string().max(240),
  values: companyActionValuesSchema,
  ambiguous: z.boolean().default(false),
  recordedAt: z.iso.datetime(),
  documentDate: z.iso.date().nullable(),
});
export const serviceRequestSchema = z.object({
  id: z.uuid(),
  userId: z.string().min(1).max(100),
  profileId: managedProfileIdSchema,
  profileName: z.string().max(160),
  companyId: insuranceCompanyIdSchema,
  group: companyActionGroupSchema,
  values: companyActionValuesSchema,
  profileRevision: z.number().int().nonnegative(),
  revision: z.number().int().nonnegative(),
  state: serviceRequestStateSchema,
  superseded: z.boolean(),
  allowedTransitions: z.array(z.enum(["in_progress", "notified", "confirmed"])).max(3),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  evidence: companyEvidenceSchema.nullable(),
});
export const companyActionSchema = z.object({
  id: z.string().min(1).max(200),
  profileId: managedProfileIdSchema,
  profileName: z.string().max(160),
  profileRevision: z.number().int().nonnegative(),
  companyId: insuranceCompanyIdSchema,
  group: companyActionGroupSchema,
  groupId: companyActionGroupSchema,
  currentValues: companyActionValuesSchema,
  status: companyActionStatusSchema,
  observations: z.array(companyActionObservationSchema).max(200),
  request: serviceRequestSchema.nullable(),
  evidence: companyEvidenceSchema.nullable(),
  canRequest: z.boolean(),
});
export const companyActionsQuerySchema = z
  .object({
    profileId: managedProfileIdSchema.optional(),
    cursor: z.string().max(300).optional(),
    // A document detail requests company statuses only, so its group status cannot
    // be displaced by profile synchronization entries on another page.
    documentId: z
      .string()
      .regex(/^doc_[0-9a-f-]{36}$/)
      .optional(),
  })
  .strict();
export const documentSynchronizationSchema = z.object({
  id: z.string().min(1).max(200),
  documentId: documentIdSchema,
  documentTitle: z.string().max(240),
  profileId: managedProfileIdSchema,
  profileName: z.string().max(160),
  group: documentReviewGroupSchema,
});
export const companyActionsSchema = z
  .object({
    actions: z.array(companyActionSchema).max(20),
    synchronizations: z.array(documentSynchronizationSchema).max(20).default([]),
    nextCursor: z.string().max(300).nullable(),
    incomplete: z.boolean(),
  })
  .refine((value) => value.actions.length + value.synchronizations.length <= 20, {
    message: "Action pages contain at most twenty entries",
  });
export const companyActionRequestInputSchema = z
  .object({
    profileId: managedProfileIdSchema,
    companyId: insuranceCompanyIdSchema,
    group: companyActionGroupSchema,
    profileRevision: z.number().int().nonnegative(),
    values: companyActionValuesSchema,
  })
  .strict();
export const serviceRequestsQuerySchema = z
  .object({
    state: serviceRequestStateSchema.optional(),
    cursor: z.string().max(300).optional(),
  })
  .strict();
export const serviceRequestsSchema = z.object({
  requests: z.array(serviceRequestSchema).max(20),
  nextCursor: z.string().max(300).nullable(),
});
export const serviceRequestTransitionInputSchema = z
  .object({
    userId: z.string().min(1).max(100),
    id: z.uuid(),
    revision: z.number().int().nonnegative(),
    state: z.enum(["in_progress", "notified", "confirmed"]),
    evidence: z
      .object({ occurredAt: z.iso.datetime(), reference: z.string().trim().min(1).max(500) })
      .strict()
      .optional(),
  })
  .strict()
  .refine((input) => (input.state === "in_progress" ? !input.evidence : !!input.evidence), {
    message: "Evidence is required for a completed notification or confirmation",
  });
export type CompanyActionGroup = z.infer<typeof companyActionGroupSchema>;
export type DocumentSynchronization = z.infer<typeof documentSynchronizationSchema>;
export type CompanyActionValues = z.infer<typeof companyActionValuesSchema>;
export type CompanyAction = z.infer<typeof companyActionSchema>;
export type CompanyActionObservation = z.infer<typeof companyActionObservationSchema>;
export type CompanyActionRequestInput = z.infer<typeof companyActionRequestInputSchema>;
export type ServiceRequest = z.infer<typeof serviceRequestSchema>;
export type ServiceRequestTransitionInput = z.infer<typeof serviceRequestTransitionInputSchema>;
