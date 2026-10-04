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
import { Field, SelectOptions, readText, readDate } from "../features/Field";
import { partnerApi } from "../api";
import { CompetenceDialog } from "../features/CompetenceDialog";
export function ApplicationsPage() {
  const { t } = useTranslation(),
    session = usePartner(),
    client = useQueryClient(),
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
    queryKey: [...session.queryKey, "applications"],
    queryFn: ({ signal }) => partnerApi.applications(signal),
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
  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("nav.applications")}</h1>
        <p className="mt-2 text-muted-foreground">{t("application.description")}</p>
      </header>
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
          {query.data.items.map((person) => (
            <article key={person.userId} className="rounded-xl border border-border p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{person.name}</h2>
                <Badge variant="outline">{t(`applicationState.${person.state}`)}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{person.organization}</p>
              <p className="mt-3 text-sm">
                {person.categories.map((category) => t(`category.${category}`)).join(" · ")}
              </p>
              <Button
                className="mt-5"
                variant="outline"
                onClick={() => {
                  setSelected(person);
                  setError("");
                  setKey(crypto.randomUUID());
                }}
              >
                {t("application.review")}
              </Button>
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => setCompetenceUserId(person.userId)}
              >
                {t("competence.title")}
              </Button>
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => setAvailabilityUserId(person.userId)}
              >
                {t("availability.title")}
              </Button>
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => setCapacityUserId(person.userId)}
              >
                {t("capacity.title")}
              </Button>
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => setSharedModesUserId(person.userId)}
              >
                {t("sharedModes.title")}
              </Button>
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => setPracticeUserId(person.userId)}
              >
                {t("practice.title")}
              </Button>
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => setConventionUserId(person.userId)}
              >
                {t("convention.title")}
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title={t("application.empty")} description={t("application.description")} />
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
                const parsed = partnerReviewInputSchema.safeParse({
                  revision: selected.revision,
                  state: readText(data, "state"),
                  organizationState: readText(data, "organizationState"),
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
              <Field
                name="organizationState"
                label={t("application.organizationState")}
                defaultValue={
                  selected.organizationState === "submitted"
                    ? "needs_information"
                    : selected.organizationState
                }
              >
                <SelectOptions
                  values={["needs_information", "approved", "rejected", "suspended", "closed"]}
                  prefix="applicationState"
                />
              </Field>
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
