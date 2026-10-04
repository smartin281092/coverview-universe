import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type Profile, type ProfileDraft, type ProfileStep } from "@coverview/contracts";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import { api } from "../../api";
import { forgetIdentity } from "../identity/session-state";
import {
  profileFormSchema,
  profilePatch,
  profileValues,
  type ProfileFieldName,
  type ProfileFormValues,
} from "./profile-fields";

type DraftEntry = Awaited<ReturnType<typeof api.profileDraft>>;
type Failure = "save" | "conflict" | "expired" | "session" | "denied" | "birthDate" | "proposals";

export function useProfileJourney({
  identity,
  ownerId,
  blocked,
}: {
  identity: IdentityMe | null;
  ownerId: string | null;
  blocked: boolean;
}) {
  const client = useQueryClient();
  const [step, setStep] = useState<ProfileStep>("information");
  const [saved, setSaved] = useState<Profile | ProfileDraft | null>(null);
  const [draftEntry, setDraftEntry] = useState<DraftEntry | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [notice, setNotice] = useState<
    "saved" | "confirmed" | "attached" | "refreshed" | "restarted" | null
  >(null);
  const [prefill, setPrefill] = useState(false);
  const [prefillDirty, setPrefillDirty] = useState(false);
  const [resolved, setResolved] = useState<ReadonlySet<ProfileFieldName>>(new Set());
  const explicit = useRef(new Set<ProfileFieldName>());
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const sessionScope = `${ownerId ?? "anonymous"}:${identity?.session.id ?? "unavailable"}`;
  const currentScope = useRef(sessionScope);
  currentScope.current = sessionScope;
  const blockedNow = useRef(blocked);
  blockedNow.current = blocked;
  const keys = useRef(new Map<string, { signature: string; key: string }>());
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: profileValues(null),
    mode: "onTouched",
  });
  // Subscribe so reset(keepDirtyValues) preserves only the fields the owner actually edited.
  const { dirtyFields, isDirty } = form.formState;
  const queryKey = ["private", ownerId, identity?.session.id, "profile"];
  const profileQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => api.profile({ signal }),
    enabled: Boolean(identity) && !blocked,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.error ? false : 15_000),
  });
  const draftQuery = useQuery({
    queryKey: ["private", ownerId ?? "anonymous", "profile-draft"],
    queryFn: ({ signal }) => api.profileDraft({ signal }),
    enabled: !blocked,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
      keys.current.clear();
    };
  }, []);
  useEffect(() => {
    controller.current?.abort();
    controller.current = null;
    busy.current = false;
    setPending(false);
  }, [sessionScope]);
  useEffect(() => {
    if (draftQuery.data) setDraftEntry(draftQuery.data);
  }, [draftQuery.data]);
  useEffect(() => {
    if (
      profileQuery.error instanceof ApiError &&
      profileQuery.error.code === "IDENTITY_UNAUTHENTICATED"
    )
      void forgetIdentity(client);
  }, [profileQuery.error, client]);
  useEffect(() => {
    if (initialized || blocked || !draftQuery.data || (ownerId && !profileQuery.data)) return;
    const record = ownerId ? (profileQuery.data ?? null) : draftQuery.data.draft;
    setSaved(record);
    form.reset(profileValues(record));
    setStep(record?.step ?? "information");
    if (record && "prefill" in record) setPrefill(record.prefill.enabled);
    setInitialized(true);
  }, [initialized, blocked, draftQuery.data, profileQuery.data, ownerId, form]);
  useEffect(() => {
    if (
      initialized &&
      profileQuery.data &&
      saved &&
      ownerId &&
      profileQuery.data.revision > saved.revision
    ) {
      if (pending) return;
      if (isDirty || Object.keys(dirtyFields).length || prefillDirty || explicit.current.size) {
        setFailure("conflict");
      } else {
        setSaved(profileQuery.data);
        form.reset(profileValues(profileQuery.data));
        setPrefill(profileQuery.data.prefill.enabled);
        setFailure((current) => (current === "conflict" ? null : current));
      }
    }
  }, [
    initialized,
    profileQuery.data,
    saved,
    ownerId,
    pending,
    isDirty,
    dirtyFields,
    prefillDirty,
    form,
  ]);
  const keyFor = (operation: string, input: unknown) => {
    const signature = JSON.stringify(input);
    const previous = keys.current.get(operation);
    if (previous?.signature === signature) return previous.key;
    const key = crypto.randomUUID();
    keys.current.set(operation, { signature, key });
    return key;
  };
  const report = async (error: unknown, isCurrent: () => boolean) => {
    if (!isCurrent()) return;
    const code = error instanceof ApiError ? String(error.code) : "";
    if (code === "IDENTITY_UNAUTHENTICATED" || code === "IDENTITY_CSRF_INVALID") {
      setFailure("session");
      if (ownerId) await forgetIdentity(client);
    } else if (code === "PROFILE_DRAFT_EXPIRED" || code === "PROFILE_DRAFT_ATTACHED") {
      setFailure("expired");
      const entry = await draftQuery.refetch();
      if (isCurrent() && entry.data) setDraftEntry(entry.data);
    } else if (code === "PROFILE_INVALID_BIRTH_DATE") setFailure("birthDate");
    else if (code === "PROFILE_CONFIRMATION_REQUIRED") setFailure("proposals");
    else if (error instanceof ApiError && error.status === 409) setFailure("conflict");
    else if (error instanceof ApiError && error.status === 403) setFailure("denied");
    else setFailure("save");
  };
  const run = async (
    operation: (signal: AbortSignal, isCurrent: () => boolean) => Promise<void>,
  ) => {
    if (busy.current || blockedNow.current || currentScope.current !== sessionScope) return false;
    busy.current = true;
    const scope = sessionScope;
    const active = new AbortController();
    controller.current = active;
    const isCurrent = () =>
      mounted.current &&
      currentScope.current === scope &&
      controller.current === active &&
      !active.signal.aborted;
    setPending(true);
    setFailure(null);
    setNotice(null);
    try {
      await operation(active.signal, isCurrent);
      return isCurrent();
    } catch (error) {
      await report(error, isCurrent);
      return false;
    } finally {
      if (controller.current === active) {
        busy.current = false;
        if (mounted.current && currentScope.current === scope) setPending(false);
      }
    }
  };
  const adopt = (record: Profile | ProfileDraft) => {
    if (!mounted.current) return;
    setSaved(record);
    form.reset(profileValues(record));
    explicit.current.clear();
    setResolved(new Set());
    if ("prefill" in record) client.setQueryData(queryKey, record);
    if (identity)
      void client.invalidateQueries({
        queryKey: ["private", identity.user.id, identity.session.id, "managed-profiles"],
      });
  };
  const persist = async (
    values: ProfileFormValues,
    next: ProfileStep,
    signal: AbortSignal,
    isCurrent: () => boolean,
  ) => {
    const input = {
      revision: saved?.revision ?? 0,
      step: next,
      fields: profilePatch(values, profileValues(saved), explicit.current),
    };
    // Avoid creating a new revision before retrying a confirmation whose response was lost.
    if (saved && saved.step === next && Object.keys(input.fields).length === 0) return saved;
    if (identity) {
      const record = await api.saveProfile(input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: keyFor("save", input),
        signal,
      });
      if (isCurrent()) adopt(record);
      return record;
    }
    if (ownerId || !draftEntry) throw new Error("PROFILE_DRAFT_UNAVAILABLE");
    const entry = await api.saveProfileDraft(input, {
      csrfToken: draftEntry.csrfToken,
      idempotencyKey: keyFor("draft", input),
      signal,
    });
    if (!entry.draft) throw new Error("PROFILE_DRAFT_UNAVAILABLE");
    if (isCurrent()) {
      setDraftEntry(entry);
      adopt(entry.draft);
    }
    return entry.draft;
  };
  const move = async (next: ProfileStep) => {
    let succeeded = false;
    await form.handleSubmit(async (values) => {
      succeeded = await run(async (signal, isCurrent) => {
        await persist(values, next, signal, isCurrent);
        if (isCurrent()) {
          setStep(next);
          setNotice("saved");
        }
      });
    })();
    return succeeded;
  };
  const continueLogin = () =>
    form.handleSubmit((values) =>
      run(async (signal, isCurrent) => {
        await persist(values, step, signal, isCurrent);
        if (isCurrent())
          window.location.assign(api.loginUrl("wallet", { continuation: "profile" }));
      }),
    )();
  const attach = () =>
    run(async (signal, isCurrent) => {
      if (!identity || !draftEntry?.draft || isDirty || prefillDirty || resolved.size > 0) return;
      const input = { draftRevision: draftEntry.draft.revision };
      const result = await api.attachProfileDraft(input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: keyFor("attach", input),
        signal,
      });
      if (isCurrent()) {
        adopt(result.profile);
        setPrefill(result.profile.prefill.enabled);
        setDraftEntry({ ...draftEntry, draft: null, state: "attached" });
        setStep(result.resumeStep);
        setNotice("attached");
      }
    });
  const confirm = async () => {
    let succeeded = false;
    await form.handleSubmit(async (values) => {
      succeeded = await run(async (signal, isCurrent) => {
        if (!identity) return;
        const record = await persist(values, "review", signal, isCurrent);
        if (!isCurrent()) return;
        const input = { revision: record.revision, prefill, version: "1" as const };
        const result = await api.confirmProfile(input, {
          csrfToken: identity.csrfToken,
          idempotencyKey: keyFor("confirm", input),
          signal,
        });
        if (isCurrent()) {
          adopt(result);
          setStep("review");
          setNotice("confirmed");
          setPrefillDirty(false);
        }
      });
    })();
    return succeeded;
  };
  const refreshKeepingEdits = () =>
    run(async (signal, isCurrent) => {
      const record = identity ? await api.profile({ signal }) : null;
      const entry = await api.profileDraft({ signal });
      if (!isCurrent()) return;
      const latest = record ?? entry?.draft ?? null;
      if (entry) setDraftEntry(entry);
      if (record && saved && "prefill" in saved) {
        for (const field of [...explicit.current]) {
          if (JSON.stringify(saved.fields[field]) !== JSON.stringify(record.fields[field]))
            explicit.current.delete(field);
        }
        setResolved(new Set(explicit.current));
      }
      setSaved(latest);
      form.reset(profileValues(latest), { keepDirtyValues: true });
      if (record) client.setQueryData(queryKey, record);
      if (!prefillDirty && record) setPrefill(record.prefill.enabled);
      setNotice("refreshed");
    });
  const restart = () =>
    run(async (signal, isCurrent) => {
      if (ownerId || !draftEntry) return;
      // No active draft is discarded. The server rejects active handles.
      const entry = await api.newProfileDraft({
        csrfToken: draftEntry.csrfToken,
        idempotencyKey: keyFor("new", draftEntry.csrfToken),
        signal,
      });
      if (!isCurrent()) return;
      setDraftEntry(entry);
      setSaved(entry.draft);
      const currentValues = form.getValues();
      form.reset(profileValues(entry.draft));
      for (const field of Object.keys(currentValues) as ProfileFieldName[])
        form.setValue(field, currentValues[field], { shouldDirty: true });
      explicit.current.clear();
      setResolved(new Set());
      setNotice("restarted");
    });
  const resolveProposal = (field: ProfileFieldName, value: string) => {
    form.setValue(field, value, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    explicit.current.add(field);
    setResolved((previous) => new Set(previous).add(field));
    setNotice(null);
  };
  return {
    form,
    dirtyFields,
    isDirty,
    prefillDirty,
    step,
    saved,
    profile: saved && "prefill" in saved ? saved : null,
    draftEntry,
    pending,
    failure,
    notice,
    initialized,
    loadError: profileQuery.error ?? draftQuery.error,
    prefill,
    setPrefill: (value: boolean) => {
      setPrefill(value);
      setPrefillDirty(true);
      setNotice(null);
    },
    resolved,
    move,
    continueLogin,
    attach,
    confirm,
    refreshKeepingEdits,
    restart,
    resolveProposal,
    discard: () => {
      form.reset(profileValues(saved));
      explicit.current.clear();
      setResolved(new Set());
      if (saved && "prefill" in saved) setPrefill(saved.prefill.enabled);
      setPrefillDirty(false);
      setFailure(null);
      setNotice(null);
    },
    retryLoad: async () => {
      await Promise.all([draftQuery.refetch(), ...(identity ? [profileQuery.refetch()] : [])]);
    },
  };
}

export type ProfileJourney = ReturnType<typeof useProfileJourney>;
