import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { InsuranceRequest } from "@coverview/contracts/insurance-requests";
import type { createDatabase } from "../../platform/db/database.js";
import type { ProfileActor } from "../identity/index.js";
import { managedProfiles, managedProfileSections, managedProfileAudit } from "./profiles.schema.js";
import { ManagedProfileError } from "./profiles.repository.js";
type Tx = Parameters<Parameters<ReturnType<typeof createDatabase>["db"]["transaction"]>[0]>[0];

// Caller holds the canonical owner/session lock and commits the request in this transaction.
// Each explicitly supplied cart person creates a private dossier, never another login identity.
export async function createInsuranceProfiles(
  tx: Tx,
  actor: ProfileActor,
  items: InsuranceRequest["items"],
) {
  const existing = await tx
    .select({ id: managedProfiles.id })
    .from(managedProfiles)
    .where(eq(managedProfiles.userId, actor.userId))
    .limit(50);
  if (existing.length + items.length > 49)
    throw new ManagedProfileError("MANAGED_PROFILE_LIMIT_REACHED", 422);
  const result: InsuranceRequest["items"] = [];
  for (const item of items) {
    const id = `prf_${randomUUID()}`;
    await tx.insert(managedProfiles).values({
      id,
      userId: actor.userId,
      kind: "person",
      displayName: `${item.firstName} ${item.lastName}`.slice(0, 160),
    });
    await tx.insert(managedProfileSections).values([
      {
        id: randomUUID(),
        userId: actor.userId,
        managedProfileId: id,
        section: "general",
        values: {
          firstName: item.firstName,
          lastName: item.lastName,
          ...(item.birthDate ? { birthDate: item.birthDate } : {}),
          ...(item.locality.country && item.locality.country !== "CH"
            ? {}
            : { postalCode: item.locality.postalCode, city: item.locality.locality }),
          country: item.locality.country ?? "CH",
        },
      },
      {
        id: randomUUID(),
        userId: actor.userId,
        managedProfileId: id,
        section: "health",
        values: {
          ...(item.currentInsurerName ? { insurer: item.currentInsurerName } : {}),
          requestedInsurer: item.offer.insurerName,
          requestedModel: item.offer.name,
          requestedDeductibleMinor: item.deductible * 100,
          requestedAccidentCoverage: item.accident,
          insuranceBirthYear: item.birthYear,
          insuranceSex: item.sex,
        },
      },
    ]);
    await tx.insert(managedProfileAudit).values({
      id: randomUUID(),
      userId: actor.userId,
      sessionId: actor.id,
      profileId: id,
      action: "profile.created.v1",
      revision: 0,
    });
    result.push({ ...item, profileId: id });
  }
  return result;
}
