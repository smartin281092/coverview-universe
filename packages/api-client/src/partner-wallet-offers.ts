import {
  walletOffersQuerySchema,
  walletOffersSchema,
  type WalletOffersQuery,
} from "@coverview/contracts/partner-wallet-offers";
import type { PartnerRequest } from "./partner-transport.js";

// The offers page of Wallet: published offers, request by request (8 October 2026).
export function createWalletOfferClient(request: PartnerRequest) {
  return {
    walletOffers: (query: WalletOffersQuery, signal?: AbortSignal) => {
      const { clientProfileId } = walletOffersQuerySchema.parse(query);
      return request(
        `/wallet/offers${clientProfileId ? `?clientProfileId=${encodeURIComponent(clientProfileId)}` : ""}`,
        walletOffersSchema,
        signal,
      );
    },
  };
}
