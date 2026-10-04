import type { Pool, PoolClient } from "pg";
import {
  insuranceItemSchema,
  insuranceRequestStateSchema,
} from "@coverview/contracts/insurance-requests";

// Public, person-scoped source for Partner. Never returns the requester's email or siblings.
// Mutations call this after locking the actor, then keep the request/profile locks until commit.
export async function insuranceLeadCandidates(
  db: Pick<Pool | PoolClient, "query">,
  userId: string,
  requestId: string,
  lock = false,
) {
  if (lock) await db.query("select id from insurance_requests where id=$1 for update", [requestId]);
  const rows = await db.query<{
    item: unknown;
    state: string;
    submitted_at: Date;
    revision: number;
    display_name: string;
  }>(
    `select item,r.state,r.submitted_at,r.revision,p.display_name
     from insurance_requests r cross join lateral jsonb_array_elements(r.items) item
     join managed_profiles p on p.id=item->>'profileId' and p.user_id=$2
     where r.id=$1 and r.state<>'draft' and r.submitted_at is not null
     order by item->>'id' limit 12 ${lock ? "for share of p" : ""}`,
    [requestId, userId],
  );
  return rows.rows.map((row) => ({
    requestId,
    item: insuranceItemSchema.parse(row.item),
    state: insuranceRequestStateSchema.parse(row.state),
    submittedAt: row.submitted_at.toISOString(),
    revision: row.revision,
    clientName: row.display_name,
  }));
}
