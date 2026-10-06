import { z } from "zod";
import {
  caseConfirmationSchema,
  clientConfirmationsSchema,
  qualityContactInputSchema,
  walletConfirmationInputSchema,
  type QualityContactInput,
  type WalletConfirmationInput,
  qualityActionInputSchema,
  qualityCaseSchema,
  qualityClientReplySchema,
  qualityCreateSchema,
  qualityQueueSchema,
  qualitySettingsInputSchema,
  qualitySettingsSchema,
  surveyResponseInputSchema,
  surveySchema,
  surveysSchema,
} from "@coverview/contracts/partner-quality";
import type { PartnerMutation, PartnerRequest } from "./partner-transport.js";
export function createQualityClient(request: PartnerRequest) {
  const root = (wallet: boolean) => (wallet ? "/wallet" : "/partner"),
    id = (value: string) => encodeURIComponent(value);
  return {
    // Client statements about a request (C8d).
    walletConfirmations: (leadId: string, signal?: AbortSignal) =>
      request(`/wallet/leads/${id(leadId)}/confirmations`, clientConfirmationsSchema, signal),
    confirmFromWallet: (leadId: string, input: WalletConfirmationInput, options: PartnerMutation) =>
      request(
        `/wallet/leads/${id(leadId)}/confirmations`,
        clientConfirmationsSchema,
        options.signal,
        walletConfirmationInputSchema.parse(input),
        options,
      ),
    leadConfirmations: (leadId: string, signal?: AbortSignal) =>
      request(
        `/partner/leads/${id(leadId)}/confirmations`,
        z.object({ items: z.array(caseConfirmationSchema) }),
        signal,
      ),
    recordQualityContact: (leadId: string, input: QualityContactInput, options: PartnerMutation) =>
      request(
        `/partner/leads/${id(leadId)}/quality-contacts`,
        caseConfirmationSchema,
        options.signal,
        qualityContactInputSchema.parse(input),
        options,
      ),
    qualitySettings: (signal?: AbortSignal) =>
      request("/admin/partner/quality/settings", qualitySettingsSchema, signal),
    updateQualitySettings: (
      input: z.infer<typeof qualitySettingsInputSchema>,
      options: PartnerMutation,
    ) =>
      request(
        "/admin/partner/quality/settings",
        qualitySettingsSchema,
        options.signal,
        qualitySettingsInputSchema.parse(input),
        options,
      ),
    qualityQueue: (
      query: {
        state?: "open" | "closed" | "all";
        cursor?: string;
        reason?: "all" | "undeclared_contract";
      },
      leadId?: string,
      wallet = false,
      signal?: AbortSignal,
    ) =>
      request(
        `${leadId ? `${root(wallet)}/leads/${id(leadId)}/quality` : "/admin/partner/quality"}?${new URLSearchParams(query).toString()}`,
        qualityQueueSchema,
        signal,
      ),
    qualityCase: (caseId: string, wallet = false, beforeRevision?: number, signal?: AbortSignal) =>
      request(
        `${root(wallet)}/quality/${id(caseId)}${beforeRevision ? `?beforeRevision=${beforeRevision}` : ""}`,
        qualityCaseSchema,
        signal,
      ),
    createQualityCase: (
      leadId: string,
      input: z.infer<typeof qualityCreateSchema>,
      options: PartnerMutation,
      wallet = false,
    ) =>
      request(
        `${root(wallet)}/leads/${id(leadId)}/quality`,
        qualityCaseSchema,
        options.signal,
        qualityCreateSchema.parse(input),
        options,
      ),
    actQualityCase: (
      caseId: string,
      input: z.infer<typeof qualityActionInputSchema>,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/quality/${id(caseId)}/actions`,
        qualityCaseSchema,
        options.signal,
        qualityActionInputSchema.parse(input),
        options,
      ),
    replyQualityCase: (
      caseId: string,
      input: z.infer<typeof qualityClientReplySchema>,
      options: PartnerMutation,
      wallet = false,
    ) =>
      request(
        `${root(wallet)}/quality/${id(caseId)}/replies`,
        qualityCaseSchema,
        options.signal,
        qualityClientReplySchema.parse(input),
        options,
      ),
    surveys: (leadId: string, signal?: AbortSignal) =>
      request(`/wallet/leads/${id(leadId)}/surveys`, surveysSchema, signal),
    survey: (surveyId: string, signal?: AbortSignal) =>
      request(`/wallet/surveys/${id(surveyId)}`, surveySchema, signal),
    respondSurvey: (
      surveyId: string,
      input: z.infer<typeof surveyResponseInputSchema>,
      options: PartnerMutation,
    ) =>
      request(
        `/wallet/surveys/${id(surveyId)}/responses`,
        surveySchema,
        options.signal,
        surveyResponseInputSchema.parse(input),
        options,
      ),
  };
}
