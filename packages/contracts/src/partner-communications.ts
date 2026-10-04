import { z } from "zod";
const id = z.string().min(1).max(100),
  instant = z.iso.datetime({ offset: true }),
  text = z.string().trim().min(10).max(4000);
export const communicationChannelSchema = z.enum([
  "wallet",
  "phone",
  "email",
  "sms",
  "video",
  "office",
  "home",
]);
export const communicationPreferencesInputSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    channels: z.array(communicationChannelSchema).min(1).max(7),
    note: z.string().trim().max(500),
    confirmed: z.literal(true),
  })
  .strict()
  .refine((v) => new Set(v.channels).size === v.channels.length, { path: ["channels"] });
export const communicationPreferencesSchema = z.object({
  revision: z.number().int(),
  channels: z.array(communicationChannelSchema).nullable(),
  note: z.string(),
  confirmedAt: instant.nullable(),
  canEdit: z.boolean(),
});
export const communicationRecordInputSchema = z
  .object({
    expectedLeadRevision: z.number().int().min(0),
    channel: communicationChannelSchema,
    occurredAt: instant,
    outcome: z.enum(["reached", "attempted", "received"]),
    summary: text,
    sourceReference: text,
    nextAction: z.string().trim().min(5).max(500),
    dueAt: instant,
    confirmed: z.literal(true),
  })
  .strict();
export const recordingPurposeSchema = z.enum([
  "minutes",
  "evidence",
  "quality",
  "training",
  "advice_improvement",
]);
export const recordingRequestInputSchema = z
  .object({
    expectedLeadRevision: z.number().int().min(0),
    channel: z.enum(["phone", "video", "office"]),
    purposes: z.array(recordingPurposeSchema).min(1).max(5),
    notice: text,
    sourceReference: text,
    validUntil: instant,
    retainUntil: instant,
    confirmed: z.literal(true),
  })
  .strict()
  .refine(
    (v) =>
      new Set(v.purposes).size === v.purposes.length &&
      Date.parse(v.validUntil) < Date.parse(v.retainUntil),
    { path: ["retainUntil"] },
  );
export const recordingDecisionInputSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    decision: z.enum(["allow", "decline", "withdraw"]),
    confirmed: z.literal(true),
  })
  .strict();
export const transcriptInputSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    occurredAt: instant,
    sourceReference: text,
    correctionReason: z.string().trim().max(1000),
    segments: z
      .array(
        z
          .object({
            speaker: z.string().trim().min(1).max(100),
            locator: z.string().trim().min(1).max(100),
            text: z.string().trim().min(1).max(4000),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    allParticipantsAgreed: z.literal(true),
    sourceReviewed: z.literal(true),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.segments.reduce((n, s) => n + s.text.length, 0) > 40000)
      c.addIssue({ code: "custom", path: ["segments"] });
    if (v.expectedRevision > 0 && v.correctionReason.length < 10)
      c.addIssue({ code: "custom", path: ["correctionReason"] });
  });
export const transcriptActionInputSchema = z
  .object({
    versionId: id,
    segmentIndex: z.number().int().min(0).max(99),
    quote: z.string().trim().min(5).max(2000),
    title: z.string().trim().min(5).max(200),
    dueAt: instant,
    verified: z.literal(true),
  })
  .strict();
export const transcriptVersionSchema = z.object({
  id,
  revision: z.number().int().positive(),
  input: transcriptInputSchema,
  createdAt: instant,
});
export const recordingSchema = z.object({
  id,
  leadId: id,
  advisorName: z.string(),
  createdAt: instant,
  request: recordingRequestInputSchema,
  revision: z.number().int(),
  state: z.enum(["requested", "allowed", "declined", "withdrawn", "expired", "context_changed"]),
  decisionAt: instant.nullable(),
  canDecide: z.boolean(),
  canTranscribe: z.boolean(),
  canFollowUp: z.boolean(),
  transcripts: z.array(transcriptVersionSchema),
  nextRevision: z.number().int().nullable(),
  tasks: z.array(
    z.object({
      id,
      title: z.string(),
      state: z.string(),
      dueAt: instant,
      versionId: id,
      segmentIndex: z.number().int(),
    }),
  ),
});
export const communicationsQuerySchema = z
  .object({
    recordsCursor: z.string().max(500).optional(),
    recordingsCursor: z.string().max(500).optional(),
  })
  .strict();
export const communicationsSchema = z.object({
  leadRevision: z.number().int(),
  preferences: communicationPreferencesSchema,
  recordings: z.array(recordingSchema.omit({ transcripts: true, nextRevision: true, tasks: true })),
  records: z.array(
    z.object({
      id,
      input: communicationRecordInputSchema,
      createdAt: instant,
      authorName: z.string(),
    }),
  ),
  nextRecordsCursor: z.string().nullable(),
  nextRecordingsCursor: z.string().nullable(),
  canRecord: z.boolean(),
});
