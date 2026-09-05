import { z } from "zod";

export const livenessSchema = z.object({ status: z.literal("alive") });
export const readinessSchema = z.object({ status: z.enum(["ready", "not_ready"]) });
export const platformErrorCodeSchema = z.enum([
  "PLATFORM_INVALID_REQUEST",
  "PLATFORM_NOT_FOUND",
  "PLATFORM_NOT_READY",
  "PLATFORM_INTERNAL_ERROR",
  "PLATFORM_REQUEST_FAILED",
  "PLATFORM_INVALID_RESPONSE",
]);
export const apiErrorSchema = z.object({
  error: z.object({
    code: platformErrorCodeSchema,
    message: z.string(),
    requestId: z.string(),
  }),
});

export const localPersonaSchema = z.object({
  id: z.string().startsWith("fixture_"),
  email: z.email().endsWith(".test"),
  org: z.string().min(1),
  role: z.literal("preview"),
  state: z.literal("fixture"),
  tests: z.array(z.string()).min(1).max(10),
  access: z.literal("local-selector"),
});
export const localPersonasSchema = z.object({
  mode: z.literal("local-fixture"),
  personas: z.array(localPersonaSchema).max(10),
});

export type Readiness = z.infer<typeof readinessSchema>;
export type LocalPersona = z.infer<typeof localPersonaSchema>;
export type PlatformErrorCode = z.infer<typeof platformErrorCodeSchema>;
