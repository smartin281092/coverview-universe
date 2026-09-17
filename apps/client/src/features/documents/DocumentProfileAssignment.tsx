import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button, LoadingState } from "@coverview/ui";
import type { IdentityMe } from "@coverview/api-client";
import type { DocumentRecord, ManagedProfileCreateInput } from "@coverview/contracts";
import { api } from "../../api";
import { DocumentFailure } from "./DocumentFailure";
import { DocumentProfileCreateDialog } from "./DocumentProfileCreateDialog";

export function DocumentProfileAssignment({
  identity,
  document,
  onPendingChange,
}: {
  identity: IdentityMe;
  document: DocumentRecord;
  onPendingChange: (pending: boolean) => void;
}) {
  const { t } = useTranslation("documents");
  const client = useQueryClient();
  const [selected, setSelected] = useState("");
  const [creating, setCreating] = useState(false);
  const createTrigger = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const operation = useRef<{ payload: string; key: string } | null>(null);
  const controller = useRef(new AbortController());
  const root = ["private", identity.user.id, identity.session.id];
  useEffect(() => {
    const active = new AbortController();
    controller.current = active;
    return () => active.abort();
  }, []);
  const profiles = useQuery({
    queryKey: [...root, "profiles"],
    queryFn: ({ signal }) => api.profiles({ signal }),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  const mutation = useMutation({
    mutationKey: [...root, "document-profile-assignment", document.id],
    gcTime: 0,
    retry: false,
    mutationFn: async (newProfile: ManagedProfileCreateInput | null) => {
      const input = newProfile
        ? { revision: document.revision, createProfile: true as const, profile: newProfile }
        : { revision: document.revision, profileId: selected };
      const payload = JSON.stringify(input);
      if (operation.current?.payload !== payload)
        operation.current = { payload, key: crypto.randomUUID() };
      return api.assignDocumentProfile(document.id, input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: operation.current.key,
        signal: controller.current.signal,
      });
    },
    onSuccess: async () => {
      if (controller.current.signal.aborted) return;
      operation.current = null;
      setCreating(false);
      await client.invalidateQueries({ queryKey: root });
    },
    onSettled: () => {
      busy.current = false;
    },
  });
  const assign = (profile: ManagedProfileCreateInput | null) => {
    if (busy.current) return;
    busy.current = true;
    mutation.mutate(profile);
  };
  useEffect(() => {
    onPendingChange(mutation.isPending);
    return () => onPendingChange(false);
  }, [mutation.isPending, onPendingChange]);
  const assigned =
    document.profileAssignment == null ||
    ["manual", "matched", "created"].includes(document.profileAssignment);
  if (profiles.isPending) return <LoadingState label={t("assignment.loading")} />;
  if (profiles.isError)
    return <DocumentFailure error={profiles.error} onRetry={() => void profiles.refetch()} />;
  const profile = profiles.data.profiles.find((item) => item.id === (document.profileId ?? "self"));
  if (assigned)
    return (
      <p className="text-sm text-muted-foreground">
        {t(document.profileAssignment === "created" ? "assignment.created" : "assignment.assigned")}{" "}
        <Link
          to="/profile"
          search={{ person: document.profileId ?? "self", tab: "general" }}
          className="font-medium underline underline-offset-4"
        >
          {profile?.displayName ?? t("profile")}
        </Link>
      </p>
    );
  if (!["ready", "failed"].includes(document.state)) return null;
  const reason =
    document.profileAssignment === "pending" ? "missing_identity" : document.profileAssignment;
  return (
    <form
      className="space-y-4 rounded-xl border border-border p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (selected && !mutation.isPending) assign(null);
      }}
    >
      <h2 className="cv-app-subheading">{t("assignment.question")}</h2>
      <p className="text-sm text-muted-foreground">{t(`assignment.${reason}`)}</p>
      <fieldset className="space-y-2" disabled={mutation.isPending}>
        <legend className="sr-only">{t("assignment.question")}</legend>
        {profiles.data.profiles.map((item) => (
          <label
            key={item.id}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 has-[:checked]:bg-muted"
          >
            <input
              type="radio"
              name={`document-profile-${document.id}`}
              value={item.id}
              checked={selected === item.id}
              onChange={() => setSelected(item.id)}
              className="size-4 accent-primary"
            />
            <span>
              {item.isSelf ? t("assignment.self", { name: item.displayName }) : item.displayName}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!selected || mutation.isPending} type="submit">
          {t(mutation.isPending ? "assignment.saving" : "assignment.confirm")}
        </Button>
        <Button
          ref={createTrigger}
          type="button"
          variant="outline"
          disabled={profiles.data.profiles.length >= 50 || mutation.isPending}
          onClick={() => {
            mutation.reset();
            setCreating(true);
          }}
        >
          {t(
            mutation.isPending && mutation.variables ? "assignment.creating" : "assignment.create",
          )}
        </Button>
        <Button asChild variant="outline" disabled={mutation.isPending}>
          <Link to="/profile">{t("assignment.manage")}</Link>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {document.profileCreation
          ? t("assignment.createHelp", { name: document.profileCreation.displayName })
          : t("assignment.createUnavailable")}
      </p>
      {creating && (
        <DocumentProfileCreateDialog
          proposal={document.profileCreation}
          pending={mutation.isPending}
          error={mutation.error}
          onCreate={assign}
          onClose={() => setCreating(false)}
          returnFocus={createTrigger}
        />
      )}
      {mutation.isError && !creating && (
        <DocumentFailure
          error={mutation.error}
          onRetry={() => assign(mutation.variables ?? null)}
        />
      )}
    </form>
  );
}
