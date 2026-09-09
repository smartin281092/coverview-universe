import { createHash } from "node:crypto";
import type {
  CompanyAction,
  CompanyActionGroup,
  CompanyActionObservation,
  CompanyActionValues,
  ServiceRequest,
} from "@coverview/contracts";
import { sameProfileValue } from "./document.reconciliation.js";

const companyGroupFields: Record<CompanyActionGroup, readonly (keyof CompanyActionValues)[]> = {
  address: ["street", "postalCode", "city", "country"],
  phone: ["phone"],
  contactEmail: ["contactEmail"],
  firstName: ["firstName"],
  lastName: ["lastName"],
  birthDate: ["birthDate"],
  nationality: ["nationality"],
  companyName: ["companyName"],
  registrationNumber: ["registrationNumber"],
};
export function companyGroupValues(
  values: Record<string, unknown>,
  group: CompanyActionGroup,
): CompanyActionValues {
  return Object.fromEntries(
    companyGroupFields[group].flatMap((field) => {
      const value = values[field];
      return typeof value === "string" && value.trim() ? [[field, value]] : [];
    }),
  );
}
export function companyValuesHash(values: CompanyActionValues) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        Object.entries(values)
          .filter((entry): entry is [string, string] => typeof entry[1] === "string")
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([field, value]) => [
            field,
            value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("fr"),
          ]),
      ),
    )
    .digest("hex");
}
function observationMatches(observation: CompanyActionObservation, values: CompanyActionValues) {
  return Object.entries(observation.values).every(([field, value]) => {
    const current = values[field as keyof CompanyActionValues];
    return !!current && typeof value === "string" && sameProfileValue(current, value);
  });
}
export function companyActionProjection(input: {
  profileId: string;
  profileName: string;
  profileRevision: number;
  companyId: ServiceRequest["companyId"];
  group: CompanyActionGroup;
  currentValues: CompanyActionValues;
  observations: CompanyActionObservation[];
  requests: ServiceRequest[];
}): CompanyAction {
  const hash = companyValuesHash(input.currentValues);
  const matching = input.requests.filter((request) => companyValuesHash(request.values) === hash);
  const latestProof = matching
    .filter((request) => request.evidence)
    .sort(
      (left, right) =>
        right.evidence!.occurredAt.localeCompare(left.evidence!.occurredAt) ||
        right.evidence!.recordedAt.localeCompare(left.evidence!.recordedAt),
    )[0];
  const evidence = latestProof?.evidence ?? null;
  // Import time never proves document age. Undated archival sources cannot invalidate
  // an explicit later notification/confirmation about the same values.
  const newerDifference =
    evidence &&
    input.observations.some(
      (observation) =>
        observation.documentDate !== null &&
        observation.documentDate > evidence.occurredAt.slice(0, 10) &&
        !observationMatches(observation, input.currentValues),
    );
  const active = matching.find(
    (request) => request.state === "requested" || request.state === "in_progress",
  );
  const currentPresent = Object.keys(input.currentValues).length > 0;
  const differences = input.observations.filter(
    (observation) => !observationMatches(observation, input.currentValues),
  );
  const observed = new Map<string, string[]>();
  for (const observation of input.observations)
    for (const [field, value] of Object.entries(observation.values)) {
      if (typeof value !== "string") continue;
      observed.set(field, [...(observed.get(field) ?? []), value]);
    }
  const conflicting =
    input.observations.some((observation) => observation.ambiguous) ||
    [...observed.values()].some((values) =>
      values.some((value) => !sameProfileValue(value, values[0]!)),
    );
  const complete = Object.keys(input.currentValues).every((field) => observed.has(field));
  let status: CompanyAction["status"];
  if (evidence && !newerDifference) status = evidence.kind;
  else if (active) status = active.state === "in_progress" ? "in_progress" : "requested";
  else if (!currentPresent || conflicting) status = "needs_review";
  else if (
    differences.length ||
    newerDifference ||
    (!input.observations.length && input.requests.length)
  )
    status = "needs_notification";
  else status = complete ? "current" : "unknown";
  return {
    id: `${input.profileId}:${input.companyId}:${input.group}`,
    profileId: input.profileId,
    profileName: input.profileName,
    profileRevision: input.profileRevision,
    companyId: input.companyId,
    group: input.group,
    groupId: input.group,
    currentValues: input.currentValues,
    status,
    observations: input.observations,
    request: active ?? latestProof ?? input.requests[0] ?? null,
    evidence: evidence && !newerDifference ? evidence : null,
    canRequest:
      currentPresent &&
      !["current", "unknown", "requested", "in_progress", "notified", "confirmed"].includes(status),
  };
}
