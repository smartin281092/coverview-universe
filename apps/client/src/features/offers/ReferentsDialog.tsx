import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { IdentityMe } from "@coverview/api-client";
import { PartnerApiError } from "@coverview/api-client/partner";
import {
  leadCategorySchema,
  referentUpdateSchema,
  type ReferentProfile,
  type ReferentUpdate,
} from "@coverview/contracts/partner";
import {
  Button,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  LoadingState,
  ErrorState,
  EmptyState,
} from "@coverview/ui";
import { api } from "../../api";
import { partnerApi } from "../../partner-api";

const formSchema = z.object({ advisor: z.string().min(1), confirmed: z.boolean().refine(Boolean) });
function SelectionForm({
  presented,
  identity,
  valid,
  onSaved,
  onCancel,
  onPending,
}: {
  presented: ReferentProfile;
  identity: IdentityMe;
  valid: boolean;
  onSaved: () => void;
  onCancel: () => void;
  onPending: (pending: boolean) => void;
}) {
  const { t } = useTranslation("offers");
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { advisor: "", confirmed: false },
  });
  const attempt = useRef<{ key: string; input: ReferentUpdate } | null>(null);
  const [uncertain, setUncertain] = useState(false),
    [error, setError] = useState("");
  const pending = form.formState.isSubmitting;
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit(async (values) => {
          if (pending || (!valid && !uncertain)) return;
          onPending(true);
          setError("");
          if (!attempt.current)
            attempt.current = {
              key: crypto.randomUUID(),
              input: referentUpdateSchema.parse({
                revision: presented.current.revision,
                profileRevision: presented.profileRevision,
                advisorId: values.advisor === "coverview" ? null : values.advisor,
                confirmed: values.confirmed,
              }),
            };
          try {
            await partnerApi.updateReferent(
              presented.profileId,
              presented.category,
              attempt.current.input,
              { csrfToken: identity.csrfToken, idempotencyKey: attempt.current.key },
            );
            onSaved();
          } catch (cause) {
            const retry = !(cause instanceof PartnerApiError) || cause.status >= 500;
            setUncertain(retry);
            setError(
              retry
                ? t("referents.uncertain")
                : cause instanceof PartnerApiError && cause.status === 409
                  ? t("conflict")
                  : t("referents.error"),
            );
            if (!retry) attempt.current = null;
          } finally {
            onPending(false);
          }
        })();
      }}
    >
      <p className="text-sm font-medium">
        {t("referents.forProfile", {
          name: presented.profileName || t("referents.self"),
          category: t(`categories.${presented.category}`),
        })}
      </p>
      <fieldset disabled={pending || uncertain} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="referent-advisor">{t("referents.choose")}</Label>
          <select
            id="referent-advisor"
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            {...form.register("advisor")}
          >
            <option value="">{t("referents.choose")}</option>
            <option value="coverview">{t("referents.noReferent")}</option>
            {presented.candidates.map((item) => (
              <option key={item.id} value={item.id}>
                {t("referents.advisor", { name: item.name, organization: item.organization })}
              </option>
            ))}
          </select>
        </div>
        {!presented.candidates.length && (
          <p className="text-sm text-muted-foreground">{t("referents.noCandidates")}</p>
        )}
        {presented.candidatesTruncated && (
          <p className="text-sm text-muted-foreground">{t("referents.limited")}</p>
        )}
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0 accent-primary"
            {...form.register("confirmed")}
          />
          <span>{t("referents.confirm")}</span>
        </label>
      </fieldset>
      {Object.keys(form.formState.errors).length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {t("referents.required")}
        </p>
      )}
      {!valid && !uncertain && (
        <p role="alert" className="text-sm text-destructive">
          {t("conflict")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
          {t("back")}
        </Button>
        <Button disabled={pending || (!valid && !uncertain)}>
          {pending ? t("referents.loading") : uncertain ? t("retry") : t("referents.save")}
        </Button>
      </div>
    </form>
  );
}
export function ReferentsDialog({
  identity,
  initialProfile,
  initialCategory = "health",
  onClose,
}: {
  identity: IdentityMe;
  initialProfile: string;
  initialCategory?: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("offers"),
    cache = useQueryClient();
  const [profileId, setProfileId] = useState(initialProfile === "all" ? "" : initialProfile);
  const [category, setCategory] = useState(initialCategory);
  const [history, setHistory] = useState(false),
    [before, setBefore] = useState<number>();
  const [editing, setEditing] = useState<ReferentProfile | null>(null),
    [pending, setPending] = useState(false),
    [saved, setSaved] = useState(false);
  const root = ["private", identity.user.id, identity.session.id];
  const profiles = useQuery({
    queryKey: [...root, "managed-profiles"],
    queryFn: ({ signal }) => api.profiles({ signal }),
    gcTime: 0,
    retry: false,
  });
  const query = useQuery({
    queryKey: [...root, "referents", profileId, category, before],
    queryFn: ({ signal }) => partnerApi.referentProfile(profileId, category, before, signal),
    enabled: !!profileId,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: (q) => (pending || q.state.status === "error" ? false : 15000),
  });
  const reset = () => {
    setHistory(false);
    setBefore(undefined);
    setSaved(false);
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-xl"
        showCloseButton={!pending}
        closeLabel={t("close")}
      >
        <DialogHeader>
          <DialogTitle>{t("referents.title")}</DialogTitle>
          <DialogDescription>{t("referents.help")}</DialogDescription>
        </DialogHeader>
        {editing && query.isError ? (
          <ErrorState
            title={t("referents.error")}
            description={t("referents.error")}
            retryLabel={t("retry")}
            pendingLabel={t("referents.loading")}
            onRetry={() => {
              setEditing(null);
              void query.refetch();
            }}
          />
        ) : editing ? (
          <SelectionForm
            presented={editing}
            identity={identity}
            valid={
              !query.isError &&
              query.data?.current.revision === editing.current.revision &&
              query.data?.profileRevision === editing.profileRevision
            }
            onPending={setPending}
            onCancel={() => {
              setEditing(null);
              void query.refetch();
            }}
            onSaved={() => {
              setEditing(null);
              setSaved(true);
              void cache.invalidateQueries({ queryKey: root });
            }}
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="referent-profile">{t("referents.profile")}</Label>
                <select
                  id="referent-profile"
                  value={profileId}
                  disabled={profiles.isPending || profiles.isError}
                  onChange={(event) => {
                    setProfileId(event.target.value);
                    reset();
                  }}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">{t("referents.profile")}</option>
                  {profiles.data?.profiles.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="referent-category">{t("referents.category")}</Label>
                <select
                  id="referent-category"
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value);
                    reset();
                  }}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {leadCategorySchema.options.map((item) => (
                    <option key={item} value={item}>
                      {t(`categories.${item}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {saved && (
              <p role="status" className="text-sm">
                {t("referents.saved")}
              </p>
            )}
            {profiles.isError || query.isError ? (
              <ErrorState
                title={t("referents.error")}
                description={t("referents.error")}
                retryLabel={t("retry")}
                pendingLabel={t("referents.loading")}
                onRetry={() => {
                  void profiles.refetch();
                  if (profileId) void query.refetch();
                }}
              />
            ) : !profileId ? (
              <EmptyState title={t("referents.profile")} description={t("referents.profileHelp")} />
            ) : query.isPending ? (
              <LoadingState label={t("referents.loading")} />
            ) : history ? (
              <>
                <h2 className="font-medium">{t("referents.history")}</h2>
                {!query.data.history.length && (
                  <p className="text-sm text-muted-foreground">{t("referents.emptyHistory")}</p>
                )}
                <ol className="divide-y divide-border">
                  {query.data.history.map((item) => (
                    <li key={item.revision} className="space-y-1 py-3 text-sm">
                      <p>
                        {item.advisor
                          ? t("referents.advisor", {
                              name: item.advisor.name,
                              organization: item.advisor.organization,
                            })
                          : t("referents.noReferent")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat(i18n.language, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(item.confirmedAt))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          item.currentOwnerConfirmation
                            ? "referents.byCurrentOwner"
                            : "referents.byPreviousState",
                        )}
                      </p>
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setHistory(false);
                      setBefore(undefined);
                    }}
                  >
                    {t("back")}
                  </Button>
                  {query.data.nextBeforeRevision && (
                    <Button
                      variant="outline"
                      onClick={() => setBefore(query.data.nextBeforeRevision!)}
                    >
                      {t("next")}
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2 rounded-xl border border-border p-4">
                  {query.data.current.advisor && (
                    <p className="font-medium">
                      {t("referents.advisor", {
                        name: query.data.current.advisor.name,
                        organization: query.data.current.advisor.organization,
                      })}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {t(`referents.status.${query.data.current.status}`)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => {
                      setSaved(false);
                      setEditing(query.data);
                    }}
                  >
                    {t("referents.change")}
                  </Button>
                  <Button variant="outline" onClick={() => setHistory(true)}>
                    {t("referents.history")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t("referents.existingLeads")}</p>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
