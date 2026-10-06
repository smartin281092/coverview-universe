import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { createPartnerClient } from "@coverview/api-client/partner";
import type { z } from "zod";
import {
  contestQueueSchema,
  organizationProfileQueueSchema,
  profileQueueSchema,
  type EvaluationContestDecision,
  type ProfileImage,
  type ProfileReview,
} from "@coverview/contracts/partner-profiles";
import {
  Button,
  ErrorState,
  Label,
  LoadingState,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@coverview/ui";
import { AdminBoundary } from "../features/users/AdminBoundary";
import { usePictureUrl } from "../features/use-picture";

const client = createPartnerClient(
  import.meta.env.VITE_API_URL ??
    (import.meta.env.DEV ? "http://127.0.0.1:4100" : window.location.origin),
);
const day = new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" });
type Pending = z.infer<typeof profileQueueSchema>["items"][number];
type Contest = z.infer<typeof contestQueueSchema>["items"][number];
type PendingOrganization = z.infer<typeof organizationProfileQueueSchema>["items"][number];

// The picture of the version under review (C8c), shown once scanned; otherwise its state, which
// tells why a publication would be refused.
function SubmittedPicture({
  title,
  image,
  name,
  queryKey,
  load,
}: {
  title: string;
  image: ProfileImage | null;
  name: string;
  queryKey: readonly unknown[];
  load: (signal: AbortSignal) => Promise<Blob>;
}) {
  const { t } = useTranslation("profiles");
  const url = usePictureUrl(queryKey, load, image?.state === "ready" ? image.mime : null);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      {!image ? (
        <p className="text-sm text-muted-foreground">{t("noPicture")}</p>
      ) : (
        <>
          {url && (
            <img
              src={url}
              alt={t("pictureAlt", { name })}
              className="max-h-32 w-auto rounded-lg border border-border object-contain"
            />
          )}
          <p className="text-sm text-muted-foreground">{t(`pictureState.${image.state}`)}</p>
        </>
      )}
    </div>
  );
}

function useAttempt() {
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  return (payload: unknown) => {
    const text = JSON.stringify(payload);
    if (attempt.current?.payload !== text)
      attempt.current = { payload: text, key: crypto.randomUUID() };
    return attempt.current.key;
  };
}

function Decision({
  title,
  description,
  options,
  onSubmit,
  pending,
  failed,
  onClose,
  children,
}: {
  title: string;
  description: string;
  options: { value: string; label: string }[];
  onSubmit: (decision: string, reason: string) => void;
  pending: boolean;
  failed: boolean;
  onClose: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation("profiles"),
    reasonId = useId();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const text = (key: string) => {
      const value = data.get(key);
      return typeof value === "string" ? value.trim() : "";
    };
    onSubmit(text("decision"), text("reason"));
  }
  return (
    <Sheet open onOpenChange={(open) => !open && !pending && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <form className="space-y-5 p-4" onSubmit={submit}>
          {children}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("decision")}</legend>
            {options.map((option, index) => (
              <label key={option.value} className="flex items-center gap-3 text-sm">
                <input
                  type="radio"
                  name="decision"
                  value={option.value}
                  defaultChecked={index === 0}
                  required
                />
                {option.label}
              </label>
            ))}
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor={reasonId}>{t("reason")}</Label>
            <textarea
              id={reasonId}
              name="reason"
              required
              minLength={5}
              maxLength={2000}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {t("saveError")}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {t("save")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Workspace({ identity, blocked }: { identity: IdentityMe; blocked: boolean }) {
  const { t } = useTranslation("profiles"),
    cache = useQueryClient(),
    key = ["private", identity.user.id, identity.session.id, "partner-profiles"],
    attemptFor = useAttempt(),
    [profile, setProfile] = useState<Pending | null>(null),
    [organization, setOrganization] = useState<PendingOrganization | null>(null),
    [contest, setContest] = useState<Contest | null>(null),
    [failed, setFailed] = useState(false);
  const profiles = useQuery({
    queryKey: [...key, "queue"],
    queryFn: ({ signal }) => client.profileQueue(signal),
    enabled: !blocked,
    gcTime: 0,
    retry: false,
  });
  const organizations = useQuery({
    queryKey: [...key, "organizations"],
    queryFn: ({ signal }) => client.organizationProfileQueue(signal),
    enabled: !blocked,
    gcTime: 0,
    retry: false,
  });
  const organizationDossier = useQuery({
    queryKey: [...key, "organization", organization?.organizationId],
    queryFn: ({ signal }) => client.organizationProfile(organization!.organizationId, signal),
    enabled: !!organization && !blocked,
    gcTime: 0,
    retry: false,
  });
  const reviewOrganization = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: ({ organizationId, input }: { organizationId: string; input: ProfileReview }) =>
      client.reviewOrganizationProfile(organizationId, input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: attemptFor({ organizationId, input }),
      }),
    onSuccess: () => {
      setOrganization(null);
      setFailed(false);
      void cache.invalidateQueries({ queryKey: key });
    },
    onError: () => setFailed(true),
  });
  const contests = useQuery({
    queryKey: [...key, "contests"],
    queryFn: ({ signal }) => client.contestQueue(signal),
    enabled: !blocked,
    gcTime: 0,
    retry: false,
  });
  const dossier = useQuery({
    queryKey: [...key, "dossier", profile?.userId],
    queryFn: ({ signal }) => client.profileDossier(profile!.userId, signal),
    enabled: !!profile && !blocked,
    gcTime: 0,
    retry: false,
  });
  const done = () => {
    setProfile(null);
    setContest(null);
    setFailed(false);
    void cache.invalidateQueries({ queryKey: key });
  };
  const review = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: ({ userId, input }: { userId: string; input: ProfileReview }) =>
      client.reviewProfile(userId, input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: attemptFor({ userId, input }),
      }),
    onSuccess: done,
    onError: () => setFailed(true),
  });
  const decide = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: ({ id, input }: { id: string; input: EvaluationContestDecision }) =>
      client.decideContest(id, input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: attemptFor({ id, input }),
      }),
    onSuccess: done,
    onError: () => setFailed(true),
  });
  const failure = (retry: () => void) => (
    <ErrorState
      title={t("error")}
      description={t("error")}
      retryLabel={t("retry")}
      pendingLabel={t("loading")}
      onRetry={retry}
    />
  );
  return (
    <div className="space-y-10">
      <header>
        <Link to="/partner" className="text-sm text-muted-foreground">
          {t("back")}
        </Link>
        <h1 className="cv-app-heading mt-3">{t("title")}</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">{t("description")}</p>
      </header>
      <section className="space-y-4">
        <h2 className="text-lg font-medium">{t("profilesTitle")}</h2>
        {profiles.isPending ? (
          <LoadingState label={t("loading")} />
        ) : profiles.isError ? (
          failure(() => void profiles.refetch())
        ) : profiles.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noProfiles")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {profiles.data.items.map((item) => (
              <li
                key={item.userId}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-medium">
                    {item.name}
                    {" · "}
                    {item.organization}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("submitted", {
                      revision: item.revision,
                      date: day.format(new Date(item.submittedAt)),
                    })}
                  </p>
                </div>
                <Button variant="outline" onClick={() => setProfile(item)}>
                  {t("review")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-medium">{t("organizationsTitle")}</h2>
        {organizations.isPending ? (
          <LoadingState label={t("loading")} />
        ) : organizations.isError ? (
          failure(() => void organizations.refetch())
        ) : organizations.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noOrganizations")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {organizations.data.items.map((item) => (
              <li
                key={item.organizationId}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("submitted", {
                      revision: item.revision,
                      date: day.format(new Date(item.submittedAt)),
                    })}
                  </p>
                </div>
                <Button variant="outline" onClick={() => setOrganization(item)}>
                  {t("review")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-medium">{t("contestsTitle")}</h2>
        {contests.isPending ? (
          <LoadingState label={t("loading")} />
        ) : contests.isError ? (
          failure(() => void contests.refetch())
        ) : contests.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noContests")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {contests.data.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {t("contestBy", {
                      name: item.name,
                      subject: t(`subject.${item.subjectKind}`),
                      date: day.format(new Date(item.createdAt)),
                    })}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {item.reason}
                  </p>
                </div>
                <Button variant="outline" onClick={() => setContest(item)}>
                  {t("decide")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {profile && (
        <Decision
          title={t("reviewTitle", { name: profile.name })}
          description={t("derived")}
          options={[
            { value: "published", label: t("decisions.published") },
            { value: "rejected", label: t("decisions.rejected") },
          ]}
          pending={review.isPending}
          failed={failed}
          onClose={() => setProfile(null)}
          onSubmit={(decision, reason) =>
            review.mutate({
              userId: profile.userId,
              input: {
                revision: profile.revision,
                decision: decision === "rejected" ? "rejected" : "published",
                reason,
              },
            })
          }
        >
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("presentation")}</p>
            {dossier.isPending ? (
              <LoadingState label={t("loading")} />
            ) : dossier.isError ? (
              failure(() => void dossier.refetch())
            ) : (
              <p className="whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-sm">
                {dossier.data.current?.presentation}
              </p>
            )}
          </div>
          {dossier.data && (
            <SubmittedPicture
              title={t("photoTitle")}
              image={dossier.data.current?.photo ?? null}
              name={profile.name}
              queryKey={[...key, "photo", profile.userId, profile.revision]}
              load={(signal) =>
                client.profileVersionPhoto(profile.userId, profile.revision, signal)
              }
            />
          )}
        </Decision>
      )}
      {organization && (
        <Decision
          title={t("organizationReviewTitle", { name: organization.name })}
          description={t("organizationDerived")}
          options={[
            { value: "published", label: t("decisions.published") },
            { value: "rejected", label: t("decisions.rejected") },
          ]}
          pending={reviewOrganization.isPending}
          failed={failed}
          onClose={() => setOrganization(null)}
          onSubmit={(decision, reason) =>
            reviewOrganization.mutate({
              organizationId: organization.organizationId,
              input: {
                revision: organization.revision,
                decision: decision === "rejected" ? "rejected" : "published",
                reason,
              },
            })
          }
        >
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("presentation")}</p>
            {organizationDossier.isPending ? (
              <LoadingState label={t("loading")} />
            ) : organizationDossier.isError ? (
              failure(() => void organizationDossier.refetch())
            ) : (
              <p className="whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-sm">
                {organizationDossier.data.current?.presentation}
              </p>
            )}
          </div>
          {organizationDossier.data && (
            <SubmittedPicture
              title={t("logoTitle")}
              image={organizationDossier.data.current?.logo ?? null}
              name={organization.name}
              queryKey={[...key, "logo", organization.organizationId, organization.revision]}
              load={(signal) =>
                client.organizationVersionLogo(
                  organization.organizationId,
                  organization.revision,
                  signal,
                )
              }
            />
          )}
        </Decision>
      )}
      {contest && (
        <Decision
          title={t("contestTitle", { name: contest.name })}
          description={contest.reason}
          options={[
            { value: "accepted", label: t("decisions.accepted") },
            { value: "rejected", label: t("decisions.rejectedContest") },
          ]}
          pending={decide.isPending}
          failed={failed}
          onClose={() => setContest(null)}
          onSubmit={(decision, reason) =>
            decide.mutate({
              id: contest.id,
              input: { decision: decision === "rejected" ? "rejected" : "accepted", reason },
            })
          }
        />
      )}
    </div>
  );
}

export function PartnerProfilesPage() {
  return (
    <AdminBoundary>
      {(identity, blocked) => <Workspace identity={identity} blocked={blocked} />}
    </AdminBoundary>
  );
}
