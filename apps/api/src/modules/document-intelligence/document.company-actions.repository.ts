import { createHash, randomUUID } from "node:crypto";
import { assignedDocumentCondition } from "./document.profile-assignment.js";
import { and, asc, desc, eq, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { z } from "zod";
import {
  companyActionGroupSchema,
  companyActionRequestInputSchema,
  companyActionsQuerySchema,
  companyActionsSchema,
  serviceRequestSchema,
  serviceRequestsQuerySchema,
  serviceRequestsSchema,
  serviceRequestTransitionInputSchema,
  profileValuesSchema,
  entityProfileValuesSchema,
  type CompanyAction,
  type CompanyActionObservation,
  type CompanyActionRequestInput,
  type ServiceRequest,
  type ServiceRequestTransitionInput,
  type DocumentSynchronization,
  type DocumentReviewGroup,
} from "@coverview/contracts";
import type { createDatabase } from "../../platform/db/database.js";
import { lockProfileActor, readDocumentProfile, type ProfileActor } from "../identity/index.js";
import { readAuthorizationStatus } from "../authorizations/index.js";
import {
  assertDocumentProfileTarget,
  managedProfiles,
  readManagedDocumentProfile,
} from "../profiles/index.js";
import { documents } from "./document.schema.js";
import { DocumentError } from "./document.errors.js";
import { documentPresentation } from "./document.presentation.js";
import { sameProfileValue } from "./document.reconciliation.js";
import { buildDocumentGroups, readDocumentFieldCorrections } from "./document.field-review.js";
import {
  companyActionAudit,
  companyActionCommands,
  companyActionEvidence,
  companyServiceRequests,
} from "./document.company-actions.schema.js";
import {
  companyActionProjection,
  companyGroupValues,
  companyValuesHash,
} from "./document.company-actions.projection.js";

type Database = ReturnType<typeof createDatabase>["db"];
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type RequestRow = typeof companyServiceRequests.$inferSelect;
type EvidenceRow = typeof companyActionEvidence.$inferSelect;
type ActionQuery = z.infer<typeof companyActionsQuerySchema>;
type AdminQuery = z.infer<typeof serviceRequestsQuerySchema>;
const invalid = () => new DocumentError("DOCUMENT_REVIEW_INVALID", 422);
const conflict = () => new DocumentError("DOCUMENT_CONFLICT", 409);
const toRequest = (
  row: RequestRow,
  evidence: EvidenceRow[],
  superseded = false,
): ServiceRequest => {
  const latest = evidence
    .filter((item) => item.requestId === row.id)
    .sort(
      (a, b) =>
        b.occurredAt.getTime() - a.occurredAt.getTime() ||
        b.recordedAt.getTime() - a.recordedAt.getTime(),
    )[0];
  return serviceRequestSchema.parse({
    ...row,
    superseded,
    allowedTransitions:
      superseded || row.state === "confirmed"
        ? []
        : row.state === "notified"
          ? ["confirmed"]
          : row.state === "in_progress"
            ? ["notified", "confirmed"]
            : ["in_progress", "notified", "confirmed"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    evidence: latest
      ? {
          kind: latest.kind,
          occurredAt: latest.occurredAt.toISOString(),
          recordedAt: latest.recordedAt.toISOString(),
          reference: latest.reference,
        }
      : null,
  });
};
const groupKey = (profileId: string, companyId: string, group: string) =>
  `${profileId}:${companyId}:${group}`;
const requestKey = (row: Pick<RequestRow, "profileId" | "companyId" | "group">) =>
  groupKey(row.profileId, row.companyId, row.group);
async function evidenceFor(tx: Database | Tx, rows: RequestRow[]) {
  if (!rows.length) return [];
  return tx
    .select()
    .from(companyActionEvidence)
    .where(
      and(
        inArray(companyActionEvidence.userId, [...new Set(rows.map((row) => row.userId))]),
        inArray(
          companyActionEvidence.requestId,
          rows.map((row) => row.id),
        ),
      ),
    )
    .limit(rows.length * 2);
}
async function requestSuperseded(tx: Database | Tx, row: RequestRow) {
  const values =
    row.profileId === "self"
      ? await readDocumentProfile(tx, row.userId).then((profile) =>
          Object.fromEntries(
            Object.entries(profile.fields).map(([field, content]) => [field, content?.value]),
          ),
        )
      : (await readManagedDocumentProfile(tx, row.userId, row.profileId)).values;
  return companyValuesHash(companyGroupValues(values, row.group)) !== row.valuesHash;
}
function cursorValue<T>(cursor: string | undefined, schema: z.ZodType<T>): T | null {
  if (!cursor) return null;
  try {
    return schema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
  } catch {
    throw invalid();
  }
}
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
// The caller has locked the owner and built this action from current server data.
// Reused by the grouped action command so all recipient cards commit together.
export async function requestCompanyAction(
  tx: Tx,
  actor: ProfileActor,
  action: CompanyAction,
  auditInitiation = false,
) {
  if (action.request && ["requested", "in_progress"].includes(action.status)) return action.request;
  if (!action.canRequest) throw invalid();
  const [row] = await tx
    .insert(companyServiceRequests)
    .values({
      id: randomUUID(),
      userId: actor.userId,
      managedProfileId: action.profileId === "self" ? null : action.profileId,
      profileId: action.profileId,
      profileName: action.profileName,
      companyId: action.companyId,
      group: action.group,
      profileRevision: action.profileRevision,
      values: action.currentValues,
      valuesHash: companyValuesHash(action.currentValues),
    })
    .returning();
  if (!row) throw new Error("Company service request insert failed");
  if (auditInitiation)
    await tx.insert(companyActionAudit).values({
      id: randomUUID(),
      userId: actor.userId,
      requestId: row.id,
      actorUserId: actor.administratorUserId ?? actor.userId,
      sessionId: actor.id,
      state: "requested",
      revision: 0,
    });
  return toRequest(row, []);
}
export async function readCompanyActionContext(
  tx: Database | Tx,
  userId: string,
  query: Omit<ActionQuery, "cursor"> = {},
) {
  if (query.profileId) await assertDocumentProfileTarget(tx, userId, query.profileId);
  let selectedDocument: typeof documents.$inferSelect | undefined;
  if (query.documentId) {
    [selectedDocument] = await tx
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.userId, userId),
          eq(documents.id, query.documentId),
          isNull(documents.deletedAt),
        ),
      )
      .limit(1);
    if (!selectedDocument || ["deleting", "deleted"].includes(selectedDocument.state))
      throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
    if (query.profileId && query.profileId !== (selectedDocument.managedProfileId ?? "self"))
      throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
  }
  const profileFilter = selectedDocument
    ? (selectedDocument.managedProfileId ?? "self")
    : query.profileId;
  // This helper also runs under a PostgreSQL transaction: one connection must not
  // receive concurrent queries, even though the reads are independent.
  const holder = await readDocumentProfile(tx, userId);
  const subjects = await tx
    .select()
    .from(managedProfiles)
    .where(eq(managedProfiles.userId, userId))
    .limit(50);
  const originals = await tx
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.userId, userId),
        isNull(documents.deletedAt),
        eq(documents.state, "ready"),
        assignedDocumentCondition(),
        profileFilter
          ? profileFilter === "self"
            ? isNull(documents.managedProfileId)
            : eq(documents.managedProfileId, profileFilter)
          : undefined,
      ),
    )
    .orderBy(desc(documents.createdAt), desc(documents.id))
    .limit(201);
  const requestRows = await tx
    .select()
    .from(companyServiceRequests)
    .where(
      and(
        eq(companyServiceRequests.userId, userId),
        profileFilter ? eq(companyServiceRequests.profileId, profileFilter) : undefined,
      ),
    )
    .orderBy(desc(companyServiceRequests.createdAt), desc(companyServiceRequests.id))
    .limit(1001);
  const incomplete = originals.length > 200 || requestRows.length > 1000;
  const rows = requestRows.slice(0, 1000);
  const evidence = await evidenceFor(tx, rows);
  const requests = rows.map((row) => toRequest(row, evidence));
  const profiles = new Map<
    string,
    {
      name: string;
      kind: "person" | "legal_entity";
      revision: number;
      values: Record<string, unknown>;
    }
  >();
  const holderValues = Object.fromEntries(
    Object.entries(holder.fields).flatMap(([field, value]) =>
      value?.value ? [[field, value.value]] : [],
    ),
  );
  profiles.set("self", {
    name: [holderValues.firstName, holderValues.lastName].filter(Boolean).join(" ") || "—",
    kind: "person",
    revision: holder.revision,
    values: holderValues,
  });
  const requiredProfiles = new Set(
    [
      ...originals.slice(0, 200).map((row) => row.managedProfileId),
      ...rows.map((row) => row.managedProfileId),
    ].filter((id): id is string => !!id),
  );
  for (const subject of subjects.filter((item) => requiredProfiles.has(item.id)))
    profiles.set(subject.id, {
      name: subject.displayName,
      ...(await readManagedDocumentProfile(tx, userId, subject.id)),
    });
  const corrections = await readDocumentFieldCorrections(
    tx,
    userId,
    originals.slice(0, 200).map((row) => row.id),
  );
  const observations = new Map<string, CompanyActionObservation[]>();
  const keys = new Map<
    string,
    { profileId: string; companyId: ServiceRequest["companyId"]; group: CompanyAction["group"] }
  >();
  const documentKeys = new Set<string>();
  const synchronizations: DocumentSynchronization[] = [];
  const reviewSources: {
    profileId: string;
    profileName: string;
    group: DocumentReviewGroup;
    documentId: string;
    title: string;
    companyId: ServiceRequest["companyId"] | null;
    policyNumber: string | null;
  }[] = [];
  for (const row of originals.slice(0, 200)) {
    const facts = row.analysis?.insurance;
    const profileId = row.managedProfileId ?? "self";
    const profile = profiles.get(profileId);
    if (!profile) continue;
    const groups = buildDocumentGroups(row, profile, corrections);
    for (const group of groups) {
      if (group.canSync)
        reviewSources.push({
          profileId,
          profileName: profile.name,
          group,
          documentId: row.id,
          title: documentPresentation(row).title ?? row.name,
          companyId: facts?.companySource ? facts.companyId : null,
          policyNumber: facts?.policyNumber?.value ?? null,
        });
      if (group.canSync && group.different && !selectedDocument) {
        synchronizations.push({
          id: `sync:${row.id}:${group.id}`,
          documentId: row.id,
          documentTitle: documentPresentation(row).title ?? row.name,
          profileId,
          profileName: profile.name,
          group,
        });
      }
      // Profile synchronization does not establish a company relationship. Notifications
      // still require a structured and sourced issuer from the document analysis.
      if (!facts?.companyId || !facts.companySource) continue;
      const profileShape =
        profile.kind === "legal_entity"
          ? entityProfileValuesSchema.shape
          : profileValuesSchema.shape;
      if (group.fields.some((field) => !Object.hasOwn(profileShape, field.field))) continue;
      const groupId = companyActionGroupSchema.safeParse(group.id);
      if (!groupId.success) continue;
      const values = companyGroupValues(
        Object.fromEntries(group.fields.map((field) => [field.field, field.value])),
        groupId.data,
      );
      if (!Object.keys(values).length) continue;
      const key = groupKey(profileId, facts.companyId, groupId.data);
      keys.set(key, { profileId, companyId: facts.companyId, group: groupId.data });
      const list = observations.get(key) ?? [];
      const ambiguous = group.fields.some((field) =>
        group.fields.some(
          (other) => other.field === field.field && !sameProfileValue(other.value, field.value),
        ),
      );
      list.push({
        documentId: row.id,
        documentTitle: documentPresentation(row).title ?? row.name,
        values,
        ambiguous,
        recordedAt: row.updatedAt.toISOString(),
        documentDate: null,
      });
      observations.set(key, list);
      if (selectedDocument?.id === row.id) documentKeys.add(key);
    }
  }
  for (const row of rows)
    keys.set(requestKey(row), {
      profileId: row.profileId,
      companyId: row.companyId,
      group: row.group,
    });
  const actions: CompanyAction[] = [];
  for (const [key, item] of keys) {
    if (selectedDocument && !documentKeys.has(key)) continue;
    const profile = profiles.get(item.profileId);
    if (!profile) continue;
    const currentValues = companyGroupValues(profile.values, item.group);
    actions.push(
      companyActionProjection({
        ...item,
        profileName: profile.name,
        profileRevision: profile.revision,
        currentValues,
        observations: observations.get(key) ?? [],
        requests: requests
          .filter((request) => requestKey(request) === key)
          .map((request) =>
            companyValuesHash(request.values) === companyValuesHash(currentValues)
              ? request
              : { ...request, superseded: true, allowedTransitions: [] },
          ),
      }),
    );
  }
  return {
    actions: actions
      .map((action) =>
        incomplete
          ? { ...action, status: "needs_review" as const, evidence: null, canRequest: false }
          : action,
      )
      .sort((a, b) => a.id.localeCompare(b.id)),
    incomplete,
    synchronizations,
    reviewSources,
    profiles,
    subjects,
  };
}

export function createCompanyActionRepository(db: Database) {
  async function command(
    actor: ProfileActor,
    operation: "request" | "transition",
    input: unknown,
    rawKey: string,
    run: (tx: Tx) => Promise<ServiceRequest>,
    prerequisite?: (tx: Tx) => Promise<void>,
  ) {
    const parsedKey = z.uuid().safeParse(rawKey);
    if (!parsedKey.success) throw invalid();
    const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const actorUserId = actor.administratorUserId ?? actor.userId;
    return db.transaction(async (tx) => {
      await lockProfileActor(tx, actor);
      // Current authorization also applies to an idempotent replay.
      await prerequisite?.(tx);
      const now = new Date();
      const [existing] = await tx
        .select()
        .from(companyActionCommands)
        .where(
          and(
            eq(companyActionCommands.userId, actor.userId),
            eq(companyActionCommands.actorUserId, actorUserId),
            eq(companyActionCommands.operation, operation),
            eq(companyActionCommands.key, parsedKey.data),
          ),
        )
        .limit(1);
      if (existing && existing.expiresAt > now) {
        if (existing.requestHash !== hash)
          throw new DocumentError("DOCUMENT_IDEMPOTENCY_REUSED", 422);
        return serviceRequestSchema.parse(existing.response);
      }
      if (existing)
        await tx.delete(companyActionCommands).where(eq(companyActionCommands.id, existing.id));
      const result = await run(tx);
      await tx.insert(companyActionCommands).values({
        id: randomUUID(),
        userId: actor.userId,
        actorUserId,
        sessionId: actor.id,
        operation,
        key: parsedKey.data,
        requestHash: hash,
        response: result,
        expiresAt: new Date(now.getTime() + 86400000),
      });
      await tx.insert(companyActionAudit).values({
        id: randomUUID(),
        userId: actor.userId,
        requestId: result.id,
        actorUserId,
        sessionId: actor.id,
        state: result.state,
        revision: result.revision,
      });
      return result;
    });
  }
  return {
    async list(userId: string, input: ActionQuery = {}) {
      const query = companyActionsQuerySchema.parse(input);
      const scope = `${query.profileId ?? "all"}:${query.documentId ?? "all"}`;
      const cursor = cursorValue(
        query.cursor,
        z.object({ id: z.string().max(200), scope: z.string().max(200) }).strict(),
      );
      if (cursor && cursor.scope !== scope) throw invalid();
      const projected = await readCompanyActionContext(db, userId, query);
      const visible = [
        ...projected.actions
          .filter((action) => query.documentId || action.status !== "current")
          .map((action) => ({ id: action.id, action })),
        ...projected.synchronizations.map((synchronization) => ({
          id: synchronization.id,
          synchronization,
        })),
      ]
        .filter((item) => !cursor || item.id.localeCompare(cursor.id) > 0)
        .sort((a, b) => a.id.localeCompare(b.id));
      const page = visible.slice(0, 20);
      return companyActionsSchema.parse({
        actions: page.flatMap((item) => ("action" in item ? [item.action] : [])),
        synchronizations: page.flatMap((item) =>
          "synchronization" in item ? [item.synchronization] : [],
        ),
        incomplete: projected.incomplete,
        nextCursor: visible.length > 20 ? encode({ id: page.at(-1)!.id, scope }) : null,
      });
    },
    request(actor: ProfileActor, input: CompanyActionRequestInput, key: string) {
      if (actor.administratorUserId) throw invalid();
      const parsed = companyActionRequestInputSchema.parse(input);
      return command(
        actor,
        "request",
        parsed,
        key,
        async (tx) => {
          const projected = await readCompanyActionContext(tx, actor.userId, {
            profileId: parsed.profileId,
          });
          const action = projected.actions.find(
            (item) => item.companyId === parsed.companyId && item.group === parsed.group,
          );
          if (
            !action ||
            action.profileRevision !== parsed.profileRevision ||
            companyValuesHash(action.currentValues) !== companyValuesHash(parsed.values)
          )
            throw conflict();
          if (action.request && ["requested", "in_progress"].includes(action.status))
            return action.request;
          if (!action.canRequest || projected.incomplete) throw invalid();
          return requestCompanyAction(tx, actor, action);
        },
        async (tx) => {
          const status = await readAuthorizationStatus(tx, actor.userId, parsed.profileId);
          if (!status.mandate.signedAt) throw new DocumentError("DOCUMENT_MANDATE_REQUIRED", 409);
        },
      );
    },
    async adminList(input: AdminQuery = {}) {
      const query = serviceRequestsQuerySchema.parse(input);
      const cursor = cursorValue(
        query.cursor,
        z.object({ at: z.iso.datetime(), id: z.uuid(), state: z.string() }).strict(),
      );
      if (cursor && cursor.state !== (query.state ?? "all")) throw invalid();
      const rows = await db
        .select()
        .from(companyServiceRequests)
        .where(
          and(
            query.state ? eq(companyServiceRequests.state, query.state) : undefined,
            cursor
              ? or(
                  lt(companyServiceRequests.createdAt, new Date(cursor.at)),
                  and(
                    eq(companyServiceRequests.createdAt, new Date(cursor.at)),
                    lt(companyServiceRequests.id, cursor.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(companyServiceRequests.createdAt), desc(companyServiceRequests.id))
        .limit(21);
      const page = rows.slice(0, 20);
      const evidence = await evidenceFor(db, page);
      const last = page.at(-1);
      const rendered: ServiceRequest[] = [];
      for (const row of page)
        rendered.push(toRequest(row, evidence, await requestSuperseded(db, row)));
      return serviceRequestsSchema.parse({
        requests: rendered,
        nextCursor:
          rows.length > 20 && last
            ? encode({ at: last.createdAt.toISOString(), id: last.id, state: query.state ?? "all" })
            : null,
      });
    },
    transition(actor: ProfileActor, input: ServiceRequestTransitionInput, key: string) {
      if (!actor.administratorUserId || actor.userId !== input.userId) throw invalid();
      const parsed = serviceRequestTransitionInputSchema.parse(input);
      return command(
        actor,
        "transition",
        parsed,
        key,
        async (tx) => {
          const [row] = await tx
            .select()
            .from(companyServiceRequests)
            .where(
              and(
                eq(companyServiceRequests.userId, actor.userId),
                eq(companyServiceRequests.id, parsed.id),
              ),
            )
            .limit(1)
            .for("update");
          if (!row) throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
          if (row.revision !== parsed.revision) throw conflict();
          const evidence = await evidenceFor(tx, [row]);
          if (
            !toRequest(row, evidence, await requestSuperseded(tx, row)).allowedTransitions.includes(
              parsed.state,
            )
          )
            throw conflict();
          const now = new Date();
          if (parsed.evidence) {
            const occurredAt = new Date(parsed.evidence.occurredAt);
            if (occurredAt > now || (evidence[0] && occurredAt < evidence[0].occurredAt))
              throw invalid();
            await tx.insert(companyActionEvidence).values({
              id: randomUUID(),
              userId: actor.userId,
              requestId: row.id,
              kind: parsed.state as "notified" | "confirmed",
              occurredAt,
              recordedAt: now,
              reference: parsed.evidence.reference,
              administratorUserId: actor.administratorUserId!,
            });
          }
          const [updated] = await tx
            .update(companyServiceRequests)
            .set({ state: parsed.state, revision: row.revision + 1, updatedAt: now })
            .where(
              and(
                eq(companyServiceRequests.userId, actor.userId),
                eq(companyServiceRequests.id, row.id),
              ),
            )
            .returning();
          if (!updated) throw new Error("Company service request transition failed");
          return toRequest(updated, await evidenceFor(tx, [updated]));
        },
        async (tx) => {
          if (parsed.state !== "notified" && parsed.state !== "confirmed") return;
          const [row] = await tx
            .select({ profileId: companyServiceRequests.profileId })
            .from(companyServiceRequests)
            .where(
              and(
                eq(companyServiceRequests.userId, actor.userId),
                eq(companyServiceRequests.id, parsed.id),
              ),
            )
            .limit(1);
          if (!row) throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
          const status = await readAuthorizationStatus(tx, actor.userId, row.profileId);
          if (!status.mandate.signedAt) throw new DocumentError("DOCUMENT_MANDATE_REQUIRED", 409);
        },
      );
    },
    async purgeExpiredCommands() {
      await db
        .delete(companyActionCommands)
        .where(
          inArray(
            companyActionCommands.id,
            db
              .select({ id: companyActionCommands.id })
              .from(companyActionCommands)
              .where(lte(companyActionCommands.expiresAt, new Date()))
              .orderBy(asc(companyActionCommands.expiresAt), asc(companyActionCommands.id))
              .limit(100),
          ),
        );
    },
  };
}
