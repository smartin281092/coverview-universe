import { useId, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PartnerApiError } from "@coverview/api-client/partner";
import type {
  AccessDecision,
  AccessItem,
  OrganizationReviewInput,
  RestrictionInput,
} from "@coverview/contracts/partner-access";
import type { MemberRestrictions, PartnerApplication } from "@coverview/contracts/partner";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Label,
  LoadingState,
} from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { formatDate, localDateTime, readDate, readText } from "./Field";

// Access decisions (C8a): restrictions, organisation reviews and the decision journal.
function useAttempt() {
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  return (payload: unknown) => {
    const text = JSON.stringify(payload);
    if (attempt.current?.payload !== text)
      attempt.current = { payload: text, key: crypto.randomUUID() };
    return attempt.current.key;
  };
}
function useFailure(error: unknown) {
  const { t } = useTranslation("partner");
  if (!error) return "";
  return error instanceof PartnerApiError ? t(`errors.${error.code}`) : t("error");
}

export function RestrictionBadges({ restrictions }: { restrictions: MemberRestrictions }) {
  const { t } = useTranslation(["access", "partner"]);
  const kinds = (["newLeads", "leadCreation", "marketplace"] as const).filter(
    (kind) => restrictions[kind],
  );
  if (!kinds.length && !restrictions.categories.length) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label={t("restrictions.current")}>
      {kinds.map((kind) => (
        <li key={kind}>
          <Badge variant="outline">{t(`restrictions.kinds.${kind}`)}</Badge>
        </li>
      ))}
      {restrictions.categories.length > 0 && (
        <li>
          <Badge variant="outline">
            {t("restrictions.kinds.categories", {
              list: restrictions.categories
                .map((category) => t(`partner:category.${category}`))
                .join(", "),
            })}
          </Badge>
        </li>
      )}
    </ul>
  );
}

const soon = (value: string | null) =>
  !!value && Date.parse(value) > Date.now() && Date.parse(value) <= Date.now() + 30 * 86400000;
/** Re-review dates within 30 days, an opened re-review and restrictions, for the person (C8a). */
export function AccessNotice({ application }: { application: PartnerApplication }) {
  const { t } = useTranslation(["access", "partner"]);
  const restricted =
    application.restrictions.newLeads ||
    application.restrictions.leadCreation ||
    application.restrictions.marketplace ||
    application.restrictions.categories.length > 0;
  const lines = [
    application.state === "needs_information" && !application.reviewReason && application.reviewedAt
      ? t("member.reopened")
      : null,
    application.state === "approved" && soon(application.reviewDueAt)
      ? t("member.reviewSoon", { date: formatDate(application.reviewDueAt) })
      : null,
    application.organizationState === "approved" && soon(application.organizationReviewDueAt)
      ? t("member.organizationReviewSoon", {
          date: formatDate(application.organizationReviewDueAt),
        })
      : null,
  ].filter((line): line is string => !!line);
  if (!lines.length && !restricted) return null;
  return (
    <section
      aria-label={t("restrictions.current")}
      className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
    >
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {restricted && (
        <div className="space-y-2">
          <p>{t("member.restricted")}</p>
          <RestrictionBadges restrictions={application.restrictions} />
          {application.restrictions.reviewAt && (
            <p>
              {t("restrictions.reviewAtValue", {
                date: formatDate(application.restrictions.reviewAt),
              })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function DecisionHistory({ items }: { items: AccessDecision[] }) {
  const { t } = useTranslation(["access", "partner"]);
  if (!items.length) return <p className="text-sm text-muted-foreground">{t("history.empty")}</p>;
  return (
    <ol className="space-y-3">
      {items.map((decision) => (
        <li key={decision.id} className="rounded-lg border border-border p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{t(`history.kind.${decision.kind}`)}</p>
            {decision.state && (
              <Badge variant="outline">{t(`partner:applicationState.${decision.state}`)}</Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("history.meta", {
              author: t(`history.author.${decision.author}`),
              date: formatDate(decision.at),
            })}
          </p>
          {decision.kind === "automatic_review" ? (
            <p className="mt-2">
              {t("history.automatic", { date: formatDate(decision.reviewDueAt) })}
            </p>
          ) : (
            decision.reason && <p className="mt-2 whitespace-pre-wrap">{decision.reason}</p>
          )}
          {decision.roles && decision.roles.length > 0 && (
            <p className="mt-2 text-muted-foreground">
              {t("history.roles", {
                list: decision.roles.map((role) => t(`partner:role.${role}`)).join(", "),
              })}
            </p>
          )}
          {decision.restrictions && (
            <div className="mt-2">
              <RestrictionBadges restrictions={decision.restrictions} />
            </div>
          )}
          {decision.kind !== "automatic_review" && decision.reviewDueAt && (
            <p className="mt-2 text-muted-foreground">
              {t("history.reviewDue", { date: formatDate(decision.reviewDueAt) })}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

/** The journal of one member: CoverView reads anyone's, a member only their own. */
export function HistoryDialog({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { t } = useTranslation(["access", "partner"]),
    session = usePartner();
  const query = useQuery({
    queryKey: [...session.queryKey, "access-decisions", userId ?? "own"],
    queryFn: ({ signal }) =>
      userId ? partnerApi.memberDecisions(userId, signal) : partnerApi.ownDecisions(signal),
    gcTime: 0,
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-xl"
        showCloseButton
        closeLabel={t("partner:close")}
      >
        <DialogHeader>
          <DialogTitle>{t("history.title")}</DialogTitle>
          <DialogDescription>{t("organization.description")}</DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <LoadingState label={t("partner:loading")} />
        ) : query.isError ? (
          <ErrorState
            title={t("partner:error")}
            description={t("partner:error")}
            retryLabel={t("partner:retry")}
            pendingLabel={t("partner:loading")}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <DecisionHistory items={query.data.items} />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function RestrictionsDialog({ item, onClose }: { item: AccessItem; onClose: () => void }) {
  const { t } = useTranslation(["access", "partner"]),
    session = usePartner(),
    client = useQueryClient(),
    attemptFor = useAttempt(),
    ids = { reviewAt: useId(), reason: useId() },
    [invalid, setInvalid] = useState(false);
  const current = item.application.restrictions;
  const save = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (input: RestrictionInput) =>
      partnerApi.restrictMember(item.application.userId, input, {
        csrfToken: session.identity.csrfToken,
        idempotencyKey: attemptFor(input),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: session.queryKey });
      onClose();
    },
  });
  const failure = useFailure(save.error);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending) return;
    const data = new FormData(event.currentTarget);
    const reason = readText(data, "reason");
    let reviewAt: string | null;
    try {
      reviewAt = readDate(data, "reviewAt");
    } catch {
      setInvalid(true);
      return;
    }
    if (reason.length < 5) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    save.mutate({
      restrictionRevision: item.application.restrictionRevision,
      newLeads: data.get("newLeads") === "on",
      leadCreation: data.get("leadCreation") === "on",
      marketplace: data.get("marketplace") === "on",
      categories: item.application.categories.filter((c) => data.getAll("categories").includes(c)),
      reviewAt,
      reason,
    });
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("restrictions.title")}</DialogTitle>
          <DialogDescription>{t("restrictions.description")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-5 text-sm" onSubmit={submit}>
          <p className="font-medium">{item.application.name}</p>
          <fieldset className="space-y-3">
            <legend className="sr-only">{t("restrictions.title")}</legend>
            {(["newLeads", "leadCreation", "marketplace"] as const).map((kind) => (
              <label key={kind} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name={kind}
                  defaultChecked={current[kind]}
                  className="mt-1"
                />
                <span>{t(`restrictions.${kind}`)}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="mb-2 font-medium">{t("restrictions.categories")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {item.application.categories.map((category) => (
                <label key={category} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="categories"
                    value={category}
                    defaultChecked={current.categories.includes(category)}
                  />
                  {t(`partner:category.${category}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor={ids.reviewAt}>{t("restrictions.reviewAt")}</Label>
            <input
              id={ids.reviewAt}
              name="reviewAt"
              defaultValue={localDateTime(current.reviewAt)}
              type="datetime-local"
              className="h-10 w-full rounded-md border border-input bg-background px-3"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={ids.reason}>{t("restrictions.reason")}</Label>
            <textarea
              id={ids.reason}
              name="reason"
              required
              minLength={5}
              maxLength={2000}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </div>
          <p className="text-muted-foreground">
            {t("restrictions.consequences", { count: item.activeLeads })}
          </p>
          <p className="text-xs text-muted-foreground">{t("restrictions.lift")}</p>
          {(invalid || save.isError) && (
            <p role="alert" className="text-destructive">
              {invalid ? t("partner:errors.PARTNER_ACTION_REQUIRED") : failure}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
              {t("partner:cancel")}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {t("restrictions.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OrganizationDialog({
  organizationId,
  onClose,
}: {
  organizationId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(["access", "partner"]),
    session = usePartner(),
    client = useQueryClient(),
    attemptFor = useAttempt(),
    ids = { state: useId(), reason: useId(), reviewDueAt: useId() },
    [invalid, setInvalid] = useState(false);
  const query = useQuery({
    queryKey: [...session.queryKey, "organization-access", organizationId],
    queryFn: ({ signal }) => partnerApi.organizationAccess(organizationId, signal),
    gcTime: 0,
  });
  const save = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (input: OrganizationReviewInput) =>
      partnerApi.reviewOrganization(organizationId, input, {
        csrfToken: session.identity.csrfToken,
        idempotencyKey: attemptFor(input),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: session.queryKey });
      onClose();
    },
  });
  const failure = useFailure(save.error);
  const organization = query.data;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending || !organization) return;
    const data = new FormData(event.currentTarget);
    const reason = readText(data, "reason");
    const state = readText(data, "state");
    let reviewDueAt: string | null;
    try {
      reviewDueAt = readDate(data, "reviewDueAt");
    } catch {
      setInvalid(true);
      return;
    }
    if (
      reason.length < 5 ||
      !["needs_information", "approved", "rejected", "suspended", "closed"].includes(state)
    ) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    save.mutate({
      revision: organization.revision,
      state: state as OrganizationReviewInput["state"],
      reason,
      reviewDueAt,
    });
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("organization.title", { name: organization?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("organization.description")}</DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <LoadingState label={t("partner:loading")} />
        ) : query.isError || !organization ? (
          <ErrorState
            title={t("partner:error")}
            description={t("partner:error")}
            retryLabel={t("partner:retry")}
            pendingLabel={t("partner:loading")}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <div className="space-y-6 text-sm">
            <section className="space-y-2">
              <h3 className="font-medium">{t("organization.current")}</h3>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {t(`partner:applicationState.${organization.state}`)}
                </Badge>
                {organization.reviewDueAt && (
                  <span className="text-muted-foreground">
                    {t("organization.reviewDue", { date: formatDate(organization.reviewDueAt) })}
                  </span>
                )}
              </div>
              {organization.reviewReason && (
                <p className="whitespace-pre-wrap">{organization.reviewReason}</p>
              )}
            </section>
            <section className="space-y-2">
              <h3 className="font-medium">{t("organization.members")}</h3>
              <ul className="space-y-1">
                {organization.members.map((member) => (
                  <li key={member.userId} className="flex flex-wrap items-center gap-2">
                    <span>{member.name}</span>
                    <Badge variant="outline">{t(`partner:applicationState.${member.state}`)}</Badge>
                  </li>
                ))}
              </ul>
            </section>
            <form className="space-y-4 rounded-lg border border-border p-4" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor={ids.state}>{t("organization.state")}</Label>
                <select
                  id={ids.state}
                  name="state"
                  defaultValue={
                    organization.state === "submitted" ? "needs_information" : organization.state
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3"
                >
                  {["needs_information", "approved", "rejected", "suspended", "closed"].map(
                    (state) => (
                      <option key={state} value={state}>
                        {t(`partner:applicationState.${state}`)}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={ids.reason}>{t("organization.reason")}</Label>
                <textarea
                  id={ids.reason}
                  name="reason"
                  required
                  minLength={5}
                  maxLength={2000}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={ids.reviewDueAt}>{t("organization.reviewDueAt")}</Label>
                <input
                  id={ids.reviewDueAt}
                  name="reviewDueAt"
                  defaultValue={localDateTime(organization.reviewDueAt)}
                  type="datetime-local"
                  className="h-10 w-full rounded-md border border-input bg-background px-3"
                />
              </div>
              <p className="text-muted-foreground">
                {t("organization.consequences", { count: organization.activeLeads })}
              </p>
              {(invalid || save.isError) && (
                <p role="alert" className="text-destructive">
                  {invalid ? t("partner:errors.PARTNER_ACTION_REQUIRED") : failure}
                </p>
              )}
              <div className="flex justify-end">
                <Button type="submit" disabled={save.isPending}>
                  {t("organization.submit")}
                </Button>
              </div>
            </form>
            <section className="space-y-3">
              <h3 className="font-medium">{t("organization.decisions")}</h3>
              <DecisionHistory items={organization.decisions} />
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
