import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, EmptyState, LoadingState } from "@coverview/ui";
import type { IdentityMe } from "@coverview/api-client";
import { api } from "../../api";
import { IdentityFailure } from "./IdentityFailure";
import { forgetIdentity } from "./session-state";

export function AccountDevices({ identity }: { identity: IdentityMe }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const [cursors, setCursors] = useState<string[]>([]);
  const [notice, setNotice] = useState(false);
  const keys = useRef(new Map<string, string>());
  const cursor = cursors.at(-1);
  const queryKey = ["private", identity.user.id, identity.session.id, "sessions"];
  const sessions = useQuery({
    queryKey: [...queryKey, cursor ?? null],
    queryFn: ({ signal }) => api.sessions(cursor, { signal }),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const revoke = useMutation({
    mutationFn: ({ id }: { id: string; isCurrent: boolean }) => {
      const idempotencyKey = keys.current.get(id) ?? crypto.randomUUID();
      keys.current.set(id, idempotencyKey);
      return api.revokeSession(id, { csrfToken: identity.csrfToken, idempotencyKey });
    },
    onSuccess: async (_result, variables) => {
      if (variables.isCurrent) {
        await forgetIdentity(client);
        window.location.assign("/account");
      } else {
        setNotice(true);
        await client.invalidateQueries({ queryKey });
      }
    },
    retry: false,
  });
  const format = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  if (sessions.isPending) return <LoadingState label={t("identity.devicesLoading")} />;
  if (sessions.isError)
    return (
      <IdentityFailure
        error={sessions.error}
        onRetry={() => {
          void sessions.refetch();
        }}
      />
    );
  return (
    <div className="space-y-6">
      {notice && <p role="status">{t("identity.revoked")}</p>}
      {revoke.isError && (
        <IdentityFailure
          error={revoke.error}
          onRetry={() => {
            revoke.mutate(revoke.variables);
          }}
        />
      )}
      {sessions.data.sessions.length === 0 ? (
        <EmptyState
          title={t("identity.noDevices")}
          description={t("identity.noDevicesDescription")}
        />
      ) : (
        <ul className="space-y-3">
          {sessions.data.sessions.map((session) => (
            <li
              key={session.id}
              className="flex flex-wrap items-center justify-between gap-5 border-b border-border py-7"
            >
              <div className="min-w-0 space-y-2">
                <h2 className="break-words font-medium">{session.device}</h2>
                {session.isCurrent && (
                  <p className="text-sm font-medium text-primary">{t("identity.currentDevice")}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {t("identity.lastSeen", { date: format.format(new Date(session.lastSeenAt)) })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("identity.deviceCreated", {
                    date: format.format(new Date(session.createdAt)),
                  })}
                </p>
              </div>
              <Button
                variant="outline"
                disabled={revoke.isPending || sessions.isFetching}
                aria-label={t("identity.revokeDevice", { device: session.device })}
                onClick={() => {
                  setNotice(false);
                  revoke.mutate({ id: session.id, isCurrent: session.isCurrent });
                }}
              >
                {revoke.isPending && revoke.variables.id === session.id
                  ? t("identity.pending")
                  : t("identity.revoke")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {(cursors.length > 0 || sessions.data.nextCursor) && (
        <nav aria-label={t("identity.pagination")} className="flex flex-wrap items-center gap-4">
          <Button
            variant="outline"
            disabled={cursors.length === 0 || revoke.isPending || sessions.isFetching}
            onClick={() => {
              setCursors((value) => value.slice(0, -1));
              setNotice(false);
            }}
          >
            {t("identity.previous")}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t("identity.page", {
              page: new Intl.NumberFormat(i18n.language).format(cursors.length + 1),
            })}
          </p>
          <Button
            variant="outline"
            disabled={!sessions.data.nextCursor || revoke.isPending || sessions.isFetching}
            onClick={() => {
              if (sessions.data.nextCursor)
                setCursors((value) => [...value, sessions.data.nextCursor as string]);
              setNotice(false);
            }}
          >
            {t("identity.next")}
          </Button>
        </nav>
      )}
    </div>
  );
}
