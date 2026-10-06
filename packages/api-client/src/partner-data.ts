import {
  adminDataRequestSchema,
  adminDataRequestsQuerySchema,
  adminDataRequestsSchema,
  dataRequestAnswerSchema,
  dataRequestSchema,
  professionalDataExportSchema,
  professionalDataRequestInputSchema,
  professionalDataSchema,
  walletDataExportSchema,
  walletDataRequestInputSchema,
  walletDataSchema,
  type AdminDataRequestsQuery,
  type DataRequestAnswer,
  type ProfessionalDataRequestInput,
  type WalletDataRequestInput,
} from "@coverview/contracts/partner-data";
import type { PartnerMutation, PartnerRequest } from "./partner-transport.js";
// Rights of the people concerned (C7): each surface reads, exports and files requests only for its
// own person; CoverView answers them from Admin.
export function createDataRightsClient(request: PartnerRequest) {
  const id = encodeURIComponent;
  return {
    walletData: (signal?: AbortSignal) => request("/wallet/data", walletDataSchema, signal),
    exportWalletData: (options: PartnerMutation) =>
      request("/wallet/data/exports", walletDataExportSchema, options.signal, {}, options),
    professionalData: (signal?: AbortSignal) =>
      request("/partner/data", professionalDataSchema, signal),
    exportProfessionalData: (options: PartnerMutation) =>
      request("/partner/data/exports", professionalDataExportSchema, options.signal, {}, options),
    fileWalletDataRequest: (input: WalletDataRequestInput, options: PartnerMutation) =>
      request(
        "/wallet/data/requests",
        dataRequestSchema,
        options.signal,
        walletDataRequestInputSchema.parse(input),
        options,
      ),
    fileProfessionalDataRequest: (input: ProfessionalDataRequestInput, options: PartnerMutation) =>
      request(
        "/partner/data/requests",
        dataRequestSchema,
        options.signal,
        professionalDataRequestInputSchema.parse(input),
        options,
      ),
    withdrawDataRequest: (
      requestId: string,
      revision: number,
      options: PartnerMutation,
      wallet = false,
    ) =>
      request(
        `/${wallet ? "wallet" : "partner"}/data/requests/${id(requestId)}/withdraw`,
        dataRequestSchema,
        options.signal,
        { revision },
        options,
      ),
    adminDataRequests: (query: Partial<AdminDataRequestsQuery> = {}, signal?: AbortSignal) => {
      const parsed = adminDataRequestsQuerySchema.parse(query);
      const search = new URLSearchParams({
        state: parsed.state,
        ...(parsed.cursor ? { cursor: parsed.cursor } : {}),
      });
      return request(`/admin/partner/data-requests?${search}`, adminDataRequestsSchema, signal);
    },
    adminDataRequest: (requestId: string, signal?: AbortSignal) =>
      request(`/admin/partner/data-requests/${id(requestId)}`, adminDataRequestSchema, signal),
    takeDataRequest: (requestId: string, revision: number, options: PartnerMutation) =>
      request(
        `/admin/partner/data-requests/${id(requestId)}/take`,
        adminDataRequestSchema,
        options.signal,
        { revision },
        options,
      ),
    answerDataRequest: (requestId: string, input: DataRequestAnswer, options: PartnerMutation) =>
      request(
        `/admin/partner/data-requests/${id(requestId)}/answer`,
        adminDataRequestSchema,
        options.signal,
        dataRequestAnswerSchema.parse(input),
        options,
      ),
  };
}
