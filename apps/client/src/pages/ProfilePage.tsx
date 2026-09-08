import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useWatch } from "react-hook-form";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import {
  isProfileConfirmed,
  profileCompletionAverage,
  profileStepCompletion,
} from "@coverview/contracts";
import { Button, Input, Label, LoadingState } from "@coverview/ui";
import { api } from "../api";
import { forgetIdentity, identityOptions } from "../features/identity/session-state";
import {
  informationFields,
  addressFields,
  allFields,
  type ProfileFieldName,
} from "../features/profile/profile-fields";
import { useProfileJourney, type ProfileJourney } from "../features/profile/use-profile-journey";
import { ProfileDocumentDifferences } from "../features/profile/ProfileDocumentDifferences";
import { ProfileWorkspace } from "../features/profile/ProfileWorkspace";
import {
  ProfileSteps,
  type ProfileEditorBridge,
  type ProfileViewStep,
} from "../features/profile/ProfileSteps";

const steps = ["information", "address", "review"] as const;
const autocomplete: Record<ProfileFieldName, string> = {
  firstName: "given-name",
  lastName: "family-name",
  birthDate: "bday",
  nationality: "off",
  avsNumber: "off",
  occupation: "organization-title",
  street: "street-address",
  postalCode: "postal-code",
  city: "address-level2",
  country: "country-name",
  phone: "tel",
  contactEmail: "email",
};

function ProfileChoices({ identity, onBack }: { identity: IdentityMe; onBack: () => void }) {
  const { t, i18n } = useTranslation("profile");
  const client = useQueryClient();
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const query = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "profile-choices", cursors.at(-1)],
    queryFn: ({ signal }) => api.profileChoices(cursors.at(-1), { signal }),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.code === "IDENTITY_UNAUTHENTICATED")
      void forgetIdentity(client);
  }, [query.error, client]);
  return (
    <section className="max-w-2xl space-y-6">
      <Button variant="ghost" className="wallet-back-link" onClick={onBack}>
        {t("history.back")}
      </Button>
      {query.isPending ? (
        <LoadingState label={t("loading")} />
      ) : query.isError ? (
        <div role="alert" className="space-y-3">
          <p>{t("errors.save")}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : (
        <>
          {query.data.choices.length === 0 ? (
            <p>{t("history.empty")}</p>
          ) : (
            <ol className="divide-y divide-border">
              {query.data.choices.map((choice, index) => (
                <li
                  key={`${choice.decidedAt}:${index}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4"
                >
                  <div>
                    <p className="font-medium">
                      {t(choice.enabled ? "history.enabled" : "history.disabled")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("history.version", { version: choice.version })}
                    </p>
                  </div>
                  <time dateTime={choice.decidedAt} className="text-sm text-muted-foreground">
                    {new Intl.DateTimeFormat(i18n.language, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(choice.decidedAt))}
                  </time>
                </li>
              ))}
            </ol>
          )}
          <div className="flex gap-3">
            <Button
              variant="outline"
              disabled={cursors.length === 1}
              onClick={() => setCursors((previous) => previous.slice(0, -1))}
            >
              {t("previous")}
            </Button>
            <Button
              variant="outline"
              disabled={!query.data.nextCursor}
              onClick={() =>
                setCursors((previous) => [...previous, query.data.nextCursor ?? undefined])
              }
            >
              {t("history.next")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function ProfileField({ field, journey }: { field: ProfileFieldName; journey: ProfileJourney }) {
  const { t } = useTranslation("profile");
  const error = journey.form.formState.errors[field];
  const source = journey.profile?.fields[field];
  const proposal = source?.proposal;
  const input = journey.form.register(field);
  return (
    <div className={`space-y-2 ${field === "street" ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={`profile-${field}`}>{t(`fields.${field}`)}</Label>
      <Input
        id={`profile-${field}`}
        type={
          field === "birthDate"
            ? "date"
            : field === "phone"
              ? "tel"
              : field === "contactEmail"
                ? "email"
                : "text"
        }
        autoComplete={autocomplete[field]}
        inputMode={field === "avsNumber" ? "numeric" : undefined}
        maxLength={
          field === "street" || field === "contactEmail"
            ? 240
            : field === "phone"
              ? 40
              : field === "postalCode"
                ? 24
                : 160
        }
        className="h-11 text-base md:text-base"
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? `profile-${field}-error` : source ? `profile-${field}-source` : undefined
        }
        {...input}
        onChange={(event) => {
          void input.onChange(event);
          if (proposal) journey.resolveProposal(field, event.target.value);
        }}
      />
      {error && (
        <p role="alert" id={`profile-${field}-error`} className="text-sm text-destructive">
          {t(
            field === "birthDate"
              ? "invalidDate"
              : field === "avsNumber"
                ? "invalidAvsNumber"
                : "invalidField",
          )}
        </p>
      )}
      {source && (
        <p id={`profile-${field}-source`} className="text-xs text-muted-foreground">
          {t(`source.${source.source}`)}
        </p>
      )}
      {proposal && (
        <div className="space-y-2 border-l-2 border-primary pl-3 text-sm">
          <p>{t("proposal.value", { value: proposal.value })}</p>
          {journey.resolved.has(field) ? (
            <p className="text-muted-foreground">{t("proposal.resolved")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => journey.resolveProposal(field, source.value)}
              >
                {t("proposal.keep")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => journey.resolveProposal(field, proposal.value)}
              >
                {t("proposal.use")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProfileEditor({
  identity,
  ownerId,
  blocked,
  embedded = false,
  requestedStep,
  onStepChange,
  onBridge,
}: {
  identity: IdentityMe | null;
  ownerId: string | null;
  blocked: boolean;
  embedded?: boolean;
  requestedStep?: ProfileViewStep | undefined;
  onStepChange?: (step: ProfileViewStep) => void;
  onBridge?: (bridge: ProfileEditorBridge | null) => void;
}) {
  const { t, i18n } = useTranslation("profile");
  const location = useLocation();
  const navigate = useNavigate();
  const journey = useProfileJourney({ identity, ownerId, blocked });
  const values = useWatch({ control: journey.form.control });
  const confirmed =
    Boolean(journey.profile && isProfileConfirmed(journey.profile)) &&
    !journey.isDirty &&
    journey.resolved.size === 0;
  const completion = profileStepCompletion("person", "general", values, confirmed);
  const history =
    new URLSearchParams(location.searchStr).get("view") === "choices" && Boolean(identity);
  const setHistory = (value: boolean) => {
    void navigate({ to: "/profile", search: value ? { view: "choices" } : {} });
  };
  const heading = useRef<HTMLHeadingElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(journey.step);
  const lastRequested = useRef<ProfileViewStep | null | undefined>(null);
  const stepIndex = steps.indexOf(journey.step);
  const unavailableDraft =
    !ownerId &&
    (journey.failure === "expired" ||
      journey.draftEntry?.state === "expired" ||
      journey.draftEntry?.state === "attached");
  const draftUnavailableState = journey.draftEntry?.state === "attached" ? "attached" : "expired";
  const proposals = allFields.filter((field) => journey.profile?.fields[field]?.proposal);
  const unresolved = proposals.filter((field) => !journey.resolved.has(field));
  const changeStep = async (next: (typeof steps)[number]) => {
    if (await journey.move(next)) onStepChange?.(next === "address" ? "details" : next);
  };
  useEffect(() => {
    if (!journey.initialized || lastRequested.current === requestedStep) return;
    lastRequested.current = requestedStep;
    const next = requestedStep === "details" ? "address" : requestedStep;
    if (next && next !== journey.step) void journey.move(next);
  }, [journey, requestedStep]);
  useEffect(() => {
    onBridge?.({
      dirty:
        journey.isDirty ||
        journey.prefillDirty ||
        journey.resolved.size > 0 ||
        Object.keys(journey.dirtyFields).length > 0,
      pending: journey.pending,
      completion: journey.initialized ? profileCompletionAverage(completion) : null,
      scopeKey: `${identity?.user.id}:${identity?.session.id}:self:general`,
      save: () => (journey.prefillDirty ? journey.confirm() : journey.move(journey.step)),
      discard: journey.discard,
    });
  });
  useEffect(() => () => onBridge?.(null), [onBridge]);
  useEffect(() => {
    if (journey.initialized && !blocked) {
      const target = previousStep.current !== journey.step && !history ? stepHeading : heading;
      target.current?.focus();
      previousStep.current = journey.step;
    }
  }, [journey.step, journey.initialized, blocked, history]);
  if (!journey.initialized)
    return journey.loadError ? (
      <div role="alert" className="space-y-4">
        <p>{t("errors.save")}</p>
        <Button variant="outline" onClick={() => void journey.retryLoad()}>
          {t("retry")}
        </Button>
      </div>
    ) : (
      <LoadingState label={t("loading")} />
    );
  return (
    <>
      {!embedded && (
        <div className="space-y-3">
          <p className="wallet-page-eyebrow cv-meta text-muted-foreground">
            {t(ownerId ? "eyebrow.owner" : "eyebrow.draft")}
          </p>
          <h1 ref={heading} tabIndex={-1} className="cv-app-heading outline-none">
            {t(history ? "history.title" : "title")}
          </h1>
          <p className="max-w-xl text-muted-foreground">
            {t(history ? "history.description" : ownerId ? "intro.owner" : "intro.draft")}
          </p>
        </div>
      )}
      {embedded && history && <h2 className="cv-app-subheading">{t("history.title")}</h2>}
      {history && identity && (
        <ProfileChoices identity={identity} onBack={() => setHistory(false)} />
      )}
      <div hidden={history} inert={history} className="space-y-7">
        {identity && <ProfileDocumentDifferences identity={identity} />}
        {new URLSearchParams(location.searchStr).get("authError") && (
          <p role="alert" className="text-destructive">
            {t("callbackError")}
          </p>
        )}
        {unavailableDraft ? (
          <section className="max-w-xl space-y-4">
            <h2 className="cv-app-subheading">{t(`draft.${draftUnavailableState}Title`)}</h2>
            <p className="text-muted-foreground">
              {t(`draft.${draftUnavailableState}Description`)}
            </p>
            <Button disabled={journey.pending} onClick={() => void journey.restart()}>
              {t("draft.restart")}
            </Button>
            {journey.failure && (
              <p role="alert" className="text-destructive">
                {t(`errors.${journey.failure}`)}
              </p>
            )}
          </section>
        ) : (
          <>
            {identity && journey.draftEntry?.draft && (
              <section
                className="max-w-2xl space-y-3 border-l-2 border-primary pl-5"
                aria-label={t("attach.title")}
              >
                <h2 className="font-medium">{t("attach.title")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("attach.description", { step: t(`steps.${journey.draftEntry.draft.step}`) })}
                </p>
                <Button
                  disabled={
                    journey.pending ||
                    journey.isDirty ||
                    journey.prefillDirty ||
                    journey.resolved.size > 0
                  }
                  onClick={() => void journey.attach()}
                >
                  {t("attach.action")}
                </Button>
                {(journey.isDirty || journey.prefillDirty || journey.resolved.size > 0) && (
                  <p className="text-xs text-muted-foreground">{t("attach.saveFirst")}</p>
                )}
              </section>
            )}
            <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,640px)] lg:gap-16">
              <aside className="space-y-6">
                <ProfileSteps
                  step={journey.step === "address" ? "details" : journey.step}
                  completion={completion}
                  labels={{
                    information: t("steps.information"),
                    details: t("steps.address"),
                    review: t("steps.review"),
                  }}
                  disabled={journey.pending || blocked}
                  onChange={(next) => void changeStep(next === "details" ? "address" : next)}
                />
                <p className="hidden max-w-48 text-sm leading-relaxed text-muted-foreground lg:block">
                  {t("privacy")}
                </p>
              </aside>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (journey.step === "review")
                    void (identity ? journey.confirm() : journey.continueLogin());
                  else void changeStep(steps[stepIndex + 1] ?? "review");
                }}
                className="min-w-0 space-y-6"
                aria-busy={journey.pending}
              >
                <div className="space-y-1">
                  <h2
                    ref={stepHeading}
                    tabIndex={-1}
                    className="cv-app-subheading scroll-mt-24 outline-none"
                  >
                    {t(`steps.${journey.step}`)}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t(journey.step === "review" ? "review.intro" : "optional")}
                  </p>
                </div>
                {journey.failure && (
                  <div
                    role="alert"
                    className="space-y-3 border-l-2 border-destructive pl-4 text-sm"
                  >
                    <p>{t(`errors.${journey.failure}`)}</p>
                    {["conflict", "session"].includes(journey.failure) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={journey.pending}
                        onClick={() => void journey.refreshKeepingEdits()}
                      >
                        {t("refresh")}
                      </Button>
                    )}
                  </div>
                )}
                {journey.notice && (
                  <p role="status" className="text-sm text-muted-foreground">
                    {t(`notice.${journey.notice}`)}
                  </p>
                )}
                <fieldset disabled={journey.pending} className="space-y-6">
                  {journey.step !== "review" ? (
                    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                      {(journey.step === "information" ? informationFields : addressFields).map(
                        (field) => (
                          <ProfileField key={field} field={field} journey={journey} />
                        ),
                      )}
                    </div>
                  ) : (
                    <>
                      {proposals.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-sm">{t("proposal.review")}</p>
                          <div className="grid gap-5 sm:grid-cols-2">
                            {proposals.map((field) => (
                              <ProfileField key={field} field={field} journey={journey} />
                            ))}
                          </div>
                        </div>
                      )}
                      {identity ? (
                        <div className="space-y-4 border-t border-border pt-5">
                          <label className="flex cursor-pointer items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1 size-4 shrink-0 accent-primary"
                              checked={journey.prefill}
                              onChange={(event) => journey.setPrefill(event.target.checked)}
                            />
                            <span className="space-y-1">
                              <span className="block text-sm font-medium">
                                {t("prefill.label")}
                              </span>
                              <span className="block text-sm text-muted-foreground">
                                {t("prefill.description")}
                              </span>
                            </span>
                          </label>
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto p-0 text-sm"
                            onClick={() => setHistory(true)}
                          >
                            {t("history.action")}
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{t("review.login")}</p>
                      )}
                    </>
                  )}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    {stepIndex > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void changeStep(steps[stepIndex - 1] ?? "information")}
                      >
                        {t("previous")}
                      </Button>
                    )}
                    <Button
                      type="submit"
                      disabled={
                        journey.step === "review" && Boolean(identity) && unresolved.length > 0
                      }
                    >
                      {t(
                        journey.pending
                          ? "pending"
                          : journey.step !== "review"
                            ? "next"
                            : identity
                              ? "confirm"
                              : "login",
                      )}
                    </Button>
                    {journey.step !== "review" && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void journey.move(journey.step)}
                      >
                        {t("save")}
                      </Button>
                    )}
                  </div>
                </fieldset>
                <p className="text-xs text-muted-foreground">
                  {journey.isDirty ||
                  journey.prefillDirty ||
                  journey.resolved.size > 0 ||
                  Object.keys(journey.dirtyFields).length > 0
                    ? t("unsaved")
                    : journey.saved
                      ? t("saved")
                      : t("notSaved")}
                </p>
                {!ownerId && journey.draftEntry?.draft && (
                  <p className="text-xs text-muted-foreground">
                    {t("draft.expires", {
                      date: new Intl.DateTimeFormat(i18n.language, {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(journey.draftEntry.draft.expiresAt)),
                    })}
                  </p>
                )}
                {!ownerId && journey.step !== "review" && (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-sm"
                    disabled={journey.pending}
                    onClick={() => void journey.continueLogin()}
                  >
                    {t("loginEarly")}
                  </Button>
                )}
              </form>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export function ProfilePage() {
  const { t } = useTranslation("profile");
  const client = useQueryClient();
  const config = useQuery({
    queryKey: ["identity", "config"],
    queryFn: ({ signal }) => api.identityConfig({ signal }),
    staleTime: 0,
    retry: false,
  });
  const identity = useQuery({ ...identityOptions(client), enabled: config.data?.enabled === true });
  const lastIdentity = useRef<IdentityMe | null>(null);
  if (identity.data) lastIdentity.current = identity.data;
  const [ownerId, setOwnerId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (identity.isSuccess && !identity.isFetching) {
      if (identity.data) setOwnerId(identity.data.user.id);
      else setOwnerId((previous) => (previous === undefined ? null : previous));
    }
  }, [identity.data, identity.isSuccess, identity.isFetching]);
  const blocked =
    config.isFetching ||
    identity.isFetching ||
    config.isError ||
    identity.isError ||
    ownerId === undefined ||
    (ownerId !== null && identity.data?.user.id !== ownerId) ||
    (ownerId === null && Boolean(identity.data));
  if (config.data?.enabled === false)
    return (
      <div className="max-w-xl space-y-5">
        <h1 className="cv-app-heading">{t("title")}</h1>
        <p>{t("unavailable")}</p>
        <Button asChild variant="outline">
          <Link to="/account">{t("account")}</Link>
        </Button>
      </div>
    );
  return (
    <>
      {(config.isFetching ||
        identity.isFetching ||
        (ownerId === undefined && !config.isError && !identity.isError)) && (
        <LoadingState label={t("loading")} />
      )}
      {(config.isError || identity.isError) && (
        <div role="alert" className="max-w-xl space-y-4">
          <p>{t("errors.save")}</p>
          <Button
            variant="outline"
            onClick={() => {
              void config.refetch();
              void identity.refetch();
            }}
          >
            {t("retry")}
          </Button>
        </div>
      )}
      {typeof ownerId === "string" &&
        !identity.data &&
        !identity.isFetching &&
        !identity.isError && (
          <section className="max-w-xl space-y-5">
            <h1 className="cv-app-heading">{t("session.title")}</h1>
            <p className="text-muted-foreground">{t("session.description")}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <a
                  href={api.loginUrl("wallet", { continuation: "profile" })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("session.login")}
                </a>
              </Button>
              <Button variant="outline" onClick={() => void identity.refetch()}>
                {t("session.resume")}
              </Button>
            </div>
          </section>
        )}
      {ownerId !== undefined && (
        <div key={ownerId ?? "anonymous"} hidden={blocked} inert={blocked} className="space-y-8">
          {ownerId && lastIdentity.current?.user.id === ownerId ? (
            <ProfileWorkspace
              identity={identity.data ?? lastIdentity.current}
              blocked={blocked}
              renderSelf={(props) => (
                <ProfileEditor
                  {...props}
                  embedded
                  identity={identity.data ?? null}
                  ownerId={ownerId}
                  blocked={blocked}
                />
              )}
            />
          ) : (
            <ProfileEditor identity={identity.data ?? null} ownerId={ownerId} blocked={blocked} />
          )}
        </div>
      )}
    </>
  );
}
