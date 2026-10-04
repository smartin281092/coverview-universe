import {
  conclusionActionSchema,
  conclusionPrepareSchema,
  conclusionSchema,
  conclusionsSchema,
  conclusionSignSchema,
  type ConclusionAction,
  type ConclusionPrepare,
  type ConclusionSign,
  conclusionCorrespondencesSchema,
  conclusionCandidatesSchema,
  conclusionCorrespondenceInputSchema,
  type ConclusionCorrespondenceInput,
} from "@coverview/contracts/partner-conclusion";
import type { PartnerMutation, PartnerRequest } from "./partner-transport.js";
import { leadReopeningsSchema } from "@coverview/contracts/partner-lifecycle";
export function createConclusionClient(request: PartnerRequest, base: URL) {
  const root = (wallet: boolean) => (wallet ? "/wallet" : "/partner");
  const id = encodeURIComponent;
  return {
    leadReopenings: (leadId: string, wallet = false, cursor?: string, signal?: AbortSignal) =>
      request(
        `${root(wallet)}/leads/${id(leadId)}/reopenings${cursor ? `?cursor=${id(cursor)}` : ""}`,
        leadReopeningsSchema,
        signal,
      ),
    conclusionCorrespondences: (
      leadId: string,
      wallet = false,
      cursor?: string,
      signal?: AbortSignal,
    ) =>
      request(
        `${root(wallet)}/leads/${id(leadId)}/conclusion-correspondences${cursor ? `?cursor=${id(cursor)}` : ""}`,
        conclusionCorrespondencesSchema,
        signal,
      ),
    conclusionCandidates: (leadId: string, cursor?: string, signal?: AbortSignal) =>
      request(
        `/wallet/leads/${id(leadId)}/conclusion-candidates${cursor ? `?cursor=${id(cursor)}` : ""}`,
        conclusionCandidatesSchema,
        signal,
      ),
    shareConclusionCorrespondence: (
      leadId: string,
      input: ConclusionCorrespondenceInput,
      options: PartnerMutation,
    ) =>
      request(
        `/wallet/leads/${id(leadId)}/conclusion-correspondences`,
        conclusionCorrespondencesSchema,
        options.signal,
        conclusionCorrespondenceInputSchema.parse(input),
        options,
      ),
    conclusionCorrespondenceSourceUrl: (leadId: string, sourceId: string, wallet = false) =>
      new URL(
        `${root(wallet)}/leads/${id(leadId)}/conclusion-correspondences/${id(sourceId)}/source`,
        base,
      ).href,
    conclusions: (leadId: string, wallet = false, cursor?: string, signal?: AbortSignal) =>
      request(
        `${root(wallet)}/leads/${id(leadId)}/conclusions${cursor ? `?cursor=${id(cursor)}` : ""}`,
        conclusionsSchema,
        signal,
      ),
    conclusion: (conclusionId: string, wallet = false, signal?: AbortSignal) =>
      request(`${root(wallet)}/conclusions/${id(conclusionId)}`, conclusionSchema, signal),
    prepareConclusion: (leadId: string, input: ConclusionPrepare, options: PartnerMutation) =>
      request(
        `/partner/leads/${id(leadId)}/conclusions`,
        conclusionSchema,
        options.signal,
        conclusionPrepareSchema.parse(input),
        options,
      ),
    signConclusion: (conclusionId: string, input: ConclusionSign, options: PartnerMutation) =>
      request(
        `/wallet/conclusions/${id(conclusionId)}/signatures`,
        conclusionSchema,
        options.signal,
        conclusionSignSchema.parse(input),
        options,
      ),
    actConclusion: (conclusionId: string, input: ConclusionAction, options: PartnerMutation) =>
      request(
        `/partner/conclusions/${id(conclusionId)}/actions`,
        conclusionSchema,
        options.signal,
        conclusionActionSchema.parse(input),
        options,
      ),
  };
}
