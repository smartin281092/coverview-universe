import type { PoolClient } from "pg";

// Called inside the Lead transaction. The row lock also serializes deletion of the source.
export async function retainLeadSource(
  tx: PoolClient,
  documentId: string,
  actor: { userId: string; administrator: boolean },
  client: { userId: string | null; profileId: string | null },
  previouslyRetained = false,
) {
  const result = await tx.query<Record<string, unknown>>(
    "select id,user_id,managed_profile_id,retained_at from files where id=$1 and deleted_at is null and state not in ('deleted','deleting','quarantined') for update",
    [documentId],
  );
  const source = result.rows[0];
  if (
    !source ||
    (source.user_id !== actor.userId &&
      !(previouslyRetained && source.retained_at) &&
      !(
        actor.administrator &&
        (client.profileId
          ? source.managed_profile_id === client.profileId
          : source.user_id === client.userId && source.managed_profile_id === null)
      ))
  )
    return false;
  await tx.query("update files set retained_at=coalesce(retained_at,now()) where id=$1", [
    documentId,
  ]);
  return true;
}
