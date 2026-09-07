import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Clock3 } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import { Button, LoadingState } from "@coverview/ui";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { DocumentFailure } from "../features/documents/DocumentFailure";
import { api } from "../api";

function Requests({ identity }: { identity: IdentityMe }) {
  const { t, i18n } = useTranslation("documents");
  const client = useQueryClient();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursors.at(-1);
  const root = ["private", identity.user.id, identity.session.id];
  const controller = useRef(new AbortController());
  const keys = useRef(new Map<string, string>());
  useEffect(() => {
    const active = new AbortController();
    controller.current = active;
    return () => active.abort();
  }, []);
  const query = useQuery({
    queryKey: [...root, "change-requests", cursor],
    queryFn: ({ signal }) => api.documentChangeRequests(cursor, { signal }),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  const cancel = useMutation({
    mutationKey: [...root, "cancel-change-request"],
    gcTime: 0,
    retry: false,
    mutationFn: (input: { documentId: string; id: string }) => {
      const key = keys.current.get(input.id) ?? crypto.randomUUID();
      keys.current.set(input.id, key);
      return api.cancelDocumentChangeRequest(input.documentId, input.id, {
        csrfToken: identity.csrfToken,
        idempotencyKey: key,
        signal: controller.current.signal,
      });
    },
    onSuccess: async () => {
      if (!controller.current.signal.aborted) await client.invalidateQueries({ queryKey: root });
    },
  });
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="cv-app-heading">{t("requests.title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("requests.description")}</p>
      </header>
      {query.isPending && <LoadingState label={t("loading")} />}
      {query.isError && (
        <DocumentFailure error={query.error} onRetry={() => void query.refetch()} />
      )}
      {cancel.isError && (
        <DocumentFailure
          error={cancel.error}
          onRetry={() => {
            if (cancel.variables) cancel.mutate(cancel.variables);
          }}
        />
      )}
      {query.data &&
        (query.data.requests.length ? (
          <ul className="divide-y divide-border">
            {query.data.requests.map((item) => (
              <li key={item.id} className="space-y-4 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="font-medium">
                      {t("requests.heading", {
                        insurer: item.insurer,
                        field: t(`field.${item.field}`),
                      })}
                    </h2>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock3 className="size-4" aria-hidden="true" />
                      {t("requests.statusDate", {
                        status: t(`requests.state.${item.state}`),
                        date: new Intl.DateTimeFormat(i18n.language, {
                          dateStyle: "medium",
                        }).format(new Date(item.createdAt)),
                      })}
                    </p>
                  </div>
                  {item.state === "prepared" && (
                    <Button
                      variant="outline"
                      disabled={cancel.isPending}
                      onClick={() => cancel.mutate(item)}
                    >
                      {t("requests.cancel")}
                    </Button>
                  )}
                </div>
                <dl className="grid gap-3 rounded-lg bg-muted p-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">{t("requests.before")}</dt>
                    <dd className="mt-1 break-words">{item.previousValue}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("requests.after")}</dt>
                    <dd className="mt-1 break-words font-medium">{item.requestedValue}</dd>
                  </div>
                </dl>
                {item.state === "prepared" && (
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    {t("requests.prepareHelp")}
                  </p>
                )}
                <Link
                  to="/documents/$documentId"
                  params={{ documentId: item.documentId }}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-indigo-600 underline underline-offset-4"
                >
                  {t("requests.openDocument")}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-muted p-6 text-sm">{t("requests.empty")}</p>
        ))}
      {(cursors.length > 1 || query.data?.nextCursor) && (
        <nav aria-label={t("pagination")} className="flex gap-3">
          <Button
            variant="outline"
            disabled={cursors.length === 1 || query.isFetching}
            onClick={() => setCursors((items) => items.slice(0, -1))}
          >
            {t("previous")}
          </Button>
          <Button
            variant="outline"
            disabled={!query.data?.nextCursor || query.isFetching}
            onClick={() => {
              if (query.data?.nextCursor)
                setCursors((items) => [...items, query.data.nextCursor ?? undefined]);
            }}
          >
            {t("next")}
          </Button>
        </nav>
      )}
    </div>
  );
}
export function RequestsPage() {
  return <IdentityBoundary>{(identity) => <Requests identity={identity} />}</IdentityBoundary>;
}
