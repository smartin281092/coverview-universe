import { createHash, randomUUID } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import {
  documentSchema,
  documentSummarySchema,
  documentListSchema,
  documentListQuerySchema,
  documentReviewResultSchema,
  documentProfileValuesSchema,
  profileFieldSchema,
  documentChangeRequestSchema,
  documentChangeRequestsSchema,
  documentProfileDifferencesSchema,
  type DocumentCreateInput,
  type DocumentReviewInput,
  type DocumentRecord,
  type DocumentAnalysis,
  type InsuranceCompanyId,
} from "@coverview/contracts";
import {
  lockProfileActor,
  toProfile,
  confirmDocumentProfileFields,
  identityUsers,
  IdentityError,
  readDocumentProfile,
  lockDocumentProfile,
  enrichDocumentProfile,
  type ProfileActor,
} from "../identity/index.js";
import {
  assertDocumentProfileTarget,
  readManagedDocumentValues,
  enrichManagedDocumentProfile,
} from "../profiles/index.js";
import type { createDatabase } from "../../platform/db/database.js";
import {
  documents,
  documentAudit,
  documentCommands,
  documentDecisions,
  documentOutbox,
  documentAiCalls,
  documentChangeRequests,
} from "./document.schema.js";
import {
  classificationLabels,
  documentPresentation,
  normalizeDocumentSearch,
} from "./document.presentation.js";
import { documentProfileComparisons, sameProfileValue } from "./document.reconciliation.js";
import { referencedCompanyIds, companyLabels } from "./document.companies.js";
import { companyOverview, insuranceDomainLabels } from "./document.insurance.js";
import { DocumentError } from "./document.errors.js";
import {
  createIdentityAttachmentRepository,
  cleanupIdentityAttachmentCommands,
} from "./document.identity-attachment.js";
export { DocumentError } from "./document.errors.js";

type Database = ReturnType<typeof createDatabase>["db"];
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Row = typeof documents.$inferSelect;
type Actor = ProfileActor;
const auditActor = (actor: Actor) =>
  actor.administratorUserId ? `admin:${actor.administratorUserId}:session:${actor.id}` : actor.id;
const targetCondition = (profileId: string) =>
  profileId === "self"
    ? isNull(documents.managedProfileId)
    : eq(documents.managedProfileId, profileId);
const condition = (userId: string, id: string) =>
  and(eq(documents.userId, userId), eq(documents.id, id));
function summary(row: Row) {
  return documentSummarySchema.parse({
    ...row,
    profileId: row.managedProfileId ?? "self",
    ...documentPresentation(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    canRetry: row.state === "failed",
    canDownload:
      !!row.scanVersion && !["pending", "quarantined", "deleting", "deleted"].includes(row.state),
  });
}
async function detail(tx: Tx | Database, row: Row): Promise<DocumentRecord> {
  const managedValues = row.managedProfileId
    ? await readManagedDocumentValues(tx, row.userId, row.managedProfileId)
    : null;
  const profileComparisons = managedValues
    ? (row.analysis?.fields ?? []).flatMap((extraction) => {
        const current = managedValues[extraction.field as keyof typeof managedValues];
        return typeof current === "string"
          ? [
              {
                extractionId: extraction.id,
                currentValue: current,
                different: !sameProfileValue(current, extraction.value),
              },
            ]
          : [];
      })
    : documentProfileComparisons(row.analysis, await readDocumentProfile(tx, row.userId));
  const requests = await tx
    .select()
    .from(documentChangeRequests)
    .where(
      and(
        eq(documentChangeRequests.userId, row.userId),
        eq(documentChangeRequests.documentId, row.id),
        eq(documentChangeRequests.state, "prepared"),
      ),
    )
    .orderBy(desc(documentChangeRequests.createdAt), desc(documentChangeRequests.id))
    .limit(40);
  // Accepted values remain available even beyond the bounded history page.
  const accepted = await tx.execute<{ field: string; value: string }>(sql`
    select distinct on (field->>'field') field->>'field' as field, field->>'value' as value
    from ${documentDecisions}, lateral jsonb_array_elements(${documentDecisions.decision}->'fields') as field
    where ${documentDecisions.userId} = ${row.userId} and ${documentDecisions.documentId} = ${row.id}
      and field->>'value' is not null and field->>'choice' in ('use', 'correct')
    order by field->>'field', ${documentDecisions.createdAt} desc, ${documentDecisions.id} desc limit 15
  `);
  const decisions = await tx
    .select({ decision: documentDecisions.decision })
    .from(documentDecisions)
    .where(and(eq(documentDecisions.userId, row.userId), eq(documentDecisions.documentId, row.id)))
    .orderBy(desc(documentDecisions.createdAt), desc(documentDecisions.id))
    .limit(20);
  return documentSchema.parse({
    ...summary(row),
    analysis: row.analysis,
    decisions: decisions.map((item) => item.decision),
    reviewedValues: accepted.rows,
    profileComparisons,
    changeRequests: requests.map(changeRequest),
  });
}
function changeRequest(row: typeof documentChangeRequests.$inferSelect) {
  return documentChangeRequestSchema.parse({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
const hash = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
async function audit(tx: Tx, row: Row, actor: string, action: string) {
  await tx.insert(documentAudit).values({
    id: randomUUID(),
    documentId: row.id,
    userId: row.userId,
    actor,
    action,
    revision: row.revision,
  });
}
async function event(tx: Tx, row: Row, type: typeof documentOutbox.$inferInsert.type) {
  await tx.insert(documentOutbox).values({
    id: randomUUID(),
    documentId: row.id,
    userId: row.userId,
    generation: row.generation,
    type,
  });
}
function live(row: Row | undefined): Row {
  if (!row || row.deletedAt || ["deleting", "deleted"].includes(row.state))
    throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
  return row;
}
function revision(row: Row, expected: number) {
  if (row.revision !== expected || row.revision >= 2147483646)
    throw new DocumentError("DOCUMENT_CONFLICT", 409);
}
export function createDocumentRepository(db: Database) {
  async function command<T>(
    actor: Actor,
    id: string | null,
    operation: string,
    key: string,
    payload: unknown,
    schema: z.ZodType<T>,
    execute: (
      tx: Tx,
      profile: Awaited<ReturnType<typeof lockProfileActor>>["profile"],
      row: Row | undefined,
    ) => Promise<{ row: Row; response: T }>,
  ): Promise<T> {
    const normalizedKey = z.uuid().parse(key).toLowerCase();
    return db.transaction(async (tx) => {
      const { profile, session } = await lockProfileActor(tx, actor);
      const payloadHash = hash({
        actor: actor.administratorUserId ?? actor.userId,
        administrator: !!actor.administratorUserId,
        payload,
      });
      const row = id
        ? live(
            (
              await tx
                .select()
                .from(documents)
                .where(condition(actor.userId, id))
                .limit(1)
                .for("update")
            )[0],
          )
        : undefined;
      const now = new Date();
      if (session.expiresAt <= now) throw new IdentityError("IDENTITY_UNAUTHENTICATED", 401);
      const [previous] = await tx
        .select()
        .from(documentCommands)
        .where(
          and(
            eq(documentCommands.userId, actor.userId),
            eq(documentCommands.operation, operation),
            eq(documentCommands.key, normalizedKey),
          ),
        )
        .limit(1);
      if (previous) {
        live(
          (
            await tx
              .select()
              .from(documents)
              .where(condition(actor.userId, previous.documentId))
              .limit(1)
          )[0],
        );
        if (previous.expiresAt > now) {
          // Existing owner receipts remain valid during the additive rollout.
          // Administrative commands never replay a receipt made by the owner.
          if (
            previous.hash !== payloadHash &&
            (actor.administratorUserId || previous.hash !== hash(payload))
          )
            throw new DocumentError("DOCUMENT_IDEMPOTENCY_REUSED", 422);
          return schema.parse(previous.response);
        }
        await tx
          .delete(documentCommands)
          .where(
            and(eq(documentCommands.id, previous.id), eq(documentCommands.userId, actor.userId)),
          );
      }
      const result = await execute(tx, profile, row);
      await tx.insert(documentCommands).values({
        id: randomUUID(),
        userId: actor.userId,
        documentId: result.row.id,
        operation,
        key: normalizedKey,
        hash: payloadHash,
        response: result.response,
        expiresAt: new Date(now.getTime() + 86400000),
      });
      await audit(tx, result.row, auditActor(actor), `document.${operation}.v1`);
      return schema.parse(result.response);
    });
  }
  return {
    ...createIdentityAttachmentRepository(db, summary),
    async assertTarget(userId: string, profileId: string, id?: string) {
      await assertDocumentProfileTarget(db, userId, profileId);
      if (id)
        live(
          (
            await db
              .select()
              .from(documents)
              .where(and(condition(userId, id), targetCondition(profileId)))
              .limit(1)
          )[0],
        );
    },
    async profileDifferences(userId: string) {
      const profile = await readDocumentProfile(db, userId);
      const rows = await db
        .select({
          id: documents.id,
          analysis: sql<DocumentAnalysis | null>`case when ${documents.analysis} is null then null else jsonb_build_object('fields', ${documents.analysis}->'fields') end`,
        })
        .from(documents)
        .where(
          and(
            eq(documents.userId, userId),
            isNull(documents.managedProfileId),
            isNull(documents.deletedAt),
            eq(documents.state, "ready"),
          ),
        )
        .orderBy(desc(documents.createdAt), desc(documents.id))
        .limit(200);
      const byField = new Map<string, { field: string; count: number; documentId: string }>();
      for (const row of rows) {
        for (const comparison of documentProfileComparisons(row.analysis, profile).filter(
          (item) => item.different,
        )) {
          const field = row.analysis?.fields.find(
            (item) => item.id === comparison.extractionId,
          )?.field;
          if (!field) continue;
          const current = byField.get(field);
          if (current) current.count += 1;
          else byField.set(field, { field, count: 1, documentId: row.id });
        }
      }
      return documentProfileDifferencesSchema.parse({ fields: [...byField.values()] });
    },
    async changeRequests(userId: string, cursor?: string) {
      let after: { at: string; id: string } | undefined;
      if (cursor) {
        try {
          after = z
            .object({ at: z.iso.datetime(), id: z.uuid() })
            .strict()
            .parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
        } catch {
          throw new DocumentError("DOCUMENT_REVIEW_INVALID", 400);
        }
      }
      const rows = await db
        .select()
        .from(documentChangeRequests)
        .where(
          and(
            eq(documentChangeRequests.userId, userId),
            after
              ? or(
                  lt(documentChangeRequests.createdAt, new Date(after.at)),
                  and(
                    eq(documentChangeRequests.createdAt, new Date(after.at)),
                    lt(documentChangeRequests.id, after.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(documentChangeRequests.createdAt), desc(documentChangeRequests.id))
        .limit(21);
      const last = rows[19];
      return documentChangeRequestsSchema.parse({
        requests: rows.slice(0, 20).map(changeRequest),
        nextCursor:
          rows.length > 20 && last
            ? Buffer.from(
                JSON.stringify({ at: last.createdAt.toISOString(), id: last.id }),
              ).toString("base64url")
            : null,
      });
    },
    cancelChangeRequest(actor: Actor, id: string, requestId: string, key: string) {
      return command(
        actor,
        id,
        "change_request_cancelled",
        key,
        { id, requestId },
        documentChangeRequestSchema,
        async (tx, _profile, current) => {
          const row = live(current);
          const [request] = await tx
            .update(documentChangeRequests)
            .set({ state: "cancelled", updatedAt: new Date() })
            .where(
              and(
                eq(documentChangeRequests.id, requestId),
                eq(documentChangeRequests.userId, actor.userId),
                eq(documentChangeRequests.documentId, id),
              ),
            )
            .returning();
          if (!request) throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
          return { row, response: changeRequest(request) };
        },
      );
    },
    async referencedCompanies(userId: string) {
      const rows = await db
        .select({
          name: documents.name,
          text: sql<string>`coalesce(left(${documents.analysis}->'pages'->0->>'text', 12000), '')`,
        })
        .from(documents)
        .where(
          and(
            eq(documents.userId, userId),
            isNull(documents.managedProfileId),
            isNull(documents.deletedAt),
            ne(documents.state, "deleted"),
          ),
        )
        .orderBy(desc(documents.createdAt), desc(documents.id))
        .limit(201);
      if (rows.length > 200) throw new DocumentError("DOCUMENT_LIMIT_REACHED", 422);
      const requests = await db
        .selectDistinct({ insurer: documentChangeRequests.insurer })
        .from(documentChangeRequests)
        .where(eq(documentChangeRequests.userId, userId))
        .limit(200);
      return {
        companyIds: referencedCompanyIds([
          ...rows.flatMap((row) => [row.name, row.text]),
          ...requests.map((row) => row.insurer),
        ]),
      };
    },
    async list(
      userId: string,
      cursor?: string,
      filters: Omit<z.infer<typeof documentListQuerySchema>, "cursor"> = {},
    ) {
      const query = documentListQuerySchema.parse(filters);
      const profileId = query.profileId ?? "self";
      await assertDocumentProfileTarget(db, userId, profileId);
      const fingerprint = hash({
        profileId,
        q: query.q ?? "",
        classification: query.classification,
        group: query.group ?? "date",
        sort: query.sort ?? "newest",
      });
      let position:
        { at?: string | undefined; id: string; fingerprint?: string | undefined } | undefined;
      if (cursor) {
        try {
          position = z
            .object({
              at: z.iso.datetime().optional(),
              id: z.string().regex(/^doc_[0-9a-f-]{36}$/),
              fingerprint: z.string().optional(),
            })
            .strict()
            .parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
        } catch (cause) {
          throw new DocumentError("DOCUMENT_NOT_FOUND", 400, { cause });
        }
      }
      const rows = await db
        .select({
          ...getTableColumns(documents),
          analysis: sql<Row["analysis"]>`case when ${documents.analysis} is null then null else
            (${documents.analysis} - 'fields' - 'pages') || jsonb_build_object('fields', '[]'::jsonb, 'pages',
              jsonb_build_array((${documents.analysis}->'pages'->0) || jsonb_build_object('text', left(${documents.analysis}->'pages'->0->>'text', 12000)))) end`,
        })
        .from(documents)
        .where(
          and(
            eq(documents.userId, userId),
            targetCondition(profileId),
            isNull(documents.deletedAt),
            ne(documents.state, "deleted"),
          ),
        )
        .orderBy(desc(documents.createdAt), desc(documents.id))
        .limit(201);
      if (rows.length > 200) throw new DocumentError("DOCUMENT_LIMIT_REACHED", 422);
      const needle = normalizeDocumentSearch(query.q ?? "");
      const entries = rows.map(summary).filter((item) => {
        const classification = item.classification ?? item.category;
        return (
          (!query.classification || classification === query.classification) &&
          normalizeDocumentSearch(
            `${item.title ?? ""} ${item.name} ${classificationLabels[classification]} ${item.companyId ? companyLabels[item.companyId] : ""} ${item.insuranceDomain ? insuranceDomainLabels[item.insuranceDomain] : ""}`,
          ).includes(needle)
        );
      });
      const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });
      entries.sort((a, b) => {
        const groupOrder =
          query.group === "type"
            ? collator.compare(
                classificationLabels[a.classification ?? a.category],
                classificationLabels[b.classification ?? b.category],
              )
            : (query.sort === "oldest" ? 1 : -1) *
              a.createdAt.slice(0, 7).localeCompare(b.createdAt.slice(0, 7));
        if (groupOrder) return groupOrder;
        const order =
          query.sort === "title"
            ? collator.compare(
                a.title ?? classificationLabels[a.classification ?? a.category],
                b.title ?? classificationLabels[b.classification ?? b.category],
              )
            : (query.sort === "oldest" ? 1 : -1) * a.createdAt.localeCompare(b.createdAt);
        return order || b.id.localeCompare(a.id);
      });
      if (position?.fingerprint && position.fingerprint !== fingerprint)
        throw new DocumentError("DOCUMENT_NOT_FOUND", 400);
      const index = position ? entries.findIndex((item) => item.id === position.id) : -1;
      if (position && index < 0) throw new DocumentError("DOCUMENT_NOT_FOUND", 400);
      const page = entries.slice(index + 1, index + 21);
      const last = page.at(-1);
      return documentListSchema.parse({
        documents: page,
        total: entries.length,
        nextCursor:
          entries.length > index + 21 && last
            ? Buffer.from(JSON.stringify({ id: last.id, fingerprint })).toString("base64url")
            : null,
      });
    },
    async insuranceCompany(userId: string, companyId: InsuranceCompanyId) {
      const rows = await db
        .select({
          ...getTableColumns(documents),
          analysis: sql<Row["analysis"]>`case when ${documents.analysis} is null then null else
          (${documents.analysis} - 'fields' - 'pages') || jsonb_build_object('fields', '[]'::jsonb, 'pages',
            jsonb_build_array((${documents.analysis}->'pages'->0) || jsonb_build_object('text', left(${documents.analysis}->'pages'->0->>'text', 12000)))) end`,
        })
        .from(documents)
        .where(
          and(
            eq(documents.userId, userId),
            isNull(documents.managedProfileId),
            isNull(documents.deletedAt),
            ne(documents.state, "deleted"),
          ),
        )
        .orderBy(desc(documents.createdAt), desc(documents.id))
        .limit(201);
      if (rows.length > 200) throw new DocumentError("DOCUMENT_LIMIT_REACHED", 422);
      return companyOverview(
        companyId,
        rows.map((row) => ({ document: summary(row), analysis: row.analysis })),
      );
    },
    async get(userId: string, id: string) {
      return detail(
        db,
        live((await db.select().from(documents).where(condition(userId, id)).limit(1))[0]),
      );
    },
    async original(userId: string, id: string) {
      return live((await db.select().from(documents).where(condition(userId, id)).limit(1))[0]);
    },
    async authorizeUpload(actor: Actor, id: string) {
      await db.transaction(async (tx) => {
        await lockProfileActor(tx, actor);
        live((await tx.select().from(documents).where(condition(actor.userId, id)).limit(1))[0]);
      });
    },
    create(actor: Actor, input: DocumentCreateInput, key: string) {
      return command(actor, null, "created", key, input, documentSchema, async (tx) => {
        const profileId = input.profileId ?? "self";
        await assertDocumentProfileTarget(tx, actor.userId, profileId);
        const count = await tx
          .select({ id: documents.id })
          .from(documents)
          .where(and(eq(documents.userId, actor.userId), isNull(documents.deletedAt)))
          .limit(201);
        if (count.length >= 200) throw new DocumentError("DOCUMENT_LIMIT_REACHED", 422);
        const id = `doc_${randomUUID()}`;
        const [row] = await tx
          .insert(documents)
          .values({
            ...input,
            category: input.purpose === "identity_card" ? "identity" : "unknown",
            id,
            userId: actor.userId,
            managedProfileId: profileId === "self" ? null : profileId,
            declaredMime: input.mime,
            mime: "application/octet-stream",
            objectKey: `documents/${id}/original`,
          })
          .returning();
        if (!row) throw new Error("Document insert failed");
        return { row, response: await detail(tx, row) };
      });
    },
    async uploaded(actor: Actor, id: string, mime: string) {
      return db.transaction(async (tx) => {
        const { session } = await lockProfileActor(tx, actor);
        const row = live(
          (
            await tx
              .select()
              .from(documents)
              .where(condition(actor.userId, id))
              .limit(1)
              .for("update")
          )[0],
        );
        if (session.expiresAt <= new Date())
          throw new IdentityError("IDENTITY_UNAUTHENTICATED", 401);
        if (row.state !== "pending") return detail(tx, row);
        const [updated] = await tx
          .update(documents)
          .set({
            mime,
            state: "queued",
            revision: row.revision + 1,
            generation: row.generation + 1,
            updatedAt: new Date(),
          })
          .where(condition(actor.userId, id))
          .returning();
        if (!updated) throw new Error("Document update failed");
        await event(tx, updated, "document.uploaded.v1");
        await audit(tx, updated, auditActor(actor), "document.uploaded.v1");
        return detail(tx, updated);
      });
    },
    retry(actor: Actor, id: string, expected: number, analysisRequested: boolean, key: string) {
      return command(
        actor,
        id,
        "retry_requested",
        key,
        { id, expected, analysisRequested },
        documentSchema,
        async (tx, _, current) => {
          const row = live(current);
          revision(row, expected);
          if (row.state !== "failed" && !(row.state === "ready" && analysisRequested))
            throw new DocumentError("DOCUMENT_CONFLICT", 409);
          const [updated] = await tx
            .update(documents)
            .set({
              state: "queued",
              failure: null,
              analysisRequested,
              revision: row.revision + 1,
              generation: row.generation + 1,
              updatedAt: new Date(),
            })
            .where(condition(actor.userId, id))
            .returning();
          if (!updated) throw new Error("Document update failed");
          await event(tx, updated, "document.retry_requested.v1");
          return { row: updated, response: await detail(tx, updated) };
        },
      );
    },
    categorize(
      actor: Actor,
      id: string,
      input: { revision: number; category: Row["category"] },
      key: string,
    ) {
      return command(
        actor,
        id,
        "categorized",
        key,
        { id, ...input },
        documentSchema,
        async (tx, _, current) => {
          const row = live(current);
          revision(row, input.revision);
          if (!["ready", "failed"].includes(row.state))
            throw new DocumentError("DOCUMENT_CONFLICT", 409);
          const now = new Date();
          const [updated] = await tx
            .update(documents)
            .set({
              category: input.category,
              categoryCorrected: true,
              revision: row.revision + 1,
              updatedAt: now,
            })
            .where(condition(actor.userId, id))
            .returning();
          if (!updated) throw new Error("Document update failed");
          const decision = {
            id: randomUUID(),
            action: "category" as const,
            at: now.toISOString(),
            category: input.category,
            fields: [],
          };
          await tx.insert(documentDecisions).values({
            id: decision.id,
            documentId: id,
            userId: actor.userId,
            sessionId: actor.id,
            revision: updated.revision,
            decision,
            createdAt: now,
          });
          return { row: updated, response: await detail(tx, updated) };
        },
      );
    },
    review(actor: Actor, id: string, input: DocumentReviewInput, key: string) {
      return command(
        actor,
        id,
        "reviewed",
        key,
        { id, ...input },
        documentReviewResultSchema,
        async (tx, profile, current) => {
          const row = live(current);
          if (row.managedProfileId || actor.administratorUserId)
            throw new DocumentError("DOCUMENT_REVIEW_INVALID", 422);
          revision(row, input.revision);
          if (
            row.state !== "ready" ||
            profile.revision !== input.profileRevision ||
            new Set(input.decisions.map((item) => item.extractionId)).size !==
              input.decisions.length
          )
            throw new DocumentError("DOCUMENT_CONFLICT", 409);
          const values: Record<string, string> = {};
          const seen = new Set<string>();
          const fields = input.decisions.map((item) => {
            const extraction = row.analysis?.fields.find((field) => field.id === item.extractionId);
            if (!extraction || seen.has(extraction.field))
              throw new DocumentError("DOCUMENT_REVIEW_INVALID", 422);
            seen.add(extraction.field);
            if (item.choice !== "keep" && !input.concernsMe)
              throw new DocumentError("DOCUMENT_REVIEW_INVALID", 422);
            const value =
              item.choice === "keep"
                ? null
                : item.choice === "correct"
                  ? item.value
                  : extraction.value;
            if (item.choice !== "keep" && !value)
              throw new DocumentError("DOCUMENT_REVIEW_INVALID", 422);
            if (
              value &&
              ["expiresOn", "birthDate"].includes(extraction.field) &&
              !z.iso.date().safeParse(value).success
            )
              throw new DocumentError("DOCUMENT_REVIEW_INVALID", 422);
            if (value && profileFieldSchema.safeParse(extraction.field).success)
              values[extraction.field] = value;
            return {
              field: extraction.field,
              choice: item.choice,
              value: value ?? null,
              source: extraction.source,
            };
          });
          const validValues = documentProfileValuesSchema.safeParse(values);
          if (!validValues.success) throw new DocumentError("DOCUMENT_REVIEW_INVALID", 422);
          const updatedProfile = Object.keys(values).length
            ? await confirmDocumentProfileFields(tx, profile, validValues.data)
            : toProfile(profile);
          if (input.notification) {
            if (!input.concernsMe || input.decisions.length !== 1)
              throw new DocumentError("DOCUMENT_REVIEW_INVALID", 422);
            const extraction = row.analysis?.fields.find(
              (item) => item.id === input.decisions[0]?.extractionId,
            );
            const field = profileFieldSchema.safeParse(extraction?.field);
            const requested = field.success ? updatedProfile.fields[field.data]?.value : undefined;
            if (
              !extraction ||
              !field.success ||
              !requested ||
              sameProfileValue(requested, extraction.value)
            )
              throw new DocumentError("DOCUMENT_REVIEW_INVALID", 422);
            const [existing] = await tx
              .select()
              .from(documentChangeRequests)
              .where(
                and(
                  eq(documentChangeRequests.userId, actor.userId),
                  eq(documentChangeRequests.documentId, id),
                  eq(documentChangeRequests.extractionId, extraction.id),
                  eq(documentChangeRequests.state, "prepared"),
                ),
              )
              .limit(1);
            if (
              existing &&
              (existing.requestedValue !== requested ||
                existing.insurer !== input.notification.insurer)
            )
              throw new DocumentError("DOCUMENT_CONFLICT", 409);
            if (!existing)
              await tx.insert(documentChangeRequests).values({
                id: randomUUID(),
                userId: actor.userId,
                documentId: id,
                extractionId: extraction.id,
                field: field.data,
                previousValue: extraction.value,
                requestedValue: requested,
                insurer: input.notification.insurer,
              });
          }
          const now = new Date();
          const [updated] = await tx
            .update(documents)
            .set({ revision: row.revision + 1, updatedAt: now })
            .where(condition(actor.userId, id))
            .returning();
          if (!updated) throw new Error("Document update failed");
          const decision = {
            id: randomUUID(),
            action: "review" as const,
            at: now.toISOString(),
            category: null,
            fields,
          };
          await tx.insert(documentDecisions).values({
            id: decision.id,
            documentId: id,
            userId: actor.userId,
            sessionId: actor.id,
            revision: updated.revision,
            decision,
            createdAt: now,
          });
          return {
            row: updated,
            response: { document: await detail(tx, updated), profile: updatedProfile },
          };
        },
      );
    },
    async remove(actor: Actor, id: string) {
      await db.transaction(async (tx) => {
        const { session } = await lockProfileActor(tx, actor);
        const [row] = await tx
          .select()
          .from(documents)
          .where(condition(actor.userId, id))
          .limit(1)
          .for("update");
        if (session.expiresAt <= new Date())
          throw new IdentityError("IDENTITY_UNAUTHENTICATED", 401);
        if (!row) throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
        if (row.deletedAt) return;
        const [updated] = await tx
          .update(documents)
          .set({
            state: "deleting",
            deletedAt: new Date(),
            analysis: null,
            revision: row.revision + 1,
            generation: row.generation + 1,
            updatedAt: new Date(),
          })
          .where(condition(actor.userId, id))
          .returning();
        if (!updated) throw new Error("Document update failed");
        // Keep only field names and owner decisions as provenance of surviving profile fields.
        await tx
          .delete(documentChangeRequests)
          .where(
            and(
              eq(documentChangeRequests.userId, actor.userId),
              eq(documentChangeRequests.documentId, id),
            ),
          );
        await tx
          .update(documentDecisions)
          .set({
            decision: sql`jsonb_set(${documentDecisions.decision}, '{fields}', coalesce((
            select jsonb_agg(field || '{"value":null,"source":null}'::jsonb)
            from jsonb_array_elements(${documentDecisions.decision}->'fields') as field
          ), '[]'::jsonb))`,
          })
          .where(
            and(eq(documentDecisions.userId, actor.userId), eq(documentDecisions.documentId, id)),
          );
        // Empty tombstones preserve creation idempotency without keeping private snapshots.
        await tx
          .update(documentCommands)
          .set({ response: {} })
          .where(
            and(eq(documentCommands.userId, actor.userId), eq(documentCommands.documentId, id)),
          );
        await audit(tx, updated, auditActor(actor), "document.deletion_requested.v1");
        await event(tx, updated, "document.deletion_requested.v1");
      });
    },
    async access(actor: Actor, id: string) {
      await db.transaction(async (tx) => {
        const { session } = await lockProfileActor(tx, actor);
        const row = live(
          (await tx.select().from(documents).where(condition(actor.userId, id)).limit(1))[0],
        );
        if (session.expiresAt <= new Date())
          throw new IdentityError("IDENTITY_UNAUTHENTICATED", 401);
        if (!summary(row).canDownload) throw new DocumentError("DOCUMENT_DOWNLOAD_BLOCKED", 422);
        await audit(tx, row, auditActor(actor), "document.downloaded.v1");
      });
    },
    async pendingEvents() {
      return db
        .select()
        .from(documentOutbox)
        .where(isNull(documentOutbox.publishedAt))
        .orderBy(asc(documentOutbox.createdAt), asc(documentOutbox.id))
        .limit(50);
    },
    async published(id: string) {
      await db
        .update(documentOutbox)
        .set({ publishedAt: new Date() })
        .where(eq(documentOutbox.id, id));
    },
    async jobRow(userId: string, id: string, generation: number) {
      const [row] = await db
        .select()
        .from(documents)
        .where(and(condition(userId, id), eq(documents.generation, generation)))
        .limit(1);
      return row;
    },
    async transition(
      userId: string,
      id: string,
      generation: number,
      patch: Partial<Pick<Row, "state" | "analysis" | "failure" | "scanVersion" | "category">>,
    ) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(documents)
          .where(
            and(
              condition(userId, id),
              eq(documents.generation, generation),
              isNull(documents.deletedAt),
            ),
          )
          .limit(1)
          .for("update");
        if (!row || ["ready", "quarantined"].includes(row.state)) return false;
        const [updated] = await tx
          .update(documents)
          .set({
            ...patch,
            ...(row.categoryCorrected ? { category: row.category } : {}),
            revision: row.revision + 1,
            updatedAt: new Date(),
          })
          .where(condition(userId, id))
          .returning();
        if (updated)
          await audit(
            tx,
            updated,
            "system:document-worker",
            `document.${patch.state ?? "processed"}.v1`,
          );
        return !!updated;
      });
    },
    async finishDelete(userId: string, id: string, generation: number) {
      await db.transaction(async (tx) => {
        const [row] = await tx
          .update(documents)
          .set({
            state: "deleted",
            name: "",
            mime: "application/octet-stream",
            declaredMime: "",
            size: 0,
            checksum: "0".repeat(64),
            category: "unknown",
            analysis: null,
            failure: null,
            scanVersion: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              condition(userId, id),
              eq(documents.generation, generation),
              eq(documents.state, "deleting"),
            ),
          )
          .returning();
        if (row) await audit(tx, row, "system:document-worker", "document.deleted.v1");
      });
    },
    async reserveAi(userId: string, id: string, generation: number, model: string, limit: number) {
      return db.transaction(async (tx) => {
        const [owner] = await tx
          .select({ id: identityUsers.id })
          .from(identityUsers)
          .where(eq(identityUsers.id, userId))
          .for("no key update")
          .limit(1);
        if (!owner) throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
        const row = live(
          (
            await tx
              .select()
              .from(documents)
              .where(and(condition(userId, id), eq(documents.generation, generation)))
              .limit(1)
              .for("update")
          )[0],
        );
        if (row.state !== "reading") throw new DocumentError("DOCUMENT_CONFLICT", 409);
        const callId = `call_${hash({ userId, id, generation })}`;
        const [existing] = await tx
          .select({ id: documentAiCalls.id })
          .from(documentAiCalls)
          .where(and(eq(documentAiCalls.id, callId), eq(documentAiCalls.userId, userId)))
          .limit(1);
        if (existing) return { id: callId, existing: true };
        const calls = await tx
          .select({ id: documentAiCalls.id })
          .from(documentAiCalls)
          .where(
            and(
              eq(documentAiCalls.userId, userId),
              gte(documentAiCalls.createdAt, new Date(Date.now() - 86400000)),
            ),
          )
          .limit(limit);
        if (calls.length >= limit) return null;
        await tx.insert(documentAiCalls).values({ id: callId, userId, documentId: id, model });
        return { id: callId, existing: false };
      });
    },
    async completeAnalysis(
      userId: string,
      id: string,
      generation: number,
      callId: string,
      analysis: DocumentAnalysis,
      usage: { inputTokens: number; outputTokens: number; model: string },
    ) {
      await db.transaction(async (tx) => {
        const profile = await lockDocumentProfile(tx, userId);
        const [row] = await tx
          .select()
          .from(documents)
          .where(and(condition(userId, id), eq(documents.generation, generation)))
          .limit(1)
          .for("update");
        await tx
          .update(documentAiCalls)
          .set({
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            model: usage.model,
          })
          .where(
            and(
              eq(documentAiCalls.id, callId),
              eq(documentAiCalls.userId, userId),
              eq(documentAiCalls.documentId, id),
            ),
          );
        if (!row || row.deletedAt || row.state !== "reading") return;
        if (row.managedProfileId && profile)
          await enrichManagedDocumentProfile(tx, userId, row.managedProfileId, id, analysis.fields);
        else if (!row.managedProfileId && profile)
          await enrichDocumentProfile(tx, profile, id, analysis.fields);
        const [updated] = await tx
          .update(documents)
          .set({
            analysis,
            state: "ready",
            failure: null,
            category: row.categoryCorrected ? row.category : analysis.category,
            revision: row.revision + 1,
            updatedAt: new Date(),
          })
          .where(condition(userId, id))
          .returning();
        if (updated) await audit(tx, updated, "system:document-worker", "document.ready.v1");
      });
    },
    async recover() {
      // Redis is transport only. Re-enqueue stale work from PostgreSQL after queue loss.
      // Keep the logical generation so an uncertain provider call cannot be billed again automatically.
      await db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(documents)
          .where(
            and(
              inArray(documents.state, ["queued", "scanning", "reading", "deleting"]),
              lt(documents.updatedAt, new Date(Date.now() - 600000)),
            ),
          )
          .orderBy(asc(documents.updatedAt), asc(documents.id))
          .limit(20)
          .for("update", { skipLocked: true });
        for (const row of rows) {
          const [updated] = await tx
            .update(documents)
            .set({
              state: row.deletedAt ? "deleting" : "queued",
              revision: row.revision + 1,
              updatedAt: new Date(),
            })
            .where(condition(row.userId, row.id))
            .returning();
          if (updated) {
            await event(
              tx,
              updated,
              row.deletedAt ? "document.deletion_requested.v1" : "document.retry_requested.v1",
            );
            await audit(tx, updated, "system:document-recovery", "document.recovered.v1");
          }
        }
      });
    },
    async cleanup() {
      await cleanupIdentityAttachmentCommands(db);
      // Technical upload handles expire; accepted originals never expire automatically.
      const stale = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.state, "pending"),
            lt(documents.updatedAt, new Date(Date.now() - 86400000)),
          ),
        )
        .orderBy(asc(documents.updatedAt), asc(documents.id))
        .limit(20);
      for (const item of stale)
        await db.transaction(async (tx) => {
          const [row] = await tx
            .update(documents)
            .set({
              state: "deleting",
              deletedAt: new Date(),
              generation: item.generation + 1,
              updatedAt: new Date(),
            })
            .where(and(condition(item.userId, item.id), eq(documents.state, "pending")))
            .returning();
          if (row) await event(tx, row, "document.deletion_requested.v1");
        });
      await db
        .delete(documentCommands)
        .where(
          inArray(
            documentCommands.id,
            db
              .select({ id: documentCommands.id })
              .from(documentCommands)
              .where(lte(documentCommands.expiresAt, new Date()))
              .orderBy(asc(documentCommands.expiresAt), asc(documentCommands.id))
              .limit(100),
          ),
        );
    },
  };
}
