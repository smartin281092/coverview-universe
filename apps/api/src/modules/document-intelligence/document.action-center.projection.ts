import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  actionCenterItemSchema,
  authorizationTexts,
  requiredGeneralProfileFields,
  profileStepFields,
  type ActionCenterItem,
  type ActionCenterSource,
  type ActionCenterSummary,
  type ActionCenterVariant,
} from "@coverview/contracts";
import type { createDatabase } from "../../platform/db/database.js";
import { readAuthorizationNotice } from "../identity/index.js";
import { readManagedDocumentProfile } from "../profiles/index.js";
import { readAuthorizationStatus } from "../authorizations/index.js";
import { readCompanyActionContext } from "./document.company-actions.repository.js";
import {
  actionCenterManualReviews,
  actionCenterResolutions,
} from "./document.action-center.schema.js";
import { sameProfileValue } from "./document.reconciliation.js";

type Database = ReturnType<typeof createDatabase>["db"];
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Resolution = typeof actionCenterResolutions.$inferSelect;
type CenterAction = { item: ActionCenterItem; observedHash: string; profileHash: string };
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
export const actionDigest = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
const normalize = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("fr");
export const actionValuesHash = (values: Record<string, string>) =>
  actionDigest(
    Object.entries(values)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, normalize(value)]),
  );
const topicOf = (field: string) =>
  ["street", "postalCode", "city", "country"].includes(field) ? "address" : field;
export const actionCenterIdentity = (userId: string, profileId: string, topic: string) =>
  `act_${actionDigest([userId, profileId, topic]).slice(0, 32)}`;
const fieldsOf = (topic: string) =>
  topic === "address" ? ["street", "postalCode", "city", "country"] : [topic];
function topicValues(values: Record<string, unknown>, topic: string): Record<string, string> {
  return Object.fromEntries(
    fieldsOf(topic).flatMap((field) =>
      typeof values[field] === "string" && values[field].trim() ? [[field, values[field]]] : [],
    ),
  );
}
function sameValues(left: Record<string, string>, right: Record<string, string>) {
  return Object.entries(left).every(
    ([field, value]) => !!right[field] && sameProfileValue(value, right[field]),
  );
}
function summaryOf(actions: CenterAction[], incomplete: boolean): ActionCenterSummary {
  const pending = actions.filter(({ item }) => item.state === "pending").length;
  const inProgress = actions.filter(({ item }) => item.state === "in_progress").length;
  const completed = actions.filter(({ item }) => item.state === "complete").length;
  const total = pending + inProgress + completed;
  const measured = total ? Math.round(((completed + inProgress) / total) * 100) : 100;
  const percent = incomplete ? Math.min(measured, 99) : measured;
  return {
    pending,
    inProgress,
    completed,
    total,
    completionPercent: percent,
    optimizationPercent: percent,
    incomplete,
  };
}
function latestResolution(
  rows: Resolution[],
  id: string,
  observedHash: string,
  profileHash: string,
) {
  return rows.find(
    (row) =>
      row.actionId === id && row.observedHash === observedHash && row.profileHash === profileHash,
  );
}
export async function readActionCenter(tx: Database | Tx, userId: string, profileFilter?: string) {
  const context = await readCompanyActionContext(
    tx,
    userId,
    profileFilter ? { profileId: profileFilter } : {},
  );
  for (const subject of context.subjects)
    if (!context.profiles.has(subject.id) && (!profileFilter || profileFilter === subject.id)) {
      context.profiles.set(subject.id, {
        name: subject.displayName,
        ...(await readManagedDocumentProfile(tx, userId, subject.id)),
      });
    }
  const resolutions = await tx
    .select()
    .from(actionCenterResolutions)
    .where(
      and(
        eq(actionCenterResolutions.userId, userId),
        profileFilter ? eq(actionCenterResolutions.profileId, profileFilter) : undefined,
      ),
    )
    .orderBy(desc(actionCenterResolutions.createdAt), desc(actionCenterResolutions.id))
    .limit(1001);
  const manual = await tx
    .select()
    .from(actionCenterManualReviews)
    .where(
      and(
        eq(actionCenterManualReviews.userId, userId),
        profileFilter ? eq(actionCenterManualReviews.profileId, profileFilter) : undefined,
      ),
    )
    .orderBy(desc(actionCenterManualReviews.createdAt), desc(actionCenterManualReviews.id))
    .limit(1001);
  const incomplete = context.incomplete || resolutions.length > 1000 || manual.length > 1000;
  const notice = await readAuthorizationNotice(tx, userId);
  const actions: CenterAction[] = [];
  for (const [profileId, profile] of context.profiles) {
    if (profileFilter && profileFilter !== profileId) continue;
    const authorizations = await readAuthorizationStatus(tx, userId, profileId);
    const required = requiredGeneralProfileFields[profile.kind];
    const topics = new Set([
      ...required.map(topicOf),
      ...context.reviewSources
        .filter((source) => source.profileId === profileId)
        .map((source) => source.group.id),
      ...context.actions
        .filter((action) => action.profileId === profileId)
        .map((action) => action.group),
    ]);
    for (const topic of topics) {
      const id = actionCenterIdentity(userId, profileId, topic);
      const currentValues = topicValues(profile.values, topic);
      const grouped = new Map<string, ActionCenterVariant>();
      for (const source of context.reviewSources.filter(
        (source) => source.profileId === profileId && source.group.id === topic,
      )) {
        const values = Object.fromEntries(
          source.group.fields.map((field) => [field.field, field.value]),
        );
        const variantId = `var_${actionValuesHash(values).slice(0, 24)}`;
        const variant = grouped.get(variantId) ?? { id: variantId, values, sources: [] };
        const reference: ActionCenterSource = {
          documentId: source.documentId,
          title: source.title,
          companyId: source.companyId,
          policyNumber: source.policyNumber,
        };
        if (!variant.sources.some((item) => item.documentId === reference.documentId))
          variant.sources.push(reference);
        grouped.set(variantId, variant);
      }
      const variants = [...grouped.values()].sort((a, b) => a.id.localeCompare(b.id));
      const observedHash = actionDigest(variants.map((variant) => variant.id));
      const profileHash = actionValuesHash(currentValues);
      const resolved = latestResolution(resolutions, id, observedHash, profileHash);
      const manualReview = resolved
        ? manual.find((entry) => entry.resolutionId === resolved.id)
        : undefined;
      const companies = context.actions.filter(
        (company) => company.profileId === profileId && company.group === topic,
      );
      const differences = variants.filter((variant) => !sameValues(variant.values, currentValues));
      const alreadyNotified =
        differences.length > 0 &&
        differences.every(
          (variant) =>
            variant.sources.length > 0 &&
            variant.sources.every(
              (source) =>
                source.companyId &&
                companies.some(
                  (company) =>
                    company.companyId === source.companyId &&
                    ["notified", "confirmed"].includes(company.status),
                ),
            ),
        );
      const requiredFields = required.filter(
        (field) =>
          topicOf(field) === topic &&
          !(typeof profile.values[field] === "string" && profile.values[field].trim()),
      );
      const reviewPending = differences.length > 0 && !resolved && !alreadyNotified;
      const notificationPending = companies.some((company) => company.canRequest);
      const notificationActive = companies.some((company) =>
        ["requested", "in_progress"].includes(company.status),
      );
      let kind: ActionCenterItem["kind"] = reviewPending
        ? "profile_review"
        : requiredFields.length
          ? "profile_completion"
          : notificationPending || notificationActive
            ? "company_notification"
            : variants.length
              ? "profile_review"
              : "profile_completion";
      let state: ActionCenterItem["state"] =
        reviewPending || requiredFields.length || notificationPending
          ? "pending"
          : notificationActive
            ? "in_progress"
            : "complete";
      if (manualReview && manualReview.state !== "resolved") {
        state = "in_progress";
        kind = resolved!.history.kind;
      }
      const mayResolve = state === "pending" && !incomplete;
      const choices: ActionCenterItem["choices"] = [];
      if (kind === "profile_review") {
        if (Object.keys(currentValues).length)
          choices.push({
            id: "keep",
            labelKey: "choices.keep",
            recommended: true,
            enabled: mayResolve,
          });
        if (variants.length)
          choices.push({
            id: "variant",
            labelKey: "choices.variant",
            recommended: false,
            enabled: mayResolve,
          });
        choices.push({
          id: "correct",
          labelKey: "choices.correct",
          recommended: false,
          enabled: mayResolve,
        });
      } else if (kind === "profile_completion")
        choices.push({
          id: "correct",
          labelKey: "choices.correct",
          recommended: true,
          enabled: mayResolve,
        });
      else
        choices.push({
          id: "notify",
          labelKey: "choices.notify",
          recommended: true,
          enabled: mayResolve && !!authorizations.mandate.signedAt,
        });
      choices.push({
        id: "custom",
        labelKey: "choices.custom",
        recommended: false,
        enabled: mayResolve,
      });
      const requirements: ActionCenterItem["requirements"] =
        kind === "company_notification" && !authorizations.mandate.signedAt
          ? [
              {
                kind: "management_mandate",
                state: "missing",
                profileId,
                step: null,
                completedAt: null,
              },
            ]
          : [];
      if (requiredFields.length) {
        const groups = profileStepFields(profile.kind, "general");
        const step = Object.entries(groups).find(([, fields]) =>
          fields.some((field) => requiredFields.includes(field)),
        )?.[0] as "information" | "contact" | "details" | undefined;
        requirements.push({
          kind: "profile_information",
          state: "missing",
          profileId,
          step: step ?? "information",
          completedAt: null,
        });
      }
      const fingerprint = actionDigest([
        id,
        observedHash,
        profileHash,
        kind,
        state,
        companies.map((company) => [
          company.companyId,
          company.status,
          company.evidence?.occurredAt ?? null,
        ]),
        authorizations.mandate.signedAt,
        requiredFields,
      ]);
      const item = actionCenterItemSchema.parse({
        id,
        profileId,
        profileName: profile.name,
        topic,
        kind,
        state,
        fingerprint,
        profileRevision: profile.revision,
        currentValues,
        variants,
        companies,
        choices,
        requirements,
        requiredFields,
        canResolve: choices.some((choice) => choice.enabled),
        resolvedAt: state === "complete" ? (resolved?.createdAt.toISOString() ?? null) : null,
      });
      actions.push({ item, observedHash, profileHash });
    }
    const authorizationChecks = [
      ...(profileId === "self" ? [{ kind: "lsa45" as const, at: notice.firstOpenedAt }] : []),
      { kind: "procuration" as const, at: authorizations.procuration.signedAt },
      { kind: "management_mandate" as const, at: authorizations.mandate.signedAt },
    ];
    for (const check of authorizationChecks) {
      const topic = `authorization:${check.kind}`;
      const id = actionCenterIdentity(userId, profileId, topic);
      const observedHash = actionDigest([
        topic,
        check.kind === "lsa45" ? notice.version : authorizationTexts.version,
      ]);
      const profileHash = actionValuesHash({});
      const resolved = latestResolution(resolutions, id, observedHash, profileHash);
      const review = resolved
        ? manual.find((entry) => entry.resolutionId === resolved.id && entry.state !== "resolved")
        : undefined;
      const state = check.at ? "complete" : review ? "in_progress" : "pending";
      const item = actionCenterItemSchema.parse({
        id,
        profileId,
        profileName: profile.name,
        topic,
        kind: "authorization",
        state,
        fingerprint: actionDigest([id, check.at, observedHash, review?.revision ?? null]),
        profileRevision: profile.revision,
        currentValues: {},
        variants: [],
        companies: [],
        choices: [
          {
            id: "custom",
            labelKey: "choices.custom",
            recommended: false,
            enabled: !incomplete && state === "pending",
          },
        ],
        requirements: [
          {
            kind: check.kind,
            profileId,
            state: check.at ? "complete" : "missing",
            step: null,
            completedAt: check.at,
          },
        ],
        requiredFields: [],
        canResolve: !incomplete && state === "pending",
        resolvedAt: check.at,
      });
      actions.push({ item, observedHash, profileHash });
    }
  }
  // A resolved action remains addressable after its original source disappeared.
  for (const row of resolutions.slice(0, 1000))
    if (!actions.some(({ item }) => item.id === row.actionId)) {
      const history = row.history;
      actions.push({
        observedHash: row.observedHash,
        profileHash: row.profileHash,
        item: actionCenterItemSchema.parse({
          id: row.actionId,
          profileId: row.profileId,
          profileName: history.profileName,
          topic: row.topic,
          kind: history.kind,
          state: "complete",
          fingerprint: row.fingerprint,
          profileRevision: 0,
          currentValues: history.afterValues,
          variants: [],
          companies: [],
          choices: [
            { id: "custom", labelKey: "choices.custom", recommended: false, enabled: false },
          ],
          requirements: [],
          requiredFields: [],
          canResolve: false,
          resolvedAt: row.createdAt.toISOString(),
        }),
      });
    }
  actions.sort((a, b) => a.item.id.localeCompare(b.item.id));
  return { actions, context, summary: summaryOf(actions, incomplete) };
}
