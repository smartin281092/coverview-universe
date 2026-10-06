import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Button,
  Label,
  LoadingState,
  ErrorState,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@coverview/ui";
import {
  organizationProfileInputSchema,
  profileInputSchema,
  type OrganizationProfileDossier,
  type ProfileDossier,
} from "@coverview/contracts/partner-profiles";
import { partnerApi } from "../api";
import { usePartner } from "../features/PartnerSession";
import { PublicProfileView } from "../features/PublicProfileView";
import { ProfileEvaluation } from "../features/ProfileEvaluation";
import { readText } from "../features/Field";
import {
  PicturePicker,
  PictureState,
  choiceInput,
  type PictureChoice,
} from "../features/PicturePicker";
import { usePictureUrl } from "../features/use-picture";

function useMutationKey() {
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  return (payload: unknown) => {
    const text = JSON.stringify(payload);
    if (attempt.current?.payload !== text)
      attempt.current = { payload: text, key: crypto.randomUUID() };
    return attempt.current.key;
  };
}
function useAbort() {
  const abort = useRef(new AbortController());
  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    return () => controller.abort();
  }, []);
  return abort;
}

function ProfileEditor({ dossier }: { dossier: ProfileDossier }) {
  const { t } = useTranslation("profiles"),
    session = usePartner(),
    cache = useQueryClient(),
    presentationId = useId(),
    confirmId = useId(),
    reasonId = useId(),
    keyFor = useMutationKey(),
    [error, setError] = useState(false),
    [withdrawing, setWithdrawing] = useState(false),
    [picture, setPicture] = useState<PictureChoice>({ mode: "keep" }),
    abort = useAbort();
  const refresh = () =>
    void cache.invalidateQueries({ queryKey: [...session.queryKey, "profile", dossier.userId] });
  const current = dossier.current;
  const currentUrl = usePictureUrl(
    [...session.queryKey, "profile-photo", dossier.userId, current?.revision ?? 0],
    (signal) => partnerApi.profileVersionPhoto(dossier.userId, current!.revision, signal),
    current?.photo?.state === "ready" ? current.photo.mime : null,
  );
  const options = (payload: unknown) => ({
    csrfToken: session.identity.csrfToken,
    idempotencyKey: keyFor(payload),
    signal: abort.current.signal,
  });
  // The new photo is sent right after the version that announces it, before the editor reloads.
  const submit = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: async (presentation: string) => {
      const input = profileInputSchema.parse({
        revision: current?.revision ?? 0,
        presentation,
        photo: choiceInput(picture),
        confirmed: true,
      });
      const result = await partnerApi.submitProfile(dossier.userId, input, options(input));
      if (picture.mode === "file" && result.current?.photo?.canUpload)
        return partnerApi.uploadProfilePhoto(
          dossier.userId,
          picture.picture.blob,
          options({ upload: picture.picture.input.checksum }),
        );
      return result;
    },
    onSuccess: refresh,
    onError: () => {
      setError(true);
      refresh();
    },
  });
  const retry = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (documentRevision: number) =>
      partnerApi.retryProfilePhoto(
        dossier.userId,
        documentRevision,
        options({ retry: documentRevision }),
      ),
    onSuccess: refresh,
    onError: () => setError(true),
  });
  const withdraw = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (reason: string) =>
      partnerApi.withdrawProfile(dossier.userId, reason, options({ withdraw: reason })),
    onSuccess: () => {
      setWithdrawing(false);
      refresh();
    },
    onError: () => setError(true),
  });
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submit.isPending) return;
    const data = new FormData(event.currentTarget);
    const presentation = readText(data, "presentation");
    if (presentation.length < 40 || data.get("confirmed") !== "on") {
      setError(true);
      return;
    }
    setError(false);
    submit.mutate(presentation);
  }
  function onWithdraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (withdraw.isPending) return;
    const reason = readText(new FormData(event.currentTarget), "reason");
    if (reason.length < 5) {
      setError(true);
      return;
    }
    setError(false);
    withdraw.mutate(reason);
  }
  const status = current?.status ?? "none";
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="font-medium">{t(`status.${status}`)}</p>
        {current?.decisionReason && status === "rejected" && (
          <p className="text-sm text-muted-foreground">
            {t("decisionReason", { reason: current.decisionReason })}
          </p>
        )}
        {status === "submitted" && dossier.published && (
          <p className="text-sm text-muted-foreground">{t("pendingNotice")}</p>
        )}
        <PictureState
          image={current?.photo ?? null}
          pending={retry.isPending}
          onSend={null}
          onRetry={() => current?.photo && retry.mutate(current.photo.documentRevision)}
        />
      </div>
      <section className="space-y-3 rounded-xl border border-border p-5">
        <h2 className="font-medium">{t("publishedTitle")}</h2>
        {dossier.published ? (
          <PublicProfileView profile={dossier.published} />
        ) : (
          <p className="text-sm text-muted-foreground">{t("notPublished")}</p>
        )}
      </section>
      {dossier.canEdit && (
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor={presentationId}>{t("presentation")}</Label>
            <p className="text-xs text-muted-foreground">{t("presentationHelp")}</p>
            <textarea
              id={presentationId}
              name="presentation"
              required
              minLength={40}
              maxLength={1200}
              rows={6}
              defaultValue={current?.presentation ?? ""}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <PicturePicker
            kind="photo"
            current={current?.photo ?? null}
            currentUrl={currentUrl}
            choice={picture}
            onChange={setPicture}
          />
          <label className="flex items-start gap-3 text-sm" htmlFor={confirmId}>
            <input id={confirmId} name="confirmed" type="checkbox" required className="mt-1" />
            {t("confirm")}
          </label>
          <Button type="submit" disabled={submit.isPending}>
            {t("submit")}
          </Button>
        </form>
      )}
      {dossier.canEdit && dossier.published && (
        <div className="space-y-3">
          {!withdrawing ? (
            <Button variant="outline" onClick={() => setWithdrawing(true)}>
              {t("withdraw")}
            </Button>
          ) : (
            <form className="space-y-3" onSubmit={onWithdraw}>
              <Label htmlFor={reasonId}>{t("withdrawReason")}</Label>
              <textarea
                id={reasonId}
                name="reason"
                required
                minLength={5}
                maxLength={2000}
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <div className="flex gap-3">
                <Button type="submit" variant="destructive" disabled={withdraw.isPending}>
                  {t("withdrawConfirm")}
                </Button>
                <Button type="button" variant="outline" onClick={() => setWithdrawing(false)}>
                  {t("cancel")}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t("error")}
        </p>
      )}
    </div>
  );
}

// The organisation profile, written by its managers and published after CoverView's review (C8c).
function OrganizationEditor({ dossier }: { dossier: OrganizationProfileDossier }) {
  const { t } = useTranslation("profiles"),
    session = usePartner(),
    cache = useQueryClient(),
    presentationId = useId(),
    confirmId = useId(),
    reasonId = useId(),
    keyFor = useMutationKey(),
    [error, setError] = useState(false),
    [withdrawing, setWithdrawing] = useState(false),
    [logo, setLogo] = useState<PictureChoice>({ mode: "keep" }),
    abort = useAbort();
  const refresh = () =>
    void cache.invalidateQueries({
      queryKey: [...session.queryKey, "organization-profile", dossier.organizationId],
    });
  const current = dossier.current;
  const currentUrl = usePictureUrl(
    [...session.queryKey, "organization-logo", dossier.organizationId, current?.revision ?? 0],
    (signal) =>
      partnerApi.organizationVersionLogo(dossier.organizationId, current!.revision, signal),
    current?.logo?.state === "ready" ? current.logo.mime : null,
  );
  const options = (payload: unknown) => ({
    csrfToken: session.identity.csrfToken,
    idempotencyKey: keyFor(payload),
    signal: abort.current.signal,
  });
  const submit = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: async (presentation: string) => {
      const input = organizationProfileInputSchema.parse({
        revision: current?.revision ?? 0,
        presentation,
        logo: choiceInput(logo),
        confirmed: true,
      });
      const result = await partnerApi.submitOrganizationProfile(
        dossier.organizationId,
        input,
        options(input),
      );
      if (logo.mode === "file" && result.current?.logo?.canUpload)
        return partnerApi.uploadOrganizationLogo(
          dossier.organizationId,
          logo.picture.blob,
          options({ upload: logo.picture.input.checksum }),
        );
      return result;
    },
    onSuccess: refresh,
    onError: () => {
      setError(true);
      refresh();
    },
  });
  const retry = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (documentRevision: number) =>
      partnerApi.retryOrganizationLogo(
        dossier.organizationId,
        documentRevision,
        options({ retry: documentRevision }),
      ),
    onSuccess: refresh,
    onError: () => setError(true),
  });
  const withdraw = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (reason: string) =>
      partnerApi.withdrawOrganizationProfile(
        dossier.organizationId,
        reason,
        options({ withdraw: reason }),
      ),
    onSuccess: () => {
      setWithdrawing(false);
      refresh();
    },
    onError: () => setError(true),
  });
  const status = current?.status ?? "none";
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="font-medium">{t(`status.${status}`)}</p>
        {current?.decisionReason && status === "rejected" && (
          <p className="text-sm text-muted-foreground">
            {t("decisionReason", { reason: current.decisionReason })}
          </p>
        )}
        <PictureState
          image={current?.logo ?? null}
          pending={retry.isPending}
          onSend={null}
          onRetry={() => current?.logo && retry.mutate(current.logo.documentRevision)}
        />
      </div>
      <section className="space-y-2 rounded-xl border border-border p-5 text-sm">
        <h2 className="font-medium">{t("organization.publishedTitle")}</h2>
        {dossier.published ? (
          <p className="whitespace-pre-wrap">{dossier.published.presentation}</p>
        ) : (
          <p className="text-muted-foreground">{t("organization.notPublished")}</p>
        )}
      </section>
      {dossier.canEdit && (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (submit.isPending) return;
            const data = new FormData(event.currentTarget);
            const presentation = readText(data, "presentation");
            if (presentation.length < 40 || data.get("confirmed") !== "on") {
              setError(true);
              return;
            }
            setError(false);
            submit.mutate(presentation);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={presentationId}>{t("organization.presentation")}</Label>
            <p className="text-xs text-muted-foreground">{t("organization.presentationHelp")}</p>
            <textarea
              id={presentationId}
              name="presentation"
              required
              minLength={40}
              maxLength={1200}
              rows={5}
              defaultValue={current?.presentation ?? ""}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <PicturePicker
            kind="logo"
            current={current?.logo ?? null}
            currentUrl={currentUrl}
            choice={logo}
            onChange={setLogo}
          />
          <label className="flex items-start gap-3 text-sm" htmlFor={confirmId}>
            <input id={confirmId} name="confirmed" type="checkbox" required className="mt-1" />
            {t("organization.confirm")}
          </label>
          <Button type="submit" disabled={submit.isPending}>
            {t("submit")}
          </Button>
        </form>
      )}
      {dossier.canEdit && dossier.published && (
        <div className="space-y-3">
          {!withdrawing ? (
            <Button variant="outline" onClick={() => setWithdrawing(true)}>
              {t("organization.withdraw")}
            </Button>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (withdraw.isPending) return;
                const reason = readText(new FormData(event.currentTarget), "reason");
                if (reason.length < 5) {
                  setError(true);
                  return;
                }
                setError(false);
                withdraw.mutate(reason);
              }}
            >
              <Label htmlFor={reasonId}>{t("withdrawReason")}</Label>
              <textarea
                id={reasonId}
                name="reason"
                required
                minLength={5}
                maxLength={2000}
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <div className="flex gap-3">
                <Button type="submit" variant="destructive" disabled={withdraw.isPending}>
                  {t("withdrawConfirm")}
                </Button>
                <Button type="button" variant="outline" onClick={() => setWithdrawing(false)}>
                  {t("cancel")}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t("error")}
        </p>
      )}
    </div>
  );
}

export function PublicProfilePage() {
  const { t } = useTranslation("profiles"),
    { t: base } = useTranslation(),
    session = usePartner(),
    userId = session.identity.user.id,
    application = session.context.application;
  const manager = session.context.operational && !!application?.grantedRoles.includes("manager");
  const dossier = useQuery({
    queryKey: [...session.queryKey, "profile", userId],
    queryFn: ({ signal }) => partnerApi.profileDossier(userId, signal),
    gcTime: 0,
  });
  const evaluation = useQuery({
    queryKey: [...session.queryKey, "evaluation", userId],
    queryFn: ({ signal }) => partnerApi.evaluation(userId, signal),
    gcTime: 0,
  });
  const organization = useQuery({
    queryKey: [...session.queryKey, "organization-profile", application?.organizationId ?? ""],
    queryFn: ({ signal }) => partnerApi.organizationProfile(application!.organizationId, signal),
    enabled: manager,
    gcTime: 0,
  });
  const failure = (retry: () => void) => (
    <ErrorState
      title={base("error")}
      description={base("error")}
      retryLabel={base("retry")}
      pendingLabel={base("loading")}
      onRetry={retry}
    />
  );
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </header>
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">{t("tabs.profile")}</TabsTrigger>
          <TabsTrigger value="evaluation">{t("tabs.evaluation")}</TabsTrigger>
          {manager && <TabsTrigger value="organization">{t("tabs.organization")}</TabsTrigger>}
        </TabsList>
        <TabsContent value="profile" className="pt-6">
          {dossier.isPending ? (
            <LoadingState label={base("loading")} />
          ) : dossier.isError ? (
            failure(() => void dossier.refetch())
          ) : (
            <ProfileEditor key={dossier.data.current?.revision ?? 0} dossier={dossier.data} />
          )}
        </TabsContent>
        <TabsContent value="evaluation" className="pt-6">
          {evaluation.isPending ? (
            <LoadingState label={base("loading")} />
          ) : evaluation.isError ? (
            failure(() => void evaluation.refetch())
          ) : (
            <ProfileEvaluation evaluation={evaluation.data} />
          )}
        </TabsContent>
        {manager && (
          <TabsContent value="organization" className="pt-6">
            {organization.isPending ? (
              <LoadingState label={base("loading")} />
            ) : organization.isError ? (
              failure(() => void organization.refetch())
            ) : (
              <OrganizationEditor
                key={organization.data.current?.revision ?? 0}
                dossier={organization.data}
              />
            )}
          </TabsContent>
        )}
      </Tabs>
    </section>
  );
}
