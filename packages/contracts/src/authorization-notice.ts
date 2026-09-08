import { z } from "zod";

// Version propre à la notice : modifier une procuration ne réinitialise pas sa lecture.
export const lsa45NoticeVersion = "lsa45-2026-09-08.2";
export const authorizationNoticeOpenedInputSchema = z
  .object({ version: z.literal(lsa45NoticeVersion) })
  .strict();
export const authorizationNoticeSchema = z
  .object({
    version: z.literal(lsa45NoticeVersion),
    firstOpenedAt: z.iso.datetime().nullable(),
  })
  .strict();
