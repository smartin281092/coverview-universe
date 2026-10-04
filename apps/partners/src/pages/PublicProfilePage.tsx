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
import { profileInputSchema, type ProfileDossier } from "@coverview/contracts/partner-profiles";
import { partnerApi } from "../api";
import { usePartner } from "../features/PartnerSession";
import { PublicProfileView } from "../features/PublicProfileView";
import { ProfileEvaluation } from "../features/ProfileEvaluation";
import { readText } from "../features/Field";

function useMutationKey() {
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  return (payload: unknown) => {
    const text = JSON.stringify(payload);
    if (attempt.current?.payload !== text)
      attempt.current = { payload: text, key: crypto.randomUUID() };
    return attempt.current.key;
  };
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
    abort = useRef(new AbortController());
  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    return () => controller.abort();
  }, []);
  const refresh = () =>
    void cache.invalidateQueries({ queryKey: [...session.queryKey, "profile", dossier.userId] });
  const submit = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (presentation: string) => {
      const input = profileInputSchema.parse({
        revision: dossier.current?.revision ?? 0,
        presentation,
        confirmed: true,
      });
      return partnerApi.submitProfile(dossier.userId, input, {
        csrfToken: session.identity.csrfToken,
        idempotencyKey: keyFor(input),
        signal: abort.current.signal,
      });
    },
    onSuccess: refresh,
    onError: () => setError(true),
  });
  const withdraw = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (reason: string) =>
      partnerApi.withdrawProfile(dossier.userId, reason, {
        csrfToken: session.identity.csrfToken,
        idempotencyKey: keyFor({ withdraw: reason }),
        signal: abort.current.signal,
      }),
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
  const status = dossier.current?.status ?? "none";
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="font-medium">{t(`status.${status}`)}</p>
        {dossier.current?.decisionReason && status === "rejected" && (
          <p className="text-sm text-muted-foreground">
            {t("decisionReason", { reason: dossier.current.decisionReason })}
          </p>
        )}
        {status === "submitted" && dossier.published && (
          <p className="text-sm text-muted-foreground">{t("pendingNotice")}</p>
        )}
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
              defaultValue={dossier.current?.presentation ?? ""}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
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

export function PublicProfilePage() {
  const { t } = useTranslation("profiles"),
    { t: base } = useTranslation(),
    session = usePartner(),
    userId = session.identity.user.id;
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
        </TabsList>
        <TabsContent value="profile" className="pt-6">
          {dossier.isPending ? (
            <LoadingState label={base("loading")} />
          ) : dossier.isError ? (
            <ErrorState
              title={base("error")}
              description={base("error")}
              retryLabel={base("retry")}
              pendingLabel={base("loading")}
              onRetry={() => void dossier.refetch()}
            />
          ) : (
            <ProfileEditor key={dossier.data.current?.revision ?? 0} dossier={dossier.data} />
          )}
        </TabsContent>
        <TabsContent value="evaluation" className="pt-6">
          {evaluation.isPending ? (
            <LoadingState label={base("loading")} />
          ) : evaluation.isError ? (
            <ErrorState
              title={base("error")}
              description={base("error")}
              retryLabel={base("retry")}
              pendingLabel={base("loading")}
              onRetry={() => void evaluation.refetch()}
            />
          ) : (
            <ProfileEvaluation evaluation={evaluation.data} />
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
