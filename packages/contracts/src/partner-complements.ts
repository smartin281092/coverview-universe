import { z } from "zod";

const id = z.string().min(1).max(100);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const instant = z.iso.datetime({ offset: true });
const text = z.string().trim().min(10).max(2000);

// What the comparative analysis lacks, by origin (C8e, brief I.13). Counts and states only: the
// professional decides what to ask the client; their own verifications stay human.
export const analysisGapsSchema = z.object({
  incomplete: z.boolean(),
  // Client: the reference contract is absent, or its source changed or vanished since it was confirmed.
  referenceContract: z.enum(["absent", "to_confirm", "confirmed"]),
  // Professional: offers whose premium or values remain to verify, and the reference contract review.
  offersToVerify: z.number().int().nonnegative(),
  valuesToVerify: z.number().int().nonnegative(),
  contractReviewPending: z.boolean(),
  // Company: benefits absent from an offer, information to obtain and never an exclusion.
  missingBenefits: z.number().int().nonnegative(),
});

// What the professional asks the client to complete.
export const complementItemSchema = z.enum(["reference_contract", "documents", "information"]);
export const complementRequestInputSchema = z
  .object({
    items: z
      .array(complementItemSchema)
      .min(1)
      .max(3)
      .refine((items) => new Set(items).size === items.length),
    message: text,
    dueAt: instant,
    // Suspends the follow-up until the due date, through the request's usual waiting state.
    pauseFollowUp: z.boolean(),
    confirmed: z.literal(true),
  })
  .strict();
export const complementAnswerInputSchema = z
  .object({
    text: z.string().trim().max(2000),
    // Documents of the client's space, shared as they are; the original stays in the space.
    documents: z
      .array(z.object({ documentId: id, fingerprint: hash }).strict())
      .max(5)
      .refine((items) => new Set(items.map((item) => item.documentId)).size === items.length),
    confirmed: z.literal(true),
  })
  .strict()
  .refine((value) => value.text.length >= 10 || value.documents.length > 0, {
    path: ["text"],
  });
export const complementOutcomeSchema = z.enum(["completed", "unanswered", "withdrawn"]);
export const complementCloseInputSchema = z
  .object({
    outcome: complementOutcomeSchema,
    note: z.string().trim().max(2000),
    confirmed: z.literal(true),
  })
  .strict();

export const complementDocumentSchema = z.object({
  documentId: id,
  name: z.string().max(500).nullable(),
  // The shared version is still the one in the client's space.
  current: z.boolean(),
  canDownload: z.boolean(),
});
export const complementRequestSchema = z.object({
  id,
  items: z.array(complementItemSchema),
  message: z.string(),
  dueAt: instant,
  overdue: z.boolean(),
  pauseFollowUp: z.boolean(),
  state: z.enum(["open", "answered", "closed"]),
  requestedBy: z.string(),
  createdAt: instant,
  answer: z
    .object({
      text: z.string(),
      documents: z.array(complementDocumentSchema).max(5),
      answeredAt: instant,
    })
    .nullable(),
  // The reference contract the client confirmed after the request, through the existing path.
  referenceConfirmedAt: instant.nullable(),
  closure: z
    .object({ outcome: complementOutcomeSchema, note: z.string(), closedAt: instant })
    .nullable(),
  canAnswer: z.boolean(),
  canClose: z.boolean(),
});
// Partner: the analysis gaps and the requests of the request (dossier).
export const partnerComplementsSchema = z.object({
  gaps: analysisGapsSchema,
  canRequest: z.boolean(),
  items: z.array(complementRequestSchema).max(20),
});
// Wallet: the client's own requests; closing notes stay with the professional.
export const walletComplementsSchema = z.object({
  items: z.array(complementRequestSchema).max(20),
  truncated: z.boolean(),
});
export const complementCandidatesSchema = z.object({
  items: z
    .array(z.object({ documentId: id, name: z.string().max(500), fingerprint: hash }))
    .max(20),
  nextCursor: z.string().nullable(),
});

export type AnalysisGaps = z.infer<typeof analysisGapsSchema>;
export type ComplementItem = z.infer<typeof complementItemSchema>;
export type ComplementRequestInput = z.input<typeof complementRequestInputSchema>;
export type ComplementAnswerInput = z.input<typeof complementAnswerInputSchema>;
export type ComplementCloseInput = z.input<typeof complementCloseInputSchema>;
export type ComplementRequest = z.infer<typeof complementRequestSchema>;
