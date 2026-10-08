import type { Pool } from "pg";
import {
  walletOffersQuerySchema,
  walletOffersSchema,
  type WalletOffersQuery,
} from "@coverview/contracts/partner-wallet-offers";
import { economyRead } from "./partner.commercial.js";
import { readOffers } from "./partner.offers.js";
import { fail, ownedClient, type PartnerActor } from "./partner.policy.js";

type Row = {
  id: string;
  title: string;
  request_kind: string;
  category: string;
  object: string;
  client_profile_id: string | null;
};

// The offers published to the client, request by request: the same active offers as the
// request's own view, never a withdrawn or replaced version.
export function createWalletOfferOperations(pool: Pool) {
  return {
    walletOffers: (actor: PartnerActor, raw: WalletOffersQuery) =>
      economyRead(pool, actor, async (tx) => {
        if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
        const query = walletOffersQuerySchema.parse(raw);
        const values: unknown[] = [actor.userId];
        const clauses = [
          ownedClient,
          "exists(select 1 from partner_offers o where o.lead_id=l.id and o.published_at is not null and o.active)",
        ];
        if (query.clientProfileId === "self") clauses.push("l.client_profile_id is null");
        else if (query.clientProfileId) {
          values.push(query.clientProfileId);
          clauses.push(`l.client_profile_id=$${values.length}`);
        }
        const rows = (
          await tx.query<Row>(
            `select l.id,l.title,l.request_kind,l.category,l.object,l.client_profile_id from partner_leads l
             where ${clauses.join(" and ")} order by l.updated_at desc,l.id desc limit 51`,
            values,
          )
        ).rows;
        const items = [];
        for (const row of rows.slice(0, 50)) {
          const offers = (await readOffers(tx, row.id, true)).items.filter(
            (offer) => offer.active && !["cancelled", "replaced"].includes(offer.state),
          );
          if (offers.length)
            items.push({
              lead: {
                id: row.id,
                title: row.title,
                requestKind: row.request_kind,
                category: row.category,
                object: row.object,
                clientProfileId: row.client_profile_id,
              },
              offers,
            });
        }
        return walletOffersSchema.parse({ items, truncated: rows.length > 50 });
      }),
  };
}
