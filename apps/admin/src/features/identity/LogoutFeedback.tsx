import { useEffect, useRef, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@coverview/ui";
import { api } from "../../api";
import { forgetIdentity } from "./session-state";

export const logoutCommandKey = ["identity", "logout-command"] as const;
export type LogoutCommand = {
  scope: "current" | "all";
  csrfToken: string;
  idempotencyKey: string;
  status: "requested" | "uncertain" | "pending" | "complete";
};

export function LogoutFeedback({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const started = useRef<string | null>(null);
  const command = useQuery<LogoutCommand | null>({
    queryKey: logoutCommandKey,
    queryFn: () => null,
    initialData: null,
    enabled: false,
    gcTime: 0,
  });
  const retry = useMutation({
    mutationFn: async (value: LogoutCommand) => {
      await forgetIdentity(client);
      return api.logout(value.scope, value);
    },
    onSuccess: (result, value) => {
      client.setQueryData(logoutCommandKey, { ...value, status: result.remoteRevocation });
    },
    onError: (_error, value) => {
      client.setQueryData(logoutCommandKey, {
        ...value,
        status: value.status === "pending" ? "pending" : "uncertain",
      });
    },
    retry: false,
  });
  const mutate = retry.mutate;
  useEffect(() => {
    const value = command.data;
    if (value?.status === "requested" && started.current !== value.idempotencyKey) {
      started.current = value.idempotencyKey;
      mutate(value);
    }
  }, [command.data, mutate]);
  if (!command.data) return children;
  const value = command.data;
  const confirmed = value.status === "pending" || value.status === "complete";
  return (
    <section className="max-w-2xl space-y-7" aria-labelledby="logout-feedback-title">
      <h1 id="logout-feedback-title" className="text-2xl font-semibold">
        {t(confirmed ? "identity.logoutClosedTitle" : "identity.logoutCheckingTitle")}
      </h1>
      <p role="status" className="text-muted-foreground">
        {t(
          value.status === "complete"
            ? "identity.remoteComplete"
            : value.status === "pending"
              ? "identity.remotePending"
              : value.status === "requested"
                ? "identity.pending"
                : "identity.logoutUncertain",
        )}
      </p>
      {retry.isError && confirmed && (
        <p role="alert" className="text-destructive">
          {t("identity.logoutRetryFailed")}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {value.status !== "complete" && (
          <Button
            disabled={retry.isPending || value.status === "requested"}
            onClick={() => {
              retry.mutate(value);
            }}
          >
            {retry.isPending || value.status === "requested"
              ? t("identity.pending")
              : t("identity.logoutRetry")}
          </Button>
        )}
        <Button
          variant="outline"
          disabled={retry.isPending || value.status === "requested"}
          onClick={() => {
            client.setQueryData(logoutCommandKey, null);
            window.location.assign("/account");
          }}
        >
          {t("identity.backAccount")}
        </Button>
      </div>
    </section>
  );
}
