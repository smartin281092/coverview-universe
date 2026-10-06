import {
  professionalDataExportSchema,
  professionalDataSchema,
  walletDataExportSchema,
  walletDataSchema,
} from "@coverview/contracts/partner-data";
import type { PartnerMutation, PartnerRequest } from "./partner-transport.js";
// Rights of the people concerned (C7): each surface reads and exports only its own person's data.
export function createDataRightsClient(request: PartnerRequest) {
  return {
    walletData: (signal?: AbortSignal) => request("/wallet/data", walletDataSchema, signal),
    exportWalletData: (options: PartnerMutation) =>
      request("/wallet/data/exports", walletDataExportSchema, options.signal, {}, options),
    professionalData: (signal?: AbortSignal) =>
      request("/partner/data", professionalDataSchema, signal),
    exportProfessionalData: (options: PartnerMutation) =>
      request("/partner/data/exports", professionalDataExportSchema, options.signal, {}, options),
  };
}
