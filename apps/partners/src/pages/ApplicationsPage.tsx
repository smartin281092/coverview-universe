import { AvailabilityDialog } from "../features/AvailabilityDialog";
import { CapacityDialog } from "../features/CapacityDialog";
import { SharedModesDialog } from "../features/SharedModesDialog";
import { ConventionDialog } from "../features/ConventionDialog";
import { PracticeDialog } from "../features/PracticeDialog";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  partnerReviewInputSchema,
  partnerRoleSchema,
  type PartnerApplication,
} from "@coverview/contracts/partner";
import {
  accessFilterSchema,
  type AccessFilter,
  type AccessItem,
} from "@coverview/contracts/partner-access";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  EmptyState,
  ErrorState,
  LoadingState,
  AccessDeniedState,
} from "@coverview/ui";
import { usePartner } from "../features/PartnerSession";
import { Field, SelectOptions, readText, readDate, formatDate } from "../features/Field";
import { partnerApi } from "../api";
import { CompetenceDialog } from "../features/CompetenceDialog";
import {
  HistoryDialog,
  OrganizationDialog,
  RestrictionBadges,
  RestrictionsDialog,
} from "../features/AccessDialogs";

// What CoverView should look at for one member (C8a): dates, restrictions and proofs.
function AccessFlags({ item }: { item: AccessItem }) {
  const { t } = useTranslation(["access", "partner"]);
  const { application, flags } = item;
  const lines = [
    flags.review &&
      t(`flags.review_${flags.review}`, { date: formatDate(application.reviewDueAt) }),
    flags.organizationReview &&
      t(`flags.organizationReview_${flags.organizationReview}`, {
        date: formatDate(application.organizationReviewDueAt),
      }),
    flags.restrictionReview &&
      t(`flags.restrictionReview_${flags.restrictionReview}`, {
        date: formatDate(application.restrictions.reviewAt),
      }),
    ...item.proofs.map((proof) =>
      t(`flags.proof_${proof.state}`, {
        kind: t(`proofKind.${proof.kind}`),
        category: proof.companyId
          ? t("flags.proofCompany", {
              category: t(`partner:category.${proof.category}`),
              company: proof.companyId,
            })
          : t(`partner:category.${proof.category}`),
        date: formatDate(proof.validUntil),
      }),
    ),
  ].filter((line): line is string => !!line);
  return (
    <div className="mt-3 space-y-2 text-sm">
      {application.organizationState !== "approved" && (
        <p className="text-muted-foreground">
          {t("flags.organizationState", {
            state: t(`partner:applicationState.${application.organizationState}`),
          })}
        </p>
      )}
      <RestrictionBadges restrictions={application.restrictions} />
      {lines.length > 0 && (
        <ul className="space-y-1">
          {lines.map((line) => (
            <li key={line} className="text-amber-800 dark:text-amber-300">
              {line}
            </li>
          ))}
        </ul>
      )}
      {item.activeLeads > 0 && (
        <p className="text-muted-foreground">
          {t("flags.activeLeads", { count: item.activeLeads })}
        </p>
      )}
    </div>
  );
}
export function ApplicationsPage() {
  const { t } = useTranslation(),
    access = useTranslation("access").t,
    session = usePartner(),
    client = useQueryClient(),
    [filter, setFilter] = useState<AccessFilter>("all"),
    [restricting, setRestricting] = useState<AccessItem | null>(null),
    [organizationId, setOrganizationId] = useState<string | null>(null),
    [historyUserId, setHistoryUserId] = useState<string | null>(null),
    [selected, setSelected] = useState<PartnerApplication | null>(null),
    [availabilityUserId, setAvailabilityUserId] = useState<string | null>(null),
    [capacityUserId, setCapacityUserId] = useState<string | null>(null),
    [sharedModesUserId, setSharedModesUserId] = useState<string | null>(null),
    [practiceUserId, setPracticeUserId] = useState<string | null>(null),
    [conventionUserId, setConventionUserId] = useState<string | null>(null),
    [competenceUserId, setCompetenceUserId] = useState<string | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [key, setKey] = useState(() => crypto.randomUUID());
  const query = useQuery({
    queryKey: [...session.queryKey, "applications", filter],
    queryFn: ({ signal }) => partnerApi.accessQueue(filter, signal),
    enabled: session.context.administrator,
    gcTime: 0,
    refetchInterval: 15000,
  });
  if (!session.context.administrator)
    return (
      <AccessDeniedState
        title={t("nav.applications")}
        description={t("errors.PARTNER_ACCESS_DENIED")}
      />
    );
  const counts = query.data?.counts;
  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("nav.applications")}</h1>
        <p className="mt-2 text-muted-foreground">{t("application.description")}</p>
      </header>
      <div role="group" aria-label={access("filters.label")} className="flex flex-wrap gap-2">
        {accessFilterSchema.options.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? "default" : "outline"}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {access(`filters.${value}`, {
              count: value === "all" || !counts ? 0 : counts[value],
            })}
          </Button>
        ))}
      </div>
      {query.isPending ? (
        <LoadingState label={t("loading")} />
      ) : query.isError ? (
        <ErrorState
          title={t("error")}
          description={t("error")}
          retryLabel={t("retry")}
          pendingLabel={t("loading")}
          onRetry={() => void query.refetch()}
        />
      ) : query.data.items.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {query.data.items.map((item) => {
            const person = item.application;
            return (
              <article key={person.userId} className="rounded-xl border border-border p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">{person.name}</h2>
                  <Badge variant="outline">{t(`applicationState.${person.state}`)}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{item.organizationName}</p>
                <p className="mt-3 text-sm">
                  {person.categories.map((category) => t(`category.${category}`)).join(" · ")}
                </p>
                <AccessFlags item={item} />
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      setSelected(person);
                      setError("");
                      setKey(crypto.randomUUID());
                    }}
                  >
                    {t("application.review")}
                  </Button>
                  <Button variant="outline" onClick={() => setRestricting(item)}>
                    {access("actions.restrictions")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setOrganizationId(person.organizationId)}
                  >
                    {access("actions.organization")}
                  </Button>
                  <Button variant="outline" onClick={() => setHistoryUserId(person.userId)}>
                    {access("actions.history")}
                  </Button>
                </div>
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium">
                    {access("actions.dossiers")}
                  </summary>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setCompetenceUserId(person.userId)}>
                      {t("competence.title")}
                    </Button>
                    <Button variant="outline" onClick={() => setAvailabilityUserId(person.userId)}>
                      {t("availability.title")}
                    </Button>
                    <Button variant="outline" onClick={() => setCapacityUserId(person.userId)}>
                      {t("capacity.title")}
                    </Button>
                    <Button variant="outline" onClick={() => setSharedModesUserId(person.userId)}>
                      {t("sharedModes.title")}
                    </Button>
                    <Button variant="outline" onClick={() => setPracticeUserId(person.userId)}>
                      {t("practice.title")}
                    </Button>
                    <Button variant="outline" onClick={() => setConventionUserId(person.userId)}>
                      {t("convention.title")}
                    </Button>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState title={access(`empty.${filter}`)} description={t("application.description")} />
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !pending) setSelected(null);
        }}
      >
        <DialogContent
          className="max-h-[90svh] overflow-y-auto sm:max-w-xl"
          showCloseButton
          closeLabel={t("close")}
        >
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>{selected?.organization}</DialogDescription>
          </DialogHeader>
          {selected && (
            <form
              className="space-y-5"
              onChange={() => setKey(crypto.randomUUID())}
              onSubmit={(event) => {
                event.preventDefault();
                if (pending) return;
                const data = new FormData(event.currentTarget);
                let reviewDueAt: string | null;
                try {
                  reviewDueAt = readDate(data, "reviewDueAt");
                } catch {
                  setError(t("errors.PARTNER_ACTION_REQUIRED"));
                  return;
                }
                // The organisation is decided on its own (C8a); a first application may approve
                // it here explicitly.
                const parsed = partnerReviewInputSchema.safeParse({
                  revision: selected.revision,
                  state: readText(data, "state"),
                  ...(data.get("organizationApproved") === "on"
                    ? { organizationState: "approved" }
                    : {}),
                  roles: data.getAll("roles"),
                  reason: readText(data, "reason"),
                  reviewDueAt,
                });
                if (!parsed.success) {
                  setError(t("errors.PARTNER_ACTION_REQUIRED"));
                  return;
                }
                setPending(true);
                setError("");
                void partnerApi
                  .review(selected.userId, parsed.data, {
                    csrfToken: session.identity.csrfToken,
                    idempotencyKey: key,
                  })
                  .then(async () => {
                    await client.invalidateQueries({ queryKey: session.queryKey });
                    setSelected(null);
                  })
                  .catch(() => setError(t("error")))
                  .finally(() => setPending(false));
              }}
            >
              <div className="space-y-2 rounded-lg bg-muted p-4 text-sm">
                <p>
                  {selected.languages}
                  {" · "}
                  {selected.regions}
                </p>
                <p>{selected.phone}</p>
                <p className="whitespace-pre-wrap">{selected.qualifications}</p>
              </div>
              <Field
                name="state"
                label={t("application.reason")}
                defaultValue={selected.state === "submitted" ? "needs_information" : selected.state}
              >
                <SelectOptions
                  values={["needs_information", "approved", "rejected", "suspended", "closed"]}
                  prefix="applicationState"
                />
              </Field>
              {selected.organizationState === "approved" ? (
                <p className="text-sm text-muted-foreground">
                  {access("review.organizationElsewhere")}
                </p>
              ) : (
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" name="organizationApproved" className="mt-1" />
                  {access("review.validateOrganization", { name: selected.organization })}
                </label>
              )}
              <fieldset>
                <legend className="mb-3 text-sm font-medium">{t("application.grant")}</legend>
                <div className="space-y-2">
                  {partnerRoleSchema.options.map((role) => (
                    <label key={role} className="flex items-center gap-3 text-sm">
                      <input
                        name="roles"
                        type="checkbox"
                        value={role}
                        defaultChecked={selected.grantedRoles.includes(role)}
                      />
                      {t(`role.${role}`)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field name="reason" label={t("field.reason")} type="textarea" required />
              <Field name="reviewDueAt" label={t("application.reviewDate")} type="datetime-local" />
              <p className="text-xs text-muted-foreground">{t("application.consequences")}</p>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={pending}>
                {t("application.decision")}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {restricting && (
        <RestrictionsDialog item={restricting} onClose={() => setRestricting(null)} />
      )}
      {organizationId && (
        <OrganizationDialog
          organizationId={organizationId}
          onClose={() => setOrganizationId(null)}
        />
      )}
      {historyUserId && (
        <HistoryDialog userId={historyUserId} onClose={() => setHistoryUserId(null)} />
      )}
      {conventionUserId && (
        <ConventionDialog userId={conventionUserId} onClose={() => setConventionUserId(null)} />
      )}
      {availabilityUserId && (
        <AvailabilityDialog
          userId={availabilityUserId}
          onClose={() => setAvailabilityUserId(null)}
        />
      )}
      {practiceUserId && (
        <PracticeDialog userId={practiceUserId} onClose={() => setPracticeUserId(null)} />
      )}
      {capacityUserId && (
        <CapacityDialog
          key={`${session.identity.user.id}:${session.identity.session.id}:${capacityUserId}`}
          userId={capacityUserId}
          onClose={() => setCapacityUserId(null)}
        />
      )}
      {sharedModesUserId && (
        <SharedModesDialog
          key={`${session.identity.user.id}:${session.identity.session.id}:${sharedModesUserId}`}
          userId={sharedModesUserId}
          onClose={() => setSharedModesUserId(null)}
        />
      )}
      {competenceUserId && (
        <CompetenceDialog userId={competenceUserId} onClose={() => setCompetenceUserId(null)} />
      )}
    </>
  );
}
