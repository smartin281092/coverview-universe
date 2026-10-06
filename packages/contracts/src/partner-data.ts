import { z } from "zod";
import { communicationsSchema } from "./partner-communications.js";
import { conclusionsSchema } from "./partner-conclusion.js";
import { economyCasesSchema, marketMandatesSchema } from "./partner-economy.js";
import { jointParticipationsSchema } from "./partner-joint.js";
import { leadReopeningsSchema } from "./partner-lifecycle.js";
import { matchingCandidateSchema } from "./partner-matching.js";
import { goalsSchema } from "./partner-pilotage.js";
import {
  evaluationSchema,
  profileDossierSchema,
  referrerEvaluationSchema,
} from "./partner-profiles.js";
import { qualityQueueSchema, surveysSchema } from "./partner-quality.js";
import { leadRelationshipsSchema } from "./partner-relationships.js";
import {
  advicePreferencesSchema,
  bookingProposalsSchema,
  capacityDossierSchema,
  competenceDossierSchema,
  conventionDossierSchema,
  finalPoliciesSchema,
  leadCategorySchema,
  leadDetailSchema,
  leadEventSchema,
  leadTaskSchema,
  offerHistorySchema,
  partnerContextSchema,
  partnerNotificationsSchema,
  professionalAvailabilityDossierSchema,
  professionalPracticeDossierSchema,
  referentProfileSchema,
  sharedAppointmentsSchema,
  sharedModesDossierSchema,
} from "./partner.js";

const id = z.string().min(1).max(100),
  instant = z.iso.datetime({ offset: true }),
  count = z.number().int().nonnegative();

// Rights of the people whose data the Partner programme holds (brief I.20, C7). The register and
// the export manifest are versioned facts of the product, never legal text or a validated policy.
export const partnerDataRegisterVersion = "partner-data-register-v1";
export const partnerDataExportVersion = "partner-data-export-v1";

// Matrix v1 (bible.question.006, Partner scope, delegated default of 6 October 2026): a person
// consults and exports alone what their space already shows, plus the contact details, context and
// origin of their own requests. Internal notes and tasks need a complete-access request reviewed by
// CoverView.
export const walletDataCategorySchema = z.enum([
  "requests",
  "contact",
  "appointments",
  "offers",
  "preferences",
  "communications",
  "quality",
  "notifications",
  "internal",
]);
export const professionalDataCategorySchema = z.enum([
  "membership",
  "declarations",
  "profile",
  "evaluations",
  "internal_scores",
  "goals",
  "remunerations",
]);
export type WalletDataCategory = z.infer<typeof walletDataCategorySchema>;
export type ProfessionalDataCategory = z.infer<typeof professionalDataCategorySchema>;
export const dataAccessSchema = z.enum(["self_service", "on_request"]);
export const walletDataAccess: Record<WalletDataCategory, z.infer<typeof dataAccessSchema>> = {
  requests: "self_service",
  contact: "self_service",
  appointments: "self_service",
  offers: "self_service",
  preferences: "self_service",
  communications: "self_service",
  quality: "self_service",
  notifications: "self_service",
  internal: "on_request",
};

// Written into each export, in the language of the file: the person cannot translate a download.
export const dataRegisterSchema = z.object({
  version: z.literal(partnerDataRegisterVersion),
  controller: z.string(),
  entries: z.array(
    z.object({
      category: z.string(),
      access: dataAccessSchema,
      purpose: z.string(),
      recipients: z.string(),
      origin: z.string(),
      retention: z.string(),
    }),
  ),
  automated: z.array(z.string()),
  rights: z.string(),
});

// Proof that an export was produced: author, surface, version and counts, never its content.
export const dataExportProofSchema = z.object({
  id,
  createdAt: instant,
  complete: z.boolean(),
  counts: z.record(z.string(), count),
});
const manifestSchema = z.object({
  version: z.literal(partnerDataExportVersion),
  exportId: id,
  generatedAt: instant,
  surface: z.enum(["wallet", "partner"]),
  complete: z.boolean(),
  counts: z.record(z.string(), count),
  // Sections cut at a bound, and sections that could not be read with the person's current rights.
  truncated: z.array(z.string().max(200)).max(50),
  unavailable: z.array(z.string().max(200)).max(500),
});

export const walletDataContactSchema = z.object({
  email: z.string(),
  phone: z.string(),
  language: z.string(),
  context: z.string(),
  objectReference: z.string(),
  source: z.string(),
  transmissionAuthorized: z.boolean(),
});
export const walletDataRequestSchema = z.object({
  lead: leadDetailSchema,
  contact: walletDataContactSchema,
  offerHistory: offerHistorySchema.nullable(),
  finalPolicies: finalPoliciesSchema.nullable(),
  bookingProposals: bookingProposalsSchema.nullable(),
  sharedAppointments: sharedAppointmentsSchema.nullable(),
  participations: jointParticipationsSchema.nullable(),
  advicePreferences: advicePreferencesSchema.nullable(),
  communications: communicationsSchema.nullable(),
  quality: qualityQueueSchema.nullable(),
  surveys: surveysSchema.nullable(),
  conclusions: conclusionsSchema.nullable(),
  marketMandates: marketMandatesSchema.nullable(),
  relationships: leadRelationshipsSchema.nullable(),
  reopenings: leadReopeningsSchema.nullable(),
  // Only while a complete-access request is granted (C7b).
  internal: z
    .object({
      tasks: z.array(leadTaskSchema).max(100),
      events: z.array(leadEventSchema).max(500),
    })
    .nullable(),
});
export const walletDataExportSchema = z.object({
  manifest: manifestSchema,
  register: dataRegisterSchema,
  requests: z.array(walletDataRequestSchema).max(100),
  referents: z
    .array(referentProfileSchema.omit({ candidates: true, candidatesTruncated: true }))
    .max(100),
  notifications: partnerNotificationsSchema.nullable(),
});
export type WalletDataExport = z.infer<typeof walletDataExportSchema>;

// The person's own line in each stored matching ranking (R5): never the other candidates, the
// request or the decision's free-text reason.
export const matchingAppearanceSchema = z.object({
  id,
  createdAt: instant,
  category: leadCategorySchema,
  kind: z.enum(["manual", "automatic"]),
  rank: z.number().int().min(1).max(100).nullable(),
  first: z.boolean(),
  chosen: z.boolean(),
  criteria: matchingCandidateSchema
    .omit({
      rank: true,
      userId: true,
      name: true,
      organization: true,
      reasons: true,
      caveats: true,
    })
    .nullable(),
});
export const matchingAppearancesSchema = z.object({
  items: z.array(matchingAppearanceSchema).max(100),
  truncated: z.boolean(),
});

export const walletDataSchema = z.object({
  registerVersion: z.literal(partnerDataRegisterVersion),
  exports: z.array(dataExportProofSchema).max(10),
});
export const professionalDataSchema = z.object({
  registerVersion: z.literal(partnerDataRegisterVersion),
  matching: matchingAppearancesSchema,
  referrer: referrerEvaluationSchema.nullable(),
  exports: z.array(dataExportProofSchema).max(10),
});
export type WalletData = z.infer<typeof walletDataSchema>;
export type ProfessionalData = z.infer<typeof professionalDataSchema>;
export type MatchingAppearance = z.infer<typeof matchingAppearanceSchema>;

export const professionalDataExportSchema = z.object({
  manifest: manifestSchema,
  register: dataRegisterSchema,
  context: partnerContextSchema,
  profile: profileDossierSchema.nullable(),
  evaluation: evaluationSchema.nullable(),
  referrer: referrerEvaluationSchema.nullable(),
  matching: matchingAppearancesSchema,
  declarations: z.object({
    competence: z.array(competenceDossierSchema).max(10),
    convention: z.array(conventionDossierSchema).max(50),
    availability: professionalAvailabilityDossierSchema.nullable(),
    practice: professionalPracticeDossierSchema.nullable(),
    capacity: capacityDossierSchema.nullable(),
    sharedModes: sharedModesDossierSchema.nullable(),
  }),
  goals: goalsSchema.nullable(),
  remunerations: economyCasesSchema.nullable(),
});
export type ProfessionalDataExport = z.infer<typeof professionalDataExportSchema>;
