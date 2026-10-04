import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import { type ActionCardDetails } from "@coverview/contracts";
import { api } from "../../api";
import { forgetIdentity } from "../identity/session-state";

export function useActionCards(identity: IdentityMe, scope: string, id: string) {
  const client = useQueryClient();
  const root = useMemo(
    () => ["private", identity.user.id, identity.session.id, "action-center", scope, "detail"],
    [identity.user.id, identity.session.id, scope],
  );
  const filter = useMemo(() => (scope === "all" ? {} : { profileId: scope }), [scope]);
  const stream = useRef<ReturnType<typeof api.openActionStream> | null>(null);
  const currentId = useRef(id);
  currentId.current = id;
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const connection = api.openActionStream({
      csrfToken: identity.csrfToken,
      onReconnect: () => {
        void client.invalidateQueries({ queryKey: root, refetchType: "none" });
        const cardId = currentId.current;
        void api
          .actionCenterAction(cardId, { signal: controller.signal }, filter)
          .then((data) => {
            if (alive) client.setQueryData([...root, cardId], data);
          })
          .catch((error: unknown) => {
            if (alive && error instanceof ApiError && error.status === 401)
              void forgetIdentity(client);
          });
      },
    });
    stream.current = connection;
    return () => {
      alive = false;
      controller.abort();
      stream.current = null;
      void connection.then((value) => value.close());
      void client.cancelQueries({ queryKey: root });
      client.removeQueries({ queryKey: root });
    };
  }, [client, root, filter, identity.csrfToken]);
  const options = useCallback(
    (cardId: string) => ({
      queryKey: [...root, cardId],
      gcTime: 120000,
      staleTime: 60000,
      retry: false as const,
      refetchOnWindowFocus: false,
      queryFn: async ({ signal }: { signal: AbortSignal }): Promise<ActionCardDetails> => {
        try {
          const connection = stream.current;
          const data = connection
            ? await (await connection).read({ id: cardId, ...filter }, signal)
            : await api.actionCenterAction(cardId, { signal }, filter);
          signal.throwIfAborted();
          return data;
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) void forgetIdentity(client);
          if (!(error instanceof ApiError) || error.status !== 0 || signal.aborted) throw error;
          return api.actionCenterAction(cardId, { signal }, filter);
        }
      },
    }),
    [client, filter, root],
  );
  const query = useQuery(options(id));
  useEffect(() => {
    if (!query.data) return;
    const neighbors = [query.data.previousId, query.data.nextId].filter((value): value is string =>
      Boolean(value),
    );
    for (const neighbor of new Set(neighbors)) void client.prefetchQuery(options(neighbor));
    const keep = new Set([id, ...neighbors]);
    const cached = client.getQueryCache().findAll({ queryKey: root });
    for (const entry of cached
      .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
      .slice(9)) {
      if (!keep.has(String(entry.queryKey.at(-1))) && entry.getObserversCount() === 0)
        client.removeQueries({ queryKey: entry.queryKey, exact: true });
    }
  }, [client, id, options, query.data, root]);
  return { query, load: (cardId: string) => client.fetchQuery(options(cardId)) };
}
