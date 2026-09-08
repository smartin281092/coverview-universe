import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useBlocker, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Building2, HeartPulse, Plus, UserRound, Wallet } from "lucide-react";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import {
  managedProfileCreateInputSchema,
  managedProfileIdSchema,
  profileSectionNameSchema,
  profileSectionStepSchema,
  type ManagedProfileCreateInput,
  type ProfileSectionName,
} from "@coverview/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  LoadingState,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@coverview/ui";
import { api } from "../../api";
import { forgetIdentity } from "../identity/session-state";
import { ProfileSectionEditor } from "./ProfileSectionEditor";
import { IdentityAttachment } from "../authorizations/IdentityAttachment";
import { type ProfileEditorBridge, type ProfileViewStep } from "./ProfileSteps";

type SelfProps = {
  requestedStep?: ProfileViewStep | undefined;
  onStepChange: (step: ProfileViewStep) => void;
  onBridge: (bridge: ProfileEditorBridge | null) => void;
};
export function ProfileWorkspace({
  identity,
  blocked,
  renderSelf,
}: {
  identity: IdentityMe;
  blocked: boolean;
  renderSelf: (props: SelfProps) => ReactNode;
}) {
  const { t, i18n } = useTranslation("profile");
  const client = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.searchStr);
  const person = managedProfileIdSchema.safeParse(params.get("person")).data ?? "self";
  const requestedTab = profileSectionNameSchema.safeParse(params.get("tab")).data ?? "general";
  const queryKey = ["private", identity.user.id, identity.session.id, "managed-profiles"];
  const profiles = useQuery({
    queryKey,
    queryFn: ({ signal }) => api.profiles({ signal }),
    enabled: !blocked,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [previousIndex, setPreviousIndex] = useState<{
    ownerId: string;
    data: Awaited<ReturnType<typeof api.profiles>>;
  } | null>(null);
  useEffect(() => {
    if (profiles.data) setPreviousIndex({ ownerId: identity.user.id, data: profiles.data });
    else setPreviousIndex((previous) => (previous?.ownerId === identity.user.id ? previous : null));
  }, [identity.user.id, profiles.data]);
  const index =
    profiles.data ?? (previousIndex?.ownerId === identity.user.id ? previousIndex.data : undefined);
  const selected = index?.profiles.find((profile) => profile.id === person);
  const tab =
    selected?.kind === "legal_entity" && requestedTab === "health" ? "general" : requestedTab;
  const parsedStep =
    tab === requestedTab ? profileSectionStepSchema.safeParse(params.get("step")).data : undefined;
  const requestedStep =
    parsedStep === "review"
      ? "details"
      : parsedStep === "contact" && tab !== "general"
        ? "information"
        : parsedStep;
  const editorScope = `${identity.user.id}:${identity.session.id}:${person}:${tab}`;
  useEffect(() => {
    if (!blocked && profiles.data && selected?.kind === "legal_entity" && requestedTab === "health")
      void navigate({ to: "/profile", search: { person, tab: "general" }, replace: true });
    else if (!blocked && profiles.data && selected && requestedStep && parsedStep !== requestedStep)
      void navigate({
        to: "/profile",
        search: { person, tab, step: requestedStep },
        replace: true,
      });
  }, [
    blocked,
    profiles.data,
    selected,
    requestedTab,
    parsedStep,
    requestedStep,
    person,
    tab,
    navigate,
  ]);
  const awaitingIndex = !profiles.data;
  const editorBlocked = blocked || awaitingIndex;
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const bridge = useRef<ProfileEditorBridge | null>(null);
  const [editing, setEditing] = useState<{
    dirty: boolean;
    pending: boolean;
    completion: number | null;
    scopeKey: string | null;
  }>({ dirty: false, pending: false, completion: null, scopeKey: null });
  const onBridge = useCallback((value: ProfileEditorBridge | null) => {
    bridge.current = value;
    const next = {
      dirty: value?.dirty ?? false,
      pending: value?.pending ?? false,
      completion: value?.completion ?? null,
      scopeKey: value?.scopeKey ?? null,
    };
    setEditing((previous) =>
      previous.dirty === next.dirty &&
      previous.pending === next.pending &&
      previous.completion === next.completion &&
      previous.scopeKey === next.scopeKey
        ? previous
        : next,
    );
  }, []);
  const [guardSaving, setGuardSaving] = useState(false);
  const [guardFailure, setGuardFailure] = useState(false);
  const blocker = useBlocker({
    shouldBlockFn: () => Boolean(bridge.current?.dirty || bridge.current?.pending),
    enableBeforeUnload: () => Boolean(bridge.current?.dirty || bridge.current?.pending),
    withResolver: true,
  });
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const sessionScope = `${identity.user.id}:${identity.session.id}`;
  const currentScope = useRef(sessionScope);
  currentScope.current = sessionScope;
  const blockedNow = useRef(editorBlocked);
  blockedNow.current = editorBlocked;
  const creation = useRef<{ signature: string; key: string } | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const addForm = useForm<ManagedProfileCreateInput>({
    resolver: zodResolver(managedProfileCreateInputSchema),
    defaultValues: { kind: "person", displayName: "" },
  });
  const addKind = addForm.watch("kind");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    controller.current?.abort();
    controller.current = null;
    busy.current = false;
    setCreating(false);
    setGuardSaving(false);
  }, [sessionScope]);
  useEffect(() => {
    if (profiles.error instanceof ApiError && profiles.error.code === "IDENTITY_UNAUTHENTICATED")
      void forgetIdentity(client);
  }, [profiles.error, client]);
  const change = (
    nextPerson: typeof person,
    nextTab: ProfileSectionName = "general",
    step?: ProfileViewStep,
    ignoreBlocker = false,
  ) => {
    void navigate({
      to: "/profile",
      search: { person: nextPerson, tab: nextTab, ...(step ? { step } : {}) },
      ignoreBlocker,
    });
  };
  const onStepChange = (step: ProfileViewStep) => change(person, tab, step, true);
  const saveBeforeLeaving = async () => {
    if (!bridge.current || guardSaving || editorBlocked) return;
    const scope = sessionScope;
    const editor = bridge.current;
    setGuardSaving(true);
    setGuardFailure(false);
    try {
      const successful = await editor.save();
      if (!mounted.current || currentScope.current !== scope || blockedNow.current) return;
      if (successful) blocker.proceed?.();
      else setGuardFailure(true);
    } finally {
      if (mounted.current && currentScope.current === scope) setGuardSaving(false);
    }
  };
  const create = addForm.handleSubmit(async (input) => {
    if (busy.current || blockedNow.current || currentScope.current !== sessionScope) return;
    const scope = sessionScope;
    busy.current = true;
    setCreating(true);
    setCreateError(false);
    const signature = JSON.stringify(input);
    if (creation.current?.signature !== signature)
      creation.current = { signature, key: crypto.randomUUID() };
    const active = new AbortController();
    controller.current = active;
    const isCurrent = () =>
      mounted.current &&
      currentScope.current === scope &&
      controller.current === active &&
      !active.signal.aborted;
    try {
      const result = await api.createManagedProfile(input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: creation.current.key,
        signal: active.signal,
      });
      if (!isCurrent()) return;
      client.setQueryData(
        queryKey,
        (current: Awaited<ReturnType<typeof api.profiles>> | undefined) => ({
          profiles: [
            ...(current?.profiles.filter((entry) => entry.id !== result.id) ?? []),
            result,
          ],
        }),
      );
      setAdding(false);
      addForm.reset({ kind: "person", displayName: "" });
      creation.current = null;
      change(result.id);
    } catch (error) {
      if (!isCurrent()) return;
      setCreateError(true);
      if (error instanceof ApiError && error.code === "IDENTITY_UNAUTHENTICATED")
        await forgetIdentity(client);
    } finally {
      if (controller.current === active) {
        busy.current = false;
        if (mounted.current && currentScope.current === scope) setCreating(false);
      }
    }
  });
  if (!index)
    return profiles.isError ? (
      <div role="alert" className="space-y-3">
        <p>{t("errors.save")}</p>
        <Button variant="outline" onClick={() => void profiles.refetch()}>
          {t("retry")}
        </Button>
      </div>
    ) : (
      <LoadingState label={t("loading")} />
    );
  const percent = (value: number | null) =>
    value === null
      ? t("workspace.notApplicable")
      : new Intl.NumberFormat(i18n.language, { style: "percent", maximumFractionDigits: 0 }).format(
          value / 100,
        );
  const tabs = (
    [
      { id: "general", icon: UserRound },
      { id: "finances", icon: Wallet },
      { id: "health", icon: HeartPulse },
    ] as const
  ).filter(({ id }) => id !== "health" || selected?.kind !== "legal_entity");
  return (
    <>
      {awaitingIndex &&
        (profiles.isError ? (
          <div role="alert" className="space-y-3">
            <p>{t("errors.save")}</p>
            <Button variant="outline" onClick={() => void profiles.refetch()}>
              {t("retry")}
            </Button>
          </div>
        ) : (
          <LoadingState label={t("loading")} />
        ))}
      <div hidden={editorBlocked} inert={editorBlocked} className="space-y-6">
        <div ref={setPortalContainer} className="contents" />
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label={t("workspace.chooseProfile")}
        >
          {index.profiles.map((profile) => {
            const Icon = profile.kind === "legal_entity" ? Building2 : UserRound;
            return (
              <Button
                key={profile.id}
                type="button"
                variant={person === profile.id ? "default" : "outline"}
                className="min-h-11 max-w-full rounded-full px-4"
                aria-pressed={person === profile.id}
                disabled={guardSaving || creating}
                onClick={() => change(profile.id)}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {profile.isSelf ? t("workspace.self") : profile.displayName}
                </span>
              </Button>
            );
          })}
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 rounded-full"
            disabled={creating || index.profiles.length >= 50}
            onClick={() => {
              setAdding(true);
              setCreateError(false);
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            {t("workspace.add")}
          </Button>
        </div>
        <div className="cv-tabbed-page">
          <header className="space-y-3">
            <p className="wallet-page-eyebrow cv-meta text-muted-foreground">
              {t("eyebrow.owner")}
            </p>
            <h1 className="cv-app-heading">
              {selected?.isSelf
                ? t("workspace.title")
                : (selected?.displayName ?? t("workspace.title"))}
            </h1>
            <p className="max-w-2xl text-muted-foreground">{t("intro.owner")}</p>
          </header>
          {!selected ? (
            <div role="alert" className="space-y-3">
              <p>{t("workspace.notFound")}</p>
              <Button variant="outline" onClick={() => change("self")}>
                {t("workspace.returnSelf")}
              </Button>
            </div>
          ) : (
            <Tabs
              value={tab}
              onValueChange={(value) => {
                const next = profileSectionNameSchema.safeParse(value);
                if (next.success) change(person, next.data);
              }}
              className="gap-7"
            >
              <TabsList
                aria-label={t("workspace.sections")}
                className="min-h-[70px] w-full sm:w-auto"
              >
                {tabs.map(({ id, icon: Icon }) => (
                  <TabsTrigger
                    key={id}
                    value={id}
                    className="min-h-16 min-w-0 flex-1 px-2 sm:min-w-36 sm:px-5"
                    disabled={guardSaving || creating}
                  >
                    <span className="flex min-w-0 flex-col items-center gap-1">
                      <span className="flex items-center gap-1.5 text-sm">
                        <Icon className="hidden size-4 sm:block" aria-hidden="true" />
                        {t(`workspace.tabs.${id}`)}
                      </span>
                      <span className="text-xs font-normal opacity-75">
                        {percent(
                          id === tab &&
                            editing.scopeKey === editorScope &&
                            editing.completion !== null
                            ? editing.completion
                            : selected.completion[id],
                        )}
                      </span>
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value={tab} className="min-w-0">
                {profiles.isError && (
                  <p role="alert" className="mb-4 text-sm text-destructive">
                    {t("errors.save")}
                  </p>
                )}
                {selected.isSelf && tab === "general" ? (
                  renderSelf({ requestedStep, onStepChange, onBridge })
                ) : (
                  <ProfileSectionEditor
                    key={`${selected.id}:${tab}`}
                    identity={identity}
                    profile={selected}
                    section={tab}
                    requestedStep={requestedStep}
                    onStepChange={onStepChange}
                    onBridge={onBridge}
                    portalContainer={portalContainer}
                    blocked={editorBlocked}
                  />
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
        {selected && tab === "general" && (
          <IdentityAttachment
            key={`${identity.user.id}:${identity.session.id}:${selected.id}`}
            identity={identity}
            profileId={selected.id}
            company={selected.kind === "legal_entity"}
            blocked={editorBlocked}
          />
        )}
        <Dialog
          open={adding && !editorBlocked}
          onOpenChange={(value) => {
            if (!creating) setAdding(value);
          }}
        >
          <DialogContent
            portalContainer={portalContainer}
            className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 sm:max-w-lg"
          >
            <DialogHeader>
              <DialogTitle className="text-lg">{t("workspace.addTitle")}</DialogTitle>
              <DialogDescription className="text-sm">
                {t("workspace.addDescription")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(event) => void create(event)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="profile-kind">{t("workspace.kind")}</Label>
                <Select
                  value={addKind}
                  onValueChange={(value) => {
                    if (value === "person" || value === "legal_entity")
                      addForm.setValue("kind", value);
                  }}
                  disabled={creating}
                >
                  <SelectTrigger id="profile-kind" className="min-h-11 w-full text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent portalContainer={portalContainer}>
                    <SelectItem value="person">{t("workspace.person")}</SelectItem>
                    <SelectItem value="legal_entity">{t("workspace.entity")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-display-name">
                  {t(addKind === "person" ? "workspace.personName" : "workspace.entityName")}
                </Label>
                <Input
                  id="profile-display-name"
                  maxLength={160}
                  className="min-h-11 text-base"
                  aria-invalid={Boolean(addForm.formState.errors.displayName)}
                  disabled={creating}
                  {...addForm.register("displayName")}
                />
                {addForm.formState.errors.displayName && (
                  <p role="alert" className="text-sm text-destructive">
                    {t("invalidField")}
                  </p>
                )}
              </div>
              {createError && (
                <p role="alert" className="text-sm text-destructive">
                  {t("errors.save")}
                </p>
              )}
              <DialogFooter className="gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={creating}
                  onClick={() => setAdding(false)}
                >
                  {t("workspace.cancel")}
                </Button>
                <Button type="submit" disabled={creating}>
                  {t(creating ? "pending" : "workspace.create")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog
          open={blocker.status === "blocked" && !editorBlocked}
          onOpenChange={(value) => {
            if (!value && !guardSaving && !editing.pending) {
              blocker.reset?.();
              setGuardFailure(false);
            }
          }}
        >
          <DialogContent portalContainer={portalContainer} className="p-6 sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-lg">{t("workspace.unsavedTitle")}</DialogTitle>
              <DialogDescription className="text-sm">
                {t("workspace.unsavedDescription")}
              </DialogDescription>
            </DialogHeader>
            {guardFailure && (
              <p role="alert" className="text-sm text-destructive">
                {t("workspace.unsavedSaveFailed")}
              </p>
            )}
            <DialogFooter className="flex-wrap gap-3">
              <Button
                variant="ghost"
                disabled={guardSaving || editing.pending}
                onClick={() => {
                  blocker.reset?.();
                  setGuardFailure(false);
                }}
              >
                {t("workspace.stay")}
              </Button>
              <Button
                variant="outline"
                disabled={guardSaving || editing.pending}
                onClick={() => {
                  bridge.current?.discard();
                  blocker.proceed?.();
                  setGuardFailure(false);
                }}
              >
                {t("workspace.discard")}
              </Button>
              <Button
                disabled={guardSaving || editing.pending}
                onClick={() => void saveBeforeLeaving()}
              >
                {t(guardSaving ? "pending" : "workspace.saveLeave")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
