import {
  complementAnswerInputSchema,
  complementCandidatesSchema,
  complementCloseInputSchema,
  complementRequestInputSchema,
  partnerComplementsSchema,
  walletComplementsSchema,
  type ComplementAnswerInput,
  type ComplementCloseInput,
  type ComplementRequestInput,
} from "@coverview/contracts/partner-complements";
import type { PartnerMutation, PartnerRequest } from "./partner-transport.js";

// Complement asked of the client when the comparative analysis cannot conclude (C8e).
export function createComplementClient(request: PartnerRequest, base: URL) {
  const id = encodeURIComponent;
  return {
    partnerComplements: (leadId: string, signal?: AbortSignal) =>
      request(`/partner/leads/${id(leadId)}/complements`, partnerComplementsSchema, signal),
    requestComplement: (leadId: string, input: ComplementRequestInput, options: PartnerMutation) =>
      request(
        `/partner/leads/${id(leadId)}/complements`,
        partnerComplementsSchema,
        options.signal,
        complementRequestInputSchema.parse(input),
        options,
      ),
    closeComplement: (
      leadId: string,
      requestId: string,
      input: ComplementCloseInput,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/leads/${id(leadId)}/complements/${id(requestId)}/close`,
        partnerComplementsSchema,
        options.signal,
        complementCloseInputSchema.parse(input),
        options,
      ),
    walletComplements: (leadId: string, signal?: AbortSignal) =>
      request(`/wallet/leads/${id(leadId)}/complements`, walletComplementsSchema, signal),
    complementCandidates: (leadId: string, cursor?: string, signal?: AbortSignal) =>
      request(
        `/wallet/leads/${id(leadId)}/complement-candidates${cursor ? `?cursor=${id(cursor)}` : ""}`,
        complementCandidatesSchema,
        signal,
      ),
    answerComplement: (
      leadId: string,
      requestId: string,
      input: ComplementAnswerInput,
      options: PartnerMutation,
    ) =>
      request(
        `/wallet/leads/${id(leadId)}/complements/${id(requestId)}/answer`,
        walletComplementsSchema,
        options.signal,
        complementAnswerInputSchema.parse(input),
        options,
      ),
    complementSourceUrl: (leadId: string, requestId: string, documentId: string, wallet = false) =>
      new URL(
        `${wallet ? "/wallet" : "/partner"}/leads/${id(leadId)}/complements/${id(requestId)}/documents/${id(documentId)}/source`,
        base,
      ).href,
  };
}
