import { z } from "zod";
import { authorizationDrawingSchema } from "./authorizations.js";
import { leadOfferSchema } from "./partner.js";

const id = z.string().min(1).max(100);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const revision = z.number().int().nonnegative();
const citation = z
  .object({
    page: z.number().int().min(1).max(200),
    quote: z.string().trim().min(5).max(2000),
  })
  .strict();
export const conclusionPrepareSchema = z
  .object({
    leadRevision: revision,
    offerId: id,
    sourceFingerprint: hash,
    validUntil: z.iso.datetime({ offset: true }),
    procedure: citation,
    explanation: z.string().trim().min(10).max(2000),
    reviewedApplicability: z.literal(true),
  })
  .strict();
export const conclusionSignSchema = z
  .object({
    contentHash: hash,
    signerName: z.string().trim().min(2).max(160),
    place: z.string().trim().min(1).max(160),
    representative: z.boolean(),
    originalRead: z.literal(true),
    accepted: z.literal(true),
    drawing: authorizationDrawingSchema,
  })
  .strict();
export const conclusionActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("correct"),
      revision,
      targetActionId: id,
      reason: z.string().trim().min(5).max(2000),
      verified: z.literal(true),
    })
    .strict(),
  z
    .object({ action: z.literal("withdraw"), revision, reason: z.string().trim().min(5).max(2000) })
    .strict(),
  z
    .object({
      action: z.literal("transmitted"),
      revision,
      occurredAt: z.iso.datetime({ offset: true }),
      reference: z.string().trim().min(5).max(1000),
      reason: z.string().trim().min(5).max(2000),
      verified: z.literal(true),
    })
    .strict(),
  z
    .object({
      action: z.enum(["accepted", "declined", "issued"]),
      revision,
      policyId: id.optional(),
      correspondenceId: id.optional(),
      fingerprint: hash,
      source: citation,
      occurredAt: z.iso.datetime({ offset: true }),
      reason: z.string().trim().min(5).max(2000),
      verified: z.literal(true),
    })
    .strict()
    .refine(
      (v) =>
        Number(!!v.policyId) + Number(!!v.correspondenceId) === 1 &&
        (v.action !== "issued" || !!v.policyId),
      "One exact source required; issuance requires a policy",
    ),
]);
export const conclusionArchiveSchema = z.object({
  leadId: id,
  subjectKey: id,
  ownerId: id,
  clientName: z.string().max(160),
  offer: leadOfferSchema,
  checksum: hash,
  procedure: citation,
  explanation: z.string().max(2000),
  preparedBy: id,
  preparedAt: z.iso.datetime(),
  validUntil: z.iso.datetime(),
  method: z.literal("native_trace"),
});
export const conclusionReceiptSchema = z.object({
  id,
  contentHash: hash,
  integrityHash: hash,
  signedAt: z.iso.datetime(),
  signerName: z.string().max(160),
  place: z.string().max(160),
  representative: z.boolean(),
  drawing: authorizationDrawingSchema,
  accepted: z.literal(true),
  originalRead: z.literal(true),
});
export const conclusionSchema = z.object({
  id,
  leadId: id,
  offerId: id,
  revision,
  createdAt: z.iso.datetime(),
  state: z.enum([
    "awaiting_signature",
    "signed",
    "transmitted",
    "accepted",
    "declined",
    "issued",
    "withdrawn",
    "expired",
    "review_required",
  ]),
  sourceStatus: z.enum(["current", "changed", "unavailable", "unbound"]),
  contentHash: hash,
  archive: conclusionArchiveSchema.nullable(),
  receipt: conclusionReceiptSchema.nullable(),
  actions: z
    .array(
      z.object({
        id,
        actorId: id,
        recordedAt: z.iso.datetime(),
        input: conclusionActionSchema.nullable(),
        sourceCurrent: z.boolean().nullable(),
        superseded: z.boolean(),
        canCorrect: z.boolean(),
      }),
    )
    .max(100),
  canSign: z.boolean(),
  canManage: z.boolean(),
  availableActions: z
    .array(z.enum(["withdraw", "transmitted", "accepted", "declined", "issued"]))
    .max(2),
  insurerEvidence: z.enum(["missing", "documented", "review_required"]),
});
export const conclusionsSchema = z.object({
  leadRevision: revision,
  canPrepare: z.boolean(),
  items: z.array(conclusionSchema).max(20),
  nextCursor: z.string().nullable(),
});
export type Conclusion = z.infer<typeof conclusionSchema>;
export type ConclusionPrepare = z.infer<typeof conclusionPrepareSchema>;
export type ConclusionSign = z.infer<typeof conclusionSignSchema>;
export type ConclusionAction = z.infer<typeof conclusionActionSchema>;

export const conclusionCorrespondenceInputSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("share"),
      leadRevision: revision,
      documentId: id,
      fingerprint: hash,
      consent: z.literal(true),
    })
    .strict(),
  z
    .object({
      action: z.literal("withdraw"),
      leadRevision: revision,
      id,
      reason: z.string().trim().min(5).max(2000),
    })
    .strict(),
]);
export const conclusionCorrespondenceSchema = z.object({
  id,
  documentId: id,
  name: z.string().max(500).nullable(),
  fingerprint: hash.nullable(),
  sharedAt: z.iso.datetime(),
  active: z.boolean(),
  current: z.boolean(),
  canDownload: z.boolean(),
});
export const conclusionCorrespondencesSchema = z.object({
  leadRevision: revision,
  canShare: z.boolean(),
  items: z.array(conclusionCorrespondenceSchema).max(20),
  nextCursor: z.string().nullable(),
});
export const conclusionCandidatesSchema = z.object({
  items: z
    .array(z.object({ documentId: id, name: z.string().max(500), fingerprint: hash }))
    .max(20),
  nextCursor: z.string().nullable(),
});
export type ConclusionCorrespondenceInput = z.infer<typeof conclusionCorrespondenceInputSchema>;
