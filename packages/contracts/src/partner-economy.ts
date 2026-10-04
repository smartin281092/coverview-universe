import { z } from "zod";
import { leadCategorySchema, professionalLanguageSchema, swissCantonSchema } from "./partner.js";
import { insuranceCompanyIdSchema } from "./companies.js";

const id = z.string().min(1).max(100);
const instant = z.iso.datetime({ offset: true });
const note = z.string().trim().min(10).max(2000);
const revision = z.number().int().nonnegative();
const minor = z.number().int().min(0).max(2_000_000_000);
const bps = z.number().int().min(0).max(10_000);
const proof = z.object({ reference: note, occurredAt: instant }).strict();
export const commercialTermsSchema = z
  .object({
    categories: z.array(leadCategorySchema).min(1).max(20),
    companies: z.array(insuranceCompanyIdSchema).min(1).max(50),
    validFrom: instant,
    validUntil: instant,
    supplier: z.discriminatedUnion("model", [
      z
        .object({
          model: z.literal("fixed"),
          amountMinor: minor.positive(),
          payer: z.literal("receiver"),
          trigger: z.enum(["authorized_handover", "documented_qualification"]),
        })
        .strict(),
      z
        .object({
          model: z.literal("success"),
          rateBps: bps.positive(),
          trigger: z.literal("commission_received"),
        })
        .strict(),
    ]),
    currency: z.literal("CHF"),
    basis: note,
    deductions: z
      .array(
        z.object({ code: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/u), description: note }).strict(),
      )
      .max(10),
    coverviewRateBps: bps,
    contributors: z
      .array(z.object({ userId: id, rateBps: bps.positive(), basisReference: note }).strict())
      .max(8),
    collector: z.enum(["coverview", "receiver"]),
    reserveTerms: note,
    clawbackTerms: note,
    paymentTerms: note,
    validityCriteria: note,
    disputeDays: z.number().int().min(1).max(3650),
    replacementRefundTerms: note,
    sourceReference: note,
    branchRules: note,
    caps: note,
    taxTreatment: note,
    bonusTerms: note,
  })
  .strict()
  .refine((v) => Date.parse(v.validUntil) > Date.parse(v.validFrom))
  .refine((v) => new Set(v.deductions.map((d) => d.code)).size === v.deductions.length)
  .refine((v) => new Set(v.contributors.map((c) => c.userId)).size === v.contributors.length)
  .refine(
    (v) =>
      v.coverviewRateBps +
        (v.supplier.model === "success" ? v.supplier.rateBps : 0) +
        v.contributors.reduce((sum, c) => sum + c.rateBps, 0) <=
      10_000,
  );
export const commercialInputSchema = z
  .object({ terms: commercialTermsSchema, confirmed: z.literal(true) })
  .strict();
export const commercialReviewSchema = z
  .object({
    decision: z.enum(["approve", "reject", "withdraw"]),
    reason: note,
    validationReference: note,
  })
  .strict();
const commercialReviewRecordSchema = z.object({
  authorId: id,
  decision: z.enum(["approve", "reject", "withdraw"]),
  reason: note,
  validationReference: note,
  at: instant,
});
export const commercialConditionSchema = z.object({
  id,
  ownerId: id,
  organizationId: id,
  name: z.string(),
  organization: z.string(),
  createdAt: instant,
  terms: commercialTermsSchema,
  state: z.enum(["pending", "approved", "rejected", "withdrawn", "scope_changed", "expired"]),
  review: commercialReviewRecordSchema.nullable(),
  reviews: z.array(commercialReviewRecordSchema).max(2),
  canReview: z.boolean(),
  canWithdraw: z.boolean(),
});
export const marketQuerySchema = z
  .object({
    cursor: z.string().max(400).optional(),
    view: z.enum(["available", "mine", "applications", "all"]).default("available"),
  })
  .strict();
export const marketPublicationSchema = z
  .object({
    leadRevision: revision,
    conditionId: id,
    language: professionalLanguageSchema,
    canton: swissCantonSchema.nullable(),
    modes: z
      .array(z.enum(["phone", "video", "office", "home"]))
      .min(1)
      .max(4),
    reason: z.enum(["capacity", "convention", "specialist", "collaboration"]),
    qualification: z.enum(["need_stated", "contacted", "documents_reviewed"]),
    steps: z
      .array(
        z.enum(["contact", "appointment", "comparison", "offers_requested", "offers_received"]),
      )
      .max(5),
    constraints: z
      .array(z.enum(["deadline", "remote_only", "travel", "specialist", "client_choice"]))
      .max(5),
    expiresAt: instant,
    publicationConfirmed: z.literal(true),
  })
  .strict();
export const marketApplicationInputSchema = z
  .object({ reason: note, suitabilityAcknowledged: z.literal(true) })
  .strict();
export const marketMissionSchema = z
  .object({
    mode: z.enum(["one_off", "co_advice", "transfer"]),
    access: z.enum(["read", "contribute"]),
    communication: z.enum(["referent_only", "client_direct"]),
    scope: note,
    responsibilities: note,
    powers: note,
    limitations: note,
    validUntil: instant,
  })
  .strict()
  .refine(
    (v) =>
      v.mode === "co_advice" || (v.access === "contribute" && v.communication === "client_direct"),
  );
export const marketReservationInputSchema = z
  .object({
    targetId: id,
    conditionId: id,
    mission: marketMissionSchema,
    expiresAt: instant,
    reason: note,
    termsAccepted: z.literal(true),
    suitabilityReviewed: z.literal(true),
  })
  .strict();
export const marketDecisionSchema = z
  .object({
    decision: z.enum(["accept", "decline", "cancel"]),
    reason: note,
    confirmed: z.literal(true),
  })
  .strict();
export const marketMandateInputSchema = z
  .object({
    decision: z.enum(["accept", "decline", "withdraw"]),
    confirmed: z.literal(true),
    reason: note,
  })
  .strict();
export const marketCardSchema = z.object({
  id,
  category: leadCategorySchema,
  createdAt: instant,
  leadCreatedAt: instant,
  expiresAt: instant,
  language: professionalLanguageSchema,
  canton: swissCantonSchema.nullable(),
  modes: marketPublicationSchema.shape.modes,
  reason: marketPublicationSchema.shape.reason,
  qualification: marketPublicationSchema.shape.qualification,
  steps: marketPublicationSchema.shape.steps,
  constraints: marketPublicationSchema.shape.constraints,
  supplier: commercialTermsSchema.shape.supplier,
  currency: z.literal("CHF"),
  state: z.enum(["available", "reserved", "accepted", "withdrawn", "expired", "context_changed"]),
  canApply: z.boolean(),
  canManage: z.boolean(),
  leadId: id.nullable(),
});
export const marketReservationSchema = z.object({
  id,
  listingId: id,
  targetId: id,
  targetName: z.string(),
  publisherName: z.string(),
  createdAt: instant,
  expiresAt: instant,
  mission: marketMissionSchema,
  condition: commercialConditionSchema.nullable(),
  state: z.enum(["reserved", "accepted", "declined", "cancelled", "expired", "context_changed"]),
  mandate: z.enum(["pending", "accepted", "declined", "withdrawn", "context_changed", "expired"]),
  mandateId: id.nullable(),
  agreementId: id.nullable(),
  collaborationId: id.nullable(),
  canRespond: z.boolean(),
  canCancel: z.boolean(),
  canMandate: z.boolean(),
});
export const marketDetailSchema = z.object({
  publication: marketCardSchema,
  condition: commercialConditionSchema.nullable(),
  canReserve: z.boolean(),
  applications: z
    .array(
      z.object({
        id,
        userId: id,
        name: z.string(),
        reason: note,
        createdAt: instant,
        withdrawn: z.boolean(),
      }),
    )
    .max(20),
  reservations: z.array(marketReservationSchema).max(20),
  nextApplicationsCursor: z.string().nullable(),
  nextReservationsCursor: z.string().nullable(),
});
export const marketListSchema = z.object({
  items: z.array(marketCardSchema).max(20),
  nextCursor: z.string().nullable(),
});
export const commercialListSchema = z.object({
  items: z.array(commercialConditionSchema).max(20),
  nextCursor: z.string().nullable(),
});
export const marketMandatesSchema = z.object({
  items: z.array(marketReservationSchema).max(20),
  nextCursor: z.string().nullable(),
});
export type CommercialTerms = z.infer<typeof commercialTermsSchema>;
export type MarketPublication = z.infer<typeof marketPublicationSchema>;
export type MarketReservationInput = z.infer<typeof marketReservationInputSchema>;
export type MarketReservation = z.infer<typeof marketReservationSchema>;
export type MarketDetail = z.infer<typeof marketDetailSchema>;
export type CommercialCondition = z.infer<typeof commercialConditionSchema>;

export const economyCaseInputSchema = z
  .object({
    agreementId: id,
    stream: z.enum(["lead_price", "contract_commission"]),
    finalPolicyId: id.nullable(),
    companyId: insuranceCompanyIdSchema.nullable(),
    reference: note,
    scopeReference: note,
    confirmed: z.literal(true),
  })
  .strict()
  .refine((v) =>
    v.stream === "lead_price"
      ? v.finalPolicyId === null && v.companyId === null
      : v.finalPolicyId !== null && v.companyId !== null,
  );
export const economyEntryInputSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("estimate"),
      minimumMinor: minor,
      maximumMinor: minor,
      probabilityBps: bps.nullable(),
      assumptions: note,
      proof,
    })
    .strict()
    .refine((v) => v.maximumMinor >= v.minimumMinor),
  z
    .object({
      kind: z.literal("confirm"),
      grossMinor: minor,
      deductions: z
        .array(z.object({ code: z.string().max(40), amountMinor: minor }).strict())
        .max(10),
      triggerReference: note,
      proof,
    })
    .strict(),
  z
    .object({
      kind: z.literal("receive"),
      grossMinor: minor.positive(),
      deductions: z
        .array(z.object({ code: z.string().max(40), amountMinor: minor }).strict())
        .max(10),
      statementReference: note,
      settlementReference: note,
      proof,
    })
    .strict(),
  z
    .object({
      kind: z.enum([
        "reserve",
        "release",
        "pay",
        "clawback",
        "recover",
        "dispute",
        "resolve_dispute",
        "refund",
      ]),
      beneficiary: id,
      amountMinor: minor.positive(),
      proof,
    })
    .strict(),
  z.object({ kind: z.literal("reverse"), entryId: id, reason: note, proof }).strict(),
  z
    .object({
      kind: z.literal("reconcile"),
      statementReference: note,
      settlementReference: note,
      expectedMinor: minor,
      observedMinor: minor,
      explanation: note,
      proof,
    })
    .strict(),
]);
export const economyRecordSchema = z
  .object({ revision, entry: economyEntryInputSchema, evidenceChecked: z.literal(true) })
  .strict();
export const economyBalanceSchema = z.object({
  beneficiary: id,
  name: z.string(),
  confirmedMinor: minor.nullable(),
  receivedMinor: minor,
  reservedMinor: minor,
  disputedMinor: minor,
  paidMinor: minor,
  recoveredMinor: minor,
  clawbackMinor: minor,
  availableMinor: minor,
  recoveryDueMinor: minor,
});
export const economyEntrySchema = z.object({
  id,
  revision,
  authorId: id,
  createdAt: instant,
  entry: economyEntryInputSchema,
  reversed: z.boolean(),
});
export const economyCaseSchema = z.object({
  id,
  agreementId: id,
  stream: economyCaseInputSchema.shape.stream,
  reference: z.string(),
  scopeReference: z.string(),
  finalPolicyId: id.nullable(),
  companyId: insuranceCompanyIdSchema.nullable(),
  createdAt: instant,
  collector: z.enum(["coverview", "receiver", "supplier"]),
  currency: z.literal("CHF"),
  revision,
  estimate: z
    .object({
      minimumMinor: minor,
      maximumMinor: minor,
      weightedMinimumMinor: minor.nullable(),
      weightedMaximumMinor: minor.nullable(),
      probabilityBps: bps.nullable(),
      assumptions: note,
    })
    .nullable(),
  confirmedMinor: minor.nullable(),
  receivedMinor: minor,
  balances: z.array(economyBalanceSchema).max(11),
  reconciliation: z
    .object({
      expectedMinor: minor,
      observedMinor: minor,
      differenceMinor: z.number().int(),
      current: z.boolean(),
      explanation: note,
    })
    .nullable(),
  canRecord: z.boolean(),
  history: z.array(economyEntrySchema).max(20),
  nextCursor: z.string().nullable(),
  terms: commercialTermsSchema.nullable(),
  ownOnly: z.boolean(),
});
export const economyCasesSchema = z.object({
  items: z.array(economyCaseSchema).max(20),
  nextCursor: z.string().nullable(),
});
export const economyAgreementsSchema = z.object({
  items: z
    .array(
      z.object({
        id,
        leadId: id.nullable(),
        acceptedAt: instant,
        supplierName: z.string(),
        receiverName: z.string(),
        terms: commercialTermsSchema,
        mission: marketMissionSchema,
      }),
    )
    .max(20),
  nextCursor: z.string().nullable(),
});
export type EconomyEntryInput = z.infer<typeof economyEntryInputSchema>;
export type EconomyCase = z.infer<typeof economyCaseSchema>;
export type EconomyRecord = z.infer<typeof economyRecordSchema>;
